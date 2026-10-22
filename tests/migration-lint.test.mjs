import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { EXCEPTIONS_FILE, MIGRATION_RULES, lintMigrationSql, lintMigrations, splitStatements } from "../tools/migration-lint.mjs";

const rulesOf = sql => lintMigrationSql(sql).findings.map(item => item.rule);

function workspace(files, exceptions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hero-migration-lint-"));
  const directory = path.join(root, "packages/adapters/migrations");
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), sql);
  if (exceptions) {
    fs.mkdirSync(path.join(root, path.dirname(EXCEPTIONS_FILE)), { recursive: true });
    fs.writeFileSync(path.join(root, EXCEPTIONS_FILE), JSON.stringify(exceptions));
  }
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
const lintFiles = (files, exceptions) => {
  const space = workspace(files, exceptions);
  try { return lintMigrations({ root: space.root }); } finally { space.cleanup(); }
};
const GOOD = "CREATE TABLE IF NOT EXISTS widgets (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());\n";

test("all shipped migrations pass the linter with no exception needed", () => {
  const report = lintMigrations();
  assert.deepEqual(report.findings, []);
  assert.equal(report.ok, true);
  assert.ok(report.files >= 24);
  assert.deepEqual(report.excused, [], "the shipped files are not edited and need no exception");
});

test("the statement splitter respects quotes, dollar-quoted bodies and comments", () => {
  const sql = "-- header; not a split\nCREATE OR REPLACE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'a;b'; END; $$;\n/* block; comment */ SELECT 'it''s; fine';\nSELECT 1";
  const { statements } = splitStatements(sql);
  assert.equal(statements.length, 3);
  assert.match(statements[0].text, /RAISE EXCEPTION 'a;b'; END;/);
  assert.equal(statements[1].text, "SELECT 'it''s; fine'");
  assert.equal(statements[0].line, 2);
  assert.equal(splitStatements("").statements.length, 0);
});

test("destructive statements are rejected: DROP COLUMN, DROP TABLE, TRUNCATE, RENAME, type change and friends", () => {
  assert.deepEqual(rulesOf("ALTER TABLE widgets DROP COLUMN name;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets DROP COLUMN IF EXISTS name;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("DROP TABLE widgets;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("DROP TABLE IF EXISTS widgets CASCADE;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("TRUNCATE widgets;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets RENAME COLUMN a TO b;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets RENAME TO gadgets;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets ALTER COLUMN size TYPE smallint;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets ALTER COLUMN size SET DATA TYPE smallint;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("DROP SCHEMA hero CASCADE;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("DROP INDEX IF EXISTS widgets_idx;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("DROP VIEW v;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("DROP TYPE t;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("DROP FUNCTION helper();"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("drop   table\n widgets;"), ["DESTRUCTIVE"], "case and whitespace do not hide a statement");
  assert.deepEqual(rulesOf("SELECT 'DROP TABLE widgets';\n-- DROP TABLE widgets;\n/* DROP TABLE widgets; */"), [], "text inside strings and comments is not a statement");
});

test("a named constraint may be re-created in the same file but not dropped for good", () => {
  assert.deepEqual(rulesOf("ALTER TABLE widgets DROP CONSTRAINT IF EXISTS widgets_kind_check;\nALTER TABLE widgets ADD CONSTRAINT widgets_kind_check CHECK (kind IN ('a','b'));"), []);
  assert.deepEqual(rulesOf("ALTER TABLE widgets DROP CONSTRAINT widgets_kind_check;"), ["DESTRUCTIVE"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets DROP CONSTRAINT widgets_kind_check;\nALTER TABLE widgets ADD CONSTRAINT other_check CHECK (true);"), ["DESTRUCTIVE"]);
});

test("data changes, non-idempotent creates and unsafe new columns are rejected", () => {
  assert.deepEqual(rulesOf("UPDATE widgets SET a = 1;"), ["DATA_MUTATION"]);
  assert.deepEqual(rulesOf("DELETE FROM widgets;"), ["DATA_MUTATION"]);
  assert.deepEqual(rulesOf("CREATE TABLE widgets (id text);"), ["NOT_IDEMPOTENT"]);
  assert.deepEqual(rulesOf("CREATE INDEX widgets_idx ON widgets (id);"), ["NOT_IDEMPOTENT"]);
  assert.deepEqual(rulesOf("CREATE UNIQUE INDEX widgets_idx ON widgets (id);"), ["NOT_IDEMPOTENT"]);
  assert.deepEqual(rulesOf("CREATE FUNCTION f() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;"), ["NOT_IDEMPOTENT"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets ADD COLUMN name text;"), ["NOT_IDEMPOTENT"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets ADD COLUMN IF NOT EXISTS name text NOT NULL;"), ["NOT_NULL"]);
  assert.deepEqual(rulesOf("ALTER TABLE widgets ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';"), []);
  assert.deepEqual(rulesOf("ALTER TABLE widgets ADD COLUMN IF NOT EXISTS name text;"), []);
  assert.deepEqual(rulesOf("ALTER TABLE widgets ADD COLUMN IF NOT EXISTS a text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS b integer NOT NULL;"), ["NOT_NULL"], "each column in a multi-column ALTER is judged");
  assert.deepEqual(rulesOf("CREATE TABLE IF NOT EXISTS widgets (id text);\nCREATE INDEX IF NOT EXISTS widgets_idx ON widgets (id);\nCREATE OR REPLACE FUNCTION f() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;"), []);
});

test("triggers must be re-creatable, and an append-only guard can never be dropped, disabled or hollowed out", () => {
  const guard = "CREATE OR REPLACE FUNCTION hero_reject_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'no'; END; $$;\n";
  const create = "CREATE TRIGGER events_append_only_guard BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION hero_reject_append_only_mutation();\n";
  assert.deepEqual(rulesOf(`${guard}DROP TRIGGER IF EXISTS events_append_only_guard ON events;\n${create}`), [], "the shipped pattern");
  assert.deepEqual(rulesOf("DROP TRIGGER IF EXISTS events_append_only_guard ON events;"), ["GUARD"], "dropping an append-only guard");
  assert.deepEqual(rulesOf("DROP TRIGGER events_append_only_guard ON events;"), ["DESTRUCTIVE", "GUARD"].sort(), "no IF EXISTS plus a missing re-create");
  assert.deepEqual(rulesOf("ALTER TABLE events DISABLE TRIGGER events_append_only_guard;"), ["GUARD"]);
  assert.deepEqual(rulesOf("ALTER TABLE events DISABLE TRIGGER ALL;"), ["GUARD"]);
  assert.deepEqual(rulesOf("DROP FUNCTION hero_reject_append_only_mutation();"), ["GUARD"]);
  assert.deepEqual(rulesOf("CREATE OR REPLACE FUNCTION hero_reject_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;"), ["GUARD"], "a guard that no longer raises");
  assert.deepEqual(rulesOf(`DROP TRIGGER IF EXISTS events_append_only_guard ON events;\nCREATE TRIGGER events_append_only_guard BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION some_other_function();`), ["GUARD"], "re-created with a different function");
  assert.deepEqual(rulesOf(create), ["NOT_IDEMPOTENT"], "a trigger created without the preceding drop");
  assert.deepEqual(rulesOf("DROP TRIGGER IF EXISTS widgets_touch ON widgets;\nCREATE TRIGGER widgets_touch BEFORE UPDATE ON widgets FOR EACH ROW EXECUTE FUNCTION touch();"), []);
});

test("numbering must be contiguous, unique and well named", () => {
  assert.equal(lintFiles({ "001_one.sql": GOOD, "002_two.sql": GOOD, "003_three.sql": GOOD }).ok, true);
  const gap = lintFiles({ "001_one.sql": GOOD, "003_three.sql": GOOD });
  assert.ok(gap.findings.some(item => item.rule === "NUMBERING" && /expected number 002/.test(item.message)));
  const duplicate = lintFiles({ "001_one.sql": GOOD, "001_uno.sql": GOOD });
  assert.ok(duplicate.findings.some(item => item.rule === "NUMBERING" && /duplicate/.test(item.message)));
  assert.ok(lintFiles({ "001_One.sql": GOOD }).findings.some(item => /must match/.test(item.message)));
  assert.ok(lintFiles({ "01_one.sql": GOOD }).findings.some(item => /must match/.test(item.message)));
  assert.ok(lintFiles({ "002_two.sql": GOOD }).findings.some(item => /expected number 001/.test(item.message)));
  assert.ok(lintFiles({}).findings.some(item => /no migrations/.test(item.message)));
});

test("a probe migration with DROP COLUMN or a dropped append-only trigger fails the whole directory", () => {
  const dropColumn = lintFiles({ "001_one.sql": GOOD, "002_probe.sql": "ALTER TABLE widgets DROP COLUMN created_at;\n" });
  assert.equal(dropColumn.ok, false);
  assert.deepEqual(dropColumn.findings.map(item => `${item.file}:${item.rule}`), ["002_probe.sql:DESTRUCTIVE"]);
  assert.equal(dropColumn.findings[0].line, 1);
  const dropGuard = lintFiles({ "001_one.sql": GOOD, "002_probe.sql": "DROP TRIGGER IF EXISTS events_append_only_guard ON events;\n" });
  assert.equal(dropGuard.ok, false);
  assert.equal(dropGuard.findings[0].rule, "GUARD");
});

test("an annotated exception needs a real rule, reason and owner, and an unused one is an error", () => {
  const ok = lintFiles({ "001_one.sql": GOOD, "002_backfill.sql": '-- hero-migration-allow: DATA_MUTATION reason="one-time backfill of the new column" owner="hero-data"\nUPDATE widgets SET created_at = now() WHERE created_at IS NULL;\n' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.excused.map(item => `${item.rule}:${item.via}:${item.owner}`), ["DATA_MUTATION:annotation:hero-data"]);
  const wrongRule = lintFiles({ "001_one.sql": GOOD, "002_x.sql": '-- hero-migration-allow: DESTRUCTIVE reason="not the rule that applies here" owner="hero-data"\nUPDATE widgets SET a = 1;\n' });
  assert.equal(wrongRule.ok, false, "an exception for another rule does not excuse this statement");
  assert.ok(wrongRule.findings.some(item => item.rule === "DATA_MUTATION") && wrongRule.findings.some(item => item.rule === "STALE_EXCEPTION"));
  assert.ok(lintFiles({ "001_one.sql": GOOD, "002_x.sql": '-- hero-migration-allow: DATA_MUTATION reason="short" owner="hero-data"\nUPDATE widgets SET a = 1;\n' }).findings.some(item => /reason/.test(item.message)));
  assert.ok(lintFiles({ "001_one.sql": GOOD, "002_x.sql": '-- hero-migration-allow: DATA_MUTATION reason="long enough reason here" owner=""\nUPDATE widgets SET a = 1;\n' }).findings.some(item => /owner/.test(item.message)));
  assert.ok(lintFiles({ "001_one.sql": GOOD, "002_x.sql": "-- hero-migration-allow: DATA_MUTATION\nUPDATE widgets SET a = 1;\n" }).findings.some(item => /malformed/.test(item.message)));
  assert.ok(lintFiles({ "001_one.sql": GOOD, "002_x.sql": '-- hero-migration-allow: NUMBERING reason="cannot excuse numbering" owner="hero-data"\n' + GOOD }).findings.some(item => /unknown or unexcusable/.test(item.message)));
  assert.ok(lintFiles({ "001_one.sql": GOOD, "002_x.sql": '-- hero-migration-allow: DATA_MUTATION reason="nothing to excuse here" owner="hero-data"\n' + GOOD }).findings.some(item => /does not excuse/.test(item.message)));
  const far = lintFiles({ "001_one.sql": GOOD, "002_x.sql": '-- hero-migration-allow: DATA_MUTATION reason="written far above the statement" owner="hero-data"\n\n\n\n\n\nUPDATE widgets SET a = 1;\n' });
  assert.equal(far.ok, false, "the annotation must sit right above the statement");
});

test("registry exceptions cover shipped migrations that must not be edited, and stale entries fail", () => {
  const files = { "001_one.sql": GOOD, "002_old.sql": "UPDATE widgets SET a = 1;\n" };
  const entry = { file: "002_old.sql", rule: "DATA_MUTATION", contains: "UPDATE widgets", reason: "historic backfill that already ran", owner: "hero-data" };
  const covered = lintFiles(files, { exceptions: [entry] });
  assert.equal(covered.ok, true);
  assert.equal(covered.excused[0].via, "registry");
  assert.equal(lintFiles(files, { exceptions: [{ ...entry, contains: "UPDATE other" }] }).ok, false);
  assert.ok(lintFiles({ "001_one.sql": GOOD }, { exceptions: [entry] }).findings.some(item => /unknown file/.test(item.message)));
  assert.ok(lintFiles(files, { exceptions: [entry, { ...entry }] }).findings.some(item => /excuses nothing/.test(item.message)), "a duplicate registry entry is stale");
  assert.ok(lintFiles(files, { exceptions: [{ ...entry, reason: "short" }] }).findings.some(item => /reason too short/.test(item.message)));
  assert.ok(lintFiles(files, { exceptions: [{ ...entry, rule: "NUMBERING" }] }).findings.some(item => /unknown rule/.test(item.message)));
  assert.ok(lintFiles(files, { exceptions: [{ ...entry, contains: "x" }] }).findings.some(item => /fingerprint/.test(item.message)));
  assert.ok(lintFiles({ "001_one.sql": GOOD }, { exceptions: [{ file: "001_one.sql", rule: "DATA_MUTATION", contains: "UPDATE nothing", reason: "stale entry nobody needs", owner: "hero-data" }] }).findings.some(item => /excuses nothing/.test(item.message)));
  assert.deepEqual(MIGRATION_RULES.length, 6);
});
