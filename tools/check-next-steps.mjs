import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REPO_ROOT } from "./fs-policy.mjs";

const REGISTRY = "config/product-development/next-50-steps-v1.json";
const DOCUMENT_REGISTRY = "docs/registry/document-registry.json";
const REQUIREMENT_TRACE = "config/backoffice/requirement-trace-v1.0.json";
const AGENT_READINESS = "docs/roadmap/AGENT-READINESS-GOLDEN-PATH-20261009.md";

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const STEP_ID = /^NX-\d{3}$/;
const EXTERNAL_REFERENCE = /^(AR-\d{2}|ADR-\d{4}|BO-[A-Z]+-\d{3}|HERO-\d{3})$/;
const GATES = ["offline", "test-runtime", "gated-live"];
const PRIORITIES = ["P0", "P1", "P2"];
const SIZES = ["S", "M", "L"];
const WAVES = [1, 2, 3, 4];
const STATUSES = ["proposed", "authorized", "in_progress", "source_complete", "verified", "dropped"];
const EVIDENCE_STATUSES = new Set(["source_complete", "verified"]);

function add(errors, code, subject, detail) {
  errors.push({ code, subject, detail });
}

function readJson(root, relativePath, errors) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    add(errors, "MISSING_FILE", relativePath, "required file does not exist");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    add(errors, "INVALID_JSON", relativePath, error.message);
    return null;
  }
}

function readText(root, relativePath, errors) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    add(errors, "MISSING_FILE", relativePath, "required file does not exist");
    return null;
  }
  return fs.readFileSync(absolute, "utf8");
}

function countBy(items, key) {
  const result = {};
  for (const item of items) result[item[key]] = (result[item[key]] ?? 0) + 1;
  return result;
}

function sortedEntries(object) {
  return Object.fromEntries(Object.entries(object ?? {}).sort(([a], [b]) => a.localeCompare(b)));
}

function sameJson(a, b) {
  return JSON.stringify(sortedEntries(a)) === JSON.stringify(sortedEntries(b));
}

function validateSteps(registry, errors) {
  const steps = Array.isArray(registry.steps) ? registry.steps : [];
  const trackKeys = new Set((registry.tracks ?? []).map(track => track.key));
  const byId = new Map();

  if (!Array.isArray(registry.steps)) add(errors, "INVALID_STEPS", REGISTRY, "steps must be an array");
  if (registry.expected_total !== steps.length) {
    add(errors, "STEP_COUNT_MISMATCH", REGISTRY, `expected_total=${registry.expected_total} but registry has ${steps.length} steps; a removed step must be marked dropped, not deleted`);
  }

  steps.forEach((step, index) => {
    const id = typeof step?.id === "string" ? step.id : `index-${index}`;
    if (!STEP_ID.test(id)) add(errors, "INVALID_STEP_ID", id, "id must match NX-###");
    const expected = `NX-${String(index + 1).padStart(3, "0")}`;
    if (id !== expected) add(errors, "NON_CONTIGUOUS_STEP_ID", id, `expected ${expected} at position ${index + 1}`);
    if (byId.has(id)) add(errors, "DUPLICATE_STEP_ID", id, "step id must be unique");
    byId.set(id, step);

    if (typeof step.title !== "string" || step.title.trim() === "") add(errors, "INVALID_TITLE", id, "title is required");
    if (!trackKeys.has(step.track)) add(errors, "UNKNOWN_TRACK", id, String(step.track));
    if (!WAVES.includes(step.wave)) add(errors, "INVALID_WAVE", id, String(step.wave));
    if (!PRIORITIES.includes(step.priority)) add(errors, "INVALID_PRIORITY", id, String(step.priority));
    if (!SIZES.includes(step.size)) add(errors, "INVALID_SIZE", id, String(step.size));
    if (!GATES.includes(step.gate)) add(errors, "INVALID_GATE", id, String(step.gate));
    if (!STATUSES.includes(step.status)) add(errors, "INVALID_STATUS", id, String(step.status));
    if (!Array.isArray(step.depends_on)) add(errors, "INVALID_DEPENDENCIES", id, "depends_on must be an array");
    if (typeof step.needs_owner_input !== "boolean") add(errors, "INVALID_OWNER_INPUT_FLAG", id, "needs_owner_input must be boolean");
    if (!Array.isArray(step.evidence)) add(errors, "INVALID_EVIDENCE", id, "evidence must be an array");
  });

  return { steps, byId };
}

function validateDependencies(root, steps, byId, errors) {
  const requirementTrace = readJson(root, REQUIREMENT_TRACE, errors);
  const requirementIds = new Set((requirementTrace?.requirements ?? []).map(item => item.id));
  const readiness = readText(root, AGENT_READINESS, errors) ?? "";
  const decisionsDir = path.join(root, "docs", "decisions");
  const decisionFiles = fs.existsSync(decisionsDir) ? fs.readdirSync(decisionsDir) : [];

  for (const step of steps) {
    const seen = new Set();
    for (const dependency of Array.isArray(step.depends_on) ? step.depends_on : []) {
      if (seen.has(dependency)) add(errors, "DUPLICATE_DEPENDENCY", step.id, dependency);
      seen.add(dependency);
      if (dependency === step.id) {
        add(errors, "SELF_DEPENDENCY", step.id, dependency);
      } else if (STEP_ID.test(dependency)) {
        const target = byId.get(dependency);
        if (!target) add(errors, "UNKNOWN_DEPENDENCY", step.id, dependency);
        else if (WAVES.includes(step.wave) && WAVES.includes(target.wave) && target.wave >= step.wave) {
          add(errors, "WAVE_ORDER_VIOLATION", step.id, `${dependency} is in wave ${target.wave} but ${step.id} is in wave ${step.wave}; a step must come in a later wave than every NX dependency`);
        }
      } else if (!EXTERNAL_REFERENCE.test(dependency)) {
        add(errors, "INVALID_DEPENDENCY_REFERENCE", step.id, dependency);
      } else if (dependency.startsWith("AR-")) {
        if (!new RegExp(`\\|\\s*${dependency}\\s*\\|`).test(readiness)) add(errors, "UNKNOWN_AR_REFERENCE", step.id, dependency);
      } else if (dependency.startsWith("ADR-")) {
        if (!decisionFiles.some(file => file.startsWith(`${dependency}-`))) add(errors, "UNKNOWN_ADR_REFERENCE", step.id, dependency);
      } else if (dependency.startsWith("HERO-")) {
        if (!fs.existsSync(path.join(root, "docs", "specs", `${dependency}-v1.0.md`))) add(errors, "UNKNOWN_SPEC_REFERENCE", step.id, dependency);
      } else if (!requirementIds.has(dependency)) {
        add(errors, "UNKNOWN_REQUIREMENT_REFERENCE", step.id, dependency);
      }
    }
  }

  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "active") {
      add(errors, "DEPENDENCY_CYCLE", id, [...trail, id].join(" -> "));
      return;
    }
    state.set(id, "active");
    for (const dependency of byId.get(id)?.depends_on ?? []) {
      if (byId.has(dependency)) visit(dependency, [...trail, id]);
    }
    state.set(id, "done");
  };
  for (const id of byId.keys()) visit(id, []);
}

function validateStatusEvidence(root, steps, errors) {
  for (const step of steps) {
    const evidence = Array.isArray(step.evidence) ? step.evidence : [];
    if (EVIDENCE_STATUSES.has(step.status) && evidence.length === 0) {
      add(errors, "STATUS_WITHOUT_EVIDENCE", step.id, `${step.status} requires at least one repository evidence path`);
    }
    for (const item of evidence) {
      const normalized = typeof item === "string" ? path.posix.normalize(item) : "";
      if (typeof item !== "string" || normalized !== item || item.startsWith("/") || item.includes("..") || !fs.existsSync(path.join(root, item))) {
        add(errors, "INVALID_EVIDENCE_PATH", step.id, String(item));
      }
    }
    if (step.status === "verified" && step.gate !== "offline" && !evidence.some(item => typeof item === "string" && item.startsWith("docs/evidence/"))) {
      add(errors, "VERIFIED_WITHOUT_RUNTIME_EVIDENCE", step.id, `${step.gate} steps need a docs/evidence/ record of the real run before they are verified`);
    }
  }
}

function validateSummary(registry, steps, errors) {
  const summary = registry.summary ?? {};
  const expected = {
    total: steps.length,
    by_track: countBy(steps, "track"),
    by_wave: countBy(steps, "wave"),
    by_priority: countBy(steps, "priority"),
    by_gate: countBy(steps, "gate"),
    by_status: countBy(steps, "status")
  };
  if (summary.total !== expected.total) add(errors, "SUMMARY_MISMATCH", "summary.total", `declared ${summary.total}, computed ${expected.total}`);
  for (const key of ["by_track", "by_wave", "by_priority", "by_gate", "by_status"]) {
    if (!sameJson(summary[key], expected[key])) add(errors, "SUMMARY_MISMATCH", `summary.${key}`, `declared ${JSON.stringify(summary[key])}, computed ${JSON.stringify(expected[key])}`);
  }
}

function expectedDocumentStatus(registry) {
  return registry.status === "approved" ? "active" : "proposed";
}

function parseCards(text) {
  const lines = text.split(/\r?\n/);
  const cards = new Map();
  const duplicates = [];
  let current = null;
  let fenced = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const heading = line.match(/^### (NX-\d{3}) — (.+?)\s*$/);
    if (heading) {
      if (cards.has(heading[1])) duplicates.push(heading[1]);
      current = { id: heading[1], title: heading[2], fields: {}, ownerInput: false };
      cards.set(heading[1], current);
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;
    const field = line.match(/^\| (موج|اولویت|اندازه|گیت تأیید|وابستگی|وضعیت) \| (.*?) \|\s*$/);
    if (field) current.fields[field[1]] = field[2];
    if (line.startsWith("**ورودی لازم از مالک.**")) current.ownerInput = true;
  }
  return { cards, duplicates };
}

function dependencyTokens(cell) {
  return [...(cell ?? "").matchAll(/`([^`]+)`/g)].map(match => match[1]);
}

function validateTrackDocuments(root, registry, steps, documentRegistry, errors) {
  const documents = new Map((documentRegistry?.documents ?? []).map(document => [document.id, document]));
  const seenCards = new Set();
  for (const track of registry.tracks ?? []) {
    const trackSteps = steps.filter(step => step.track === track.key);
    const registered = documents.get(track.document_id);
    if (!registered) add(errors, "UNREGISTERED_TRACK_DOCUMENT", track.key, track.document_id);
    else if (registered.path !== track.document_path) add(errors, "TRACK_DOCUMENT_PATH_MISMATCH", track.key, `${registered.path} != ${track.document_path}`);
    else if (registered.status !== expectedDocumentStatus(registry)) add(errors, "TRACK_DOCUMENT_STATUS_MISMATCH", track.key, `plan status ${registry.status} requires document status ${expectedDocumentStatus(registry)}, found ${registered.status}`);
    const text = readText(root, track.document_path, errors);
    if (text === null) continue;
    if (!text.includes(`Document ID: \`${track.document_id}\``)) add(errors, "TRACK_DOCUMENT_ID_MISSING", track.key, track.document_id);
    const { cards, duplicates } = parseCards(text);
    for (const id of duplicates) add(errors, "DUPLICATE_CARD", id, track.document_path);
    for (const step of trackSteps) {
      const card = cards.get(step.id);
      if (!card) {
        add(errors, "MISSING_CARD", step.id, track.document_path);
        continue;
      }
      seenCards.add(step.id);
      if (card.title !== step.title) add(errors, "CARD_TITLE_MISMATCH", step.id, `${card.title} != ${step.title}`);
      const expectations = [
        ["موج", String(step.wave)],
        ["اولویت", step.priority],
        ["اندازه", step.size],
        ["گیت تأیید", `\`${step.gate}\``],
        ["وضعیت", `\`${step.status}\``]
      ];
      for (const [label, value] of expectations) {
        if (card.fields[label] !== value) add(errors, "CARD_FIELD_MISMATCH", step.id, `${label}: card has ${card.fields[label]}, registry has ${value}`);
      }
      const cardDependencies = dependencyTokens(card.fields["وابستگی"]);
      if (JSON.stringify(cardDependencies) !== JSON.stringify(step.depends_on ?? [])) {
        add(errors, "CARD_DEPENDENCY_MISMATCH", step.id, `card [${cardDependencies.join(", ")}] != registry [${(step.depends_on ?? []).join(", ")}]`);
      }
      if (card.ownerInput !== Boolean(step.needs_owner_input)) add(errors, "CARD_OWNER_INPUT_MISMATCH", step.id, `card=${card.ownerInput}, registry=${Boolean(step.needs_owner_input)}`);
    }
    for (const id of cards.keys()) {
      if (!trackSteps.some(step => step.id === id)) add(errors, "CARD_IN_WRONG_TRACK", id, track.document_path);
    }
  }
  for (const step of steps) {
    if (!seenCards.has(step.id)) add(errors, "STEP_WITHOUT_CARD", step.id, "no card found in any track document");
  }
}

function validateRoadmapDocument(root, registry, steps, documentRegistry, errors) {
  const document = (documentRegistry?.documents ?? []).find(item => item.id === registry.roadmap_document_id);
  if (!document) add(errors, "UNREGISTERED_ROADMAP_DOCUMENT", REGISTRY, registry.roadmap_document_id);
  else if (document.path !== registry.roadmap_document_path) add(errors, "ROADMAP_DOCUMENT_PATH_MISMATCH", REGISTRY, `${document.path} != ${registry.roadmap_document_path}`);
  else if (document.status !== expectedDocumentStatus(registry)) {
    add(errors, "ROADMAP_STATUS_MISMATCH", registry.roadmap_document_id, `plan status ${registry.status} requires document status ${expectedDocumentStatus(registry)}, found ${document.status}`);
  }
  const text = readText(root, registry.roadmap_document_path, errors);
  if (text === null) return;
  const rows = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\| (NX-\d{3}) \| (.+?) \| ([A-E]) \| (\d) \| (P\d) \| ([SML]) \| `([a-z-]+)` \|/);
    if (match) rows.set(match[1], { title: match[2], track: match[3], wave: Number(match[4]), priority: match[5], size: match[6], gate: match[7] });
  }
  for (const step of steps) {
    const row = rows.get(step.id);
    if (!row) {
      add(errors, "STEP_MISSING_FROM_ROADMAP_TABLE", step.id, registry.roadmap_document_path);
      continue;
    }
    for (const key of ["title", "track", "wave", "priority", "size", "gate"]) {
      if (row[key] !== step[key]) add(errors, "ROADMAP_TABLE_MISMATCH", step.id, `${key}: table has ${row[key]}, registry has ${step[key]}`);
    }
  }
  for (const id of rows.keys()) {
    if (!steps.some(step => step.id === id)) add(errors, "UNKNOWN_STEP_IN_ROADMAP_TABLE", id, registry.roadmap_document_path);
  }
}

export function validateNextSteps({ root = REPO_ROOT, registry: override } = {}) {
  const errors = [];
  const registry = override ?? readJson(root, REGISTRY, errors);
  if (!registry) return { steps: 0, tracks: 0, errors };

  if (!SEMVER.test(registry.schema_version ?? "")) add(errors, "INVALID_SCHEMA_VERSION", REGISTRY, "schema_version must be SemVer");
  if (registry.prefix !== "NX") add(errors, "INVALID_PREFIX", REGISTRY, String(registry.prefix));
  if (!["proposed", "approved"].includes(registry.status)) add(errors, "INVALID_PLAN_STATUS", REGISTRY, String(registry.status));
  if (!Array.isArray(registry.tracks) || registry.tracks.length === 0) {
    add(errors, "INVALID_TRACKS", REGISTRY, "tracks must be a non-empty array");
    return { steps: 0, tracks: 0, errors };
  }
  for (const gate of GATES) {
    if (typeof registry.gate_classes?.[gate] !== "string" || registry.gate_classes[gate].trim() === "") add(errors, "MISSING_GATE_DEFINITION", REGISTRY, gate);
  }

  const { steps, byId } = validateSteps(registry, errors);
  validateDependencies(root, steps, byId, errors);
  validateStatusEvidence(root, steps, errors);
  validateSummary(registry, steps, errors);

  const documentRegistry = readJson(root, DOCUMENT_REGISTRY, errors);
  validateTrackDocuments(root, registry, steps, documentRegistry, errors);
  validateRoadmapDocument(root, registry, steps, documentRegistry, errors);

  errors.sort((a, b) => `${a.code}:${a.subject}`.localeCompare(`${b.code}:${b.subject}`));
  return { steps: steps.length, tracks: registry.tracks.length, errors };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === invokedFile) {
  const report = validateNextSteps();
  for (const error of report.errors) console.error(`ERROR ${error.code} subject=${error.subject} detail=${error.detail}`);
  console.log(`Next-50 steps: ${report.errors.length === 0 ? "PASS" : "FAIL"} — ${report.steps} steps, ${report.tracks} tracks, ${report.errors.length} error(s)`);
  if (report.errors.length > 0) process.exitCode = 1;
}
