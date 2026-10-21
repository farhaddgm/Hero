import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REPO_ROOT } from "./fs-policy.mjs";

/**
 * NX-043 — deterministic safety linter for SQL migrations.
 *
 * Rules (every finding names its rule):
 *   NUMBERING      files are NNN_name.sql, contiguous from 001, no duplicates
 *   DESTRUCTIVE    DROP TABLE/COLUMN/SCHEMA/INDEX/CONSTRAINT/FUNCTION, TRUNCATE, RENAME, column type change
 *   DATA_MUTATION  UPDATE / DELETE in a migration (a backfill must be a documented exception)
 *   NOT_IDEMPOTENT CREATE TABLE/INDEX/COLUMN without IF NOT EXISTS, CREATE FUNCTION without OR REPLACE,
 *                  CREATE TRIGGER without a preceding DROP TRIGGER IF EXISTS of the same name in the same file
 *   NOT_NULL       ADD COLUMN ... NOT NULL without DEFAULT
 *   GUARD          weakening an append-only guard: dropping it without re-creating it, DISABLE TRIGGER,
 *                  or a guard function that no longer raises
 *
 * An exception is `-- hero-migration-allow: RULE reason="…" owner="…"` on the line before the statement
 * (or an entry in config/migrations/lint-exceptions-v1.json for migrations that were already shipped,
 * which must not be edited). It must name a real rule, a reason of 10+ characters and an owner, and an
 * exception that excuses nothing is itself an error (STALE_EXCEPTION).
 */

export const MIGRATION_RULES = Object.freeze(["NUMBERING", "DESTRUCTIVE", "DATA_MUTATION", "NOT_IDEMPOTENT", "NOT_NULL", "GUARD"]);
export const MIGRATIONS_DIRECTORY = "packages/adapters/migrations";
export const EXCEPTIONS_FILE = "config/migrations/lint-exceptions-v1.json";

const FILE_NAME = /^(\d{3})_[a-z0-9_]+\.sql$/;
const GUARD_SUFFIX = /_append_only_guard$/i;
const GUARD_FUNCTION = "hero_reject_append_only_mutation";
const ANNOTATION = /^--\s*hero-migration-allow:\s*([A-Z_]+)\s+reason="([^"]*)"\s+owner="([^"]*)"\s*$/;

/** Splits SQL into statements, respecting quotes, dollar-quoted bodies and comments. Comments are dropped; annotations are returned. */
export function splitStatements(sql) {
  const statements = [];
  const annotations = [];
  let current = "";
  let startLine = 1;
  let line = 1;
  let index = 0;
  const flush = () => {
    const text = current.replace(/\s+/g, " ").trim();
    if (text) statements.push({ text, line: startLine });
    current = "";
  };
  const mark = () => { if (current.trim() === "") startLine = line; };
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];
    if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", index);
      const comment = sql.slice(index, end === -1 ? sql.length : end).trim();
      const annotation = ANNOTATION.exec(comment);
      if (/hero-migration-allow/.test(comment)) annotations.push({ line, raw: comment, parsed: annotation ? { rule: annotation[1], reason: annotation[2], owner: annotation[3] } : null });
      index = end === -1 ? sql.length : end;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      const stop = end === -1 ? sql.length : end + 2;
      line += (sql.slice(index, stop).match(/\n/g) ?? []).length;
      index = stop;
      continue;
    }
    if (char === "'") {
      mark();
      let end = index + 1;
      while (end < sql.length) {
        if (sql[end] === "'" && sql[end + 1] === "'") end += 2;
        else if (sql[end] === "'") break;
        else end += 1;
      }
      const chunk = sql.slice(index, end + 1);
      line += (chunk.match(/\n/g) ?? []).length;
      current += chunk;
      index = end + 1;
      continue;
    }
    if (char === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(index));
      if (tag) {
        mark();
        const close = sql.indexOf(tag[0], index + tag[0].length);
        const stop = close === -1 ? sql.length : close + tag[0].length;
        const chunk = sql.slice(index, stop);
        line += (chunk.match(/\n/g) ?? []).length;
        current += chunk;
        index = stop;
        continue;
      }
    }
    if (char === ";") {
      flush();
      index += 1;
      continue;
    }
    if (char === "\n") line += 1;
    if (current.trim() === "" && !/\s/.test(char)) startLine = line;
    current += char;
    index += 1;
  }
  flush();
  return { statements, annotations };
}

function identifier(text) {
  return text.replace(/^"|"$/g, "").toLowerCase();
}

function finding(rule, file, line, message) {
  return { rule, file, line, message };
}

/** Lints one migration. `fingerprint` identifies a statement for registry exceptions (stable across line moves). */
export function lintMigrationSql(sql, file = "migration.sql") {
  const { statements, annotations } = splitStatements(sql);
  const findings = [];
  const createdTriggers = new Set();
  const droppedGuards = new Map();
  const recreatedGuards = new Set();
  const droppedTriggerSeen = new Set();
  const droppedConstraints = new Map();
  const addedConstraints = new Set();
  const stripped = text => text.replace(/\$[A-Za-z_]*\$[\s\S]*?\$[A-Za-z_]*\$/g, "$$body$$");

  for (const statement of statements) {
    const text = statement.text;
    const upper = stripped(text).toUpperCase();
    const at = (rule, message) => findings.push({ ...finding(rule, file, statement.line, message), statement: text.slice(0, 160) });

    if (/^DROP\s+TABLE\b/.test(upper)) at("DESTRUCTIVE", "DROP TABLE removes data");
    else if (/^DROP\s+SCHEMA\b/.test(upper)) at("DESTRUCTIVE", "DROP SCHEMA removes data");
    else if (/^DROP\s+(?:MATERIALIZED\s+)?VIEW\b/.test(upper)) at("DESTRUCTIVE", "DROP VIEW changes a contract");
    else if (/^DROP\s+INDEX\b/.test(upper)) at("DESTRUCTIVE", "DROP INDEX may slow or break readers");
    else if (/^DROP\s+TYPE\b/.test(upper)) at("DESTRUCTIVE", "DROP TYPE breaks dependents");
    else if (/^DROP\s+FUNCTION\b/.test(upper)) {
      if (text.toLowerCase().includes(GUARD_FUNCTION)) at("GUARD", "the append-only guard function must not be dropped");
      else at("DESTRUCTIVE", "DROP FUNCTION changes a contract");
    } else if (/^TRUNCATE\b/.test(upper)) at("DESTRUCTIVE", "TRUNCATE removes data");
    else if (/^ALTER\s+TABLE\b/.test(upper)) {
      if (/\bDROP\s+COLUMN\b/.test(upper)) at("DESTRUCTIVE", "DROP COLUMN removes data");
      // Dropping a named constraint is only the first half of the idempotent "re-create" pattern; it is
      // judged at the end of the file, once we know whether the same constraint is added back.
      for (const dropped of text.matchAll(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?("?[A-Za-z_][A-Za-z0-9_]*"?)/gi)) droppedConstraints.set(identifier(dropped[1]), statement);
      for (const added of text.matchAll(/ADD\s+CONSTRAINT\s+("?[A-Za-z_][A-Za-z0-9_]*"?)/gi)) addedConstraints.add(identifier(added[1]));
      if (/\bRENAME\b/.test(upper)) at("DESTRUCTIVE", "RENAME breaks running readers");
      if (/\bALTER\s+(?:COLUMN\s+)?\S+\s+(?:SET\s+DATA\s+)?TYPE\b/.test(upper)) at("DESTRUCTIVE", "changing a column type can lose data");
      if (/\bDISABLE\s+TRIGGER\b/.test(upper)) at("GUARD", "DISABLE TRIGGER turns a guard off");
      for (const column of text.matchAll(/ADD\s+COLUMN\s+(IF\s+NOT\s+EXISTS\s+)?("?[A-Za-z_][A-Za-z0-9_]*"?)([^,]*)/gi)) {
        if (!column[1]) at("NOT_IDEMPOTENT", `ADD COLUMN ${identifier(column[2])} needs IF NOT EXISTS`);
        if (/\bNOT\s+NULL\b/i.test(column[3]) && !/\bDEFAULT\b/i.test(column[3])) at("NOT_NULL", `new column ${identifier(column[2])} is NOT NULL without a DEFAULT`);
      }
    } else if (/^(?:UPDATE|DELETE)\b/.test(upper)) at("DATA_MUTATION", `${upper.split(" ")[0]} changes existing data`);
    else if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/.test(upper) && !/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?IF\s+NOT\s+EXISTS\b/.test(upper)) at("NOT_IDEMPOTENT", "CREATE INDEX needs IF NOT EXISTS");
    else if (/^CREATE\s+(?:UNLOGGED\s+|TEMP(?:ORARY)?\s+)?TABLE\b/.test(upper) && !/^CREATE\s+(?:UNLOGGED\s+|TEMP(?:ORARY)?\s+)?TABLE\s+IF\s+NOT\s+EXISTS\b/.test(upper)) at("NOT_IDEMPOTENT", "CREATE TABLE needs IF NOT EXISTS");
    else if (/^CREATE\s+FUNCTION\b/.test(upper)) at("NOT_IDEMPOTENT", "CREATE FUNCTION needs OR REPLACE");

    if (/^CREATE\s+OR\s+REPLACE\s+FUNCTION\b/.test(upper) && text.toLowerCase().includes(GUARD_FUNCTION) && !/RAISE\s+EXCEPTION/i.test(text)) at("GUARD", "the append-only guard function no longer raises");

    const drop = /^DROP\s+TRIGGER\s+(IF\s+EXISTS\s+)?("?[A-Za-z_][A-Za-z0-9_]*"?)\s+ON\s+("?[A-Za-z_][A-Za-z0-9_.]*"?)/i.exec(text);
    if (drop) {
      const name = identifier(drop[2]);
      droppedTriggerSeen.add(`${name}\u0000${identifier(drop[3])}`);
      if (GUARD_SUFFIX.test(name)) droppedGuards.set(name, statement);
      if (!drop[1]) at("DESTRUCTIVE", `DROP TRIGGER ${name} needs IF EXISTS`);
    }
    const create = /^CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+("?[A-Za-z_][A-Za-z0-9_]*"?)[\s\S]*?\sON\s+("?[A-Za-z_][A-Za-z0-9_.]*"?)/i.exec(text);
    if (create) {
      const name = identifier(create[1]);
      createdTriggers.add(name);
      if (GUARD_SUFFIX.test(name) && text.toLowerCase().includes(GUARD_FUNCTION)) recreatedGuards.add(name);
      if (!/^CREATE\s+OR\s+REPLACE\s+TRIGGER\b/i.test(text) && !droppedTriggerSeen.has(`${name}\u0000${identifier(create[2])}`)) at("NOT_IDEMPOTENT", `CREATE TRIGGER ${name} needs a preceding DROP TRIGGER IF EXISTS in the same file`);
    }
  }
  for (const [name, statement] of droppedConstraints) {
    if (!addedConstraints.has(name)) findings.push({ ...finding("DESTRUCTIVE", file, statement.line, `DROP CONSTRAINT ${name} weakens integrity and is not re-created in the same file`), statement: statement.text.slice(0, 160) });
  }
  for (const [name, statement] of droppedGuards) {
    if (!recreatedGuards.has(name)) findings.push({ ...finding("GUARD", file, statement.line, `append-only guard ${name} is dropped and not re-created with ${GUARD_FUNCTION}`), statement: statement.text.slice(0, 160) });
  }
  return { findings, annotations, statementCount: statements.length };
}

function validateAnnotation(annotation, file) {
  if (!annotation.parsed) return finding("STALE_EXCEPTION", file, annotation.line, "malformed hero-migration-allow annotation");
  const { rule, reason, owner } = annotation.parsed;
  if (!MIGRATION_RULES.includes(rule) || rule === "NUMBERING") return finding("STALE_EXCEPTION", file, annotation.line, `annotation names an unknown or unexcusable rule: ${rule}`);
  if (reason.trim().length < 10) return finding("STALE_EXCEPTION", file, annotation.line, "annotation needs a reason of at least 10 characters");
  if (owner.trim().length < 3) return finding("STALE_EXCEPTION", file, annotation.line, "annotation needs an owner");
  return null;
}

/**
 * Lints a migrations directory against optional registry exceptions. Returns { ok, files, findings, excused }.
 * Findings that carry no valid exception are errors.
 */
export function lintMigrations({ root = REPO_ROOT, directory = MIGRATIONS_DIRECTORY, exceptionsFile = EXCEPTIONS_FILE } = {}) {
  const base = path.join(root, directory);
  const findings = [];
  const excused = [];
  const names = fs.existsSync(base) ? fs.readdirSync(base).filter(name => name.endsWith(".sql")).sort() : [];
  if (names.length === 0) findings.push(finding("NUMBERING", directory, 0, "no migrations found"));

  names.forEach((name, position) => {
    const match = FILE_NAME.exec(name);
    if (!match) findings.push(finding("NUMBERING", name, 0, "file name must match NNN_lowercase_name.sql"));
    else if (Number(match[1]) !== position + 1) findings.push(finding("NUMBERING", name, 0, `expected number ${String(position + 1).padStart(3, "0")} (numbers must be contiguous from 001)`));
  });
  const numbers = names.map(name => FILE_NAME.exec(name)?.[1]).filter(Boolean);
  for (const number of new Set(numbers.filter((value, index) => numbers.indexOf(value) !== index))) findings.push(finding("NUMBERING", number, 0, "duplicate migration number"));

  let registry = { exceptions: [] };
  const registryPath = path.join(root, exceptionsFile);
  if (fs.existsSync(registryPath)) {
    try { registry = JSON.parse(fs.readFileSync(registryPath, "utf8")); } catch { findings.push(finding("STALE_EXCEPTION", exceptionsFile, 0, "exception registry is not valid JSON")); }
  }
  const usedRegistry = new Set();
  const registryEntries = Array.isArray(registry.exceptions) ? registry.exceptions : [];
  registryEntries.forEach((entry, index) => {
    const problem = !MIGRATION_RULES.includes(entry?.rule) || entry.rule === "NUMBERING" ? "unknown rule" : typeof entry?.file !== "string" || !names.includes(entry.file) ? "unknown file" : typeof entry.reason !== "string" || entry.reason.trim().length < 10 ? "reason too short" : typeof entry.owner !== "string" || entry.owner.trim().length < 3 ? "owner missing" : typeof entry.contains !== "string" || entry.contains.length < 4 ? "statement fingerprint missing" : null;
    if (problem) findings.push(finding("STALE_EXCEPTION", exceptionsFile, index + 1, `registry exception #${index + 1}: ${problem}`));
  });

  const usedAnnotations = new Set();
  for (const name of names) {
    const sql = fs.readFileSync(path.join(base, name), "utf8");
    const result = lintMigrationSql(sql, name);
    for (const annotation of result.annotations) {
      const problem = validateAnnotation(annotation, name);
      if (problem) findings.push(problem);
    }
    for (const item of result.findings) {
      const annotation = result.annotations.find(candidate => candidate.parsed && candidate.parsed.rule === item.rule && validateAnnotation(candidate, name) === null && candidate.line >= item.line - 3 && candidate.line < item.line);
      const registered = registryEntries.findIndex(entry => entry?.file === name && entry.rule === item.rule && typeof entry.contains === "string" && entry.contains.length >= 4 && item.statement.toLowerCase().includes(entry.contains.toLowerCase()));
      if (annotation) { usedAnnotations.add(`${name}:${annotation.line}`); excused.push({ ...item, via: "annotation", owner: annotation.parsed.owner }); }
      else if (registered >= 0) { usedRegistry.add(registered); excused.push({ ...item, via: "registry", owner: registryEntries[registered].owner }); }
      else findings.push(item);
    }
    for (const annotation of result.annotations) if (annotation.parsed && validateAnnotation(annotation, name) === null && !usedAnnotations.has(`${name}:${annotation.line}`)) findings.push(finding("STALE_EXCEPTION", name, annotation.line, "annotation does not excuse any finding"));
  }
  registryEntries.forEach((entry, index) => {
    if (!usedRegistry.has(index) && MIGRATION_RULES.includes(entry?.rule) && names.includes(entry?.file)) findings.push(finding("STALE_EXCEPTION", exceptionsFile, index + 1, `registry exception #${index + 1} excuses nothing in ${entry.file}`));
  });

  findings.sort((a, b) => `${a.file}:${String(a.line).padStart(6, "0")}:${a.rule}`.localeCompare(`${b.file}:${String(b.line).padStart(6, "0")}:${b.rule}`));
  return { ok: findings.length === 0, files: names.length, findings, excused };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = lintMigrations();
  for (const item of report.findings) console.error(`ERROR ${item.rule} ${item.file}:${item.line} ${item.message}`);
  for (const item of report.excused) console.log(`excused ${item.rule} ${item.file}:${item.line} via ${item.via} (owner ${item.owner})`);
  console.log(`Migration lint: ${report.ok ? "PASS" : "FAIL"} — ${report.files} migrations, ${report.findings.length} finding(s), ${report.excused.length} documented exception(s)`);
  if (!report.ok) process.exitCode = 1;
}
