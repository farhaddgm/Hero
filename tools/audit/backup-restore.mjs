// BO-154/BO-163: logical backup, verified restore and transfer of the Back Office
// control-plane records. Records are append-only, so a backup is a set of immutable
// rows with a digest per section and one manifest digest. A restore refuses a
// non-empty target, verifies every digest before writing and compares source and
// target afterwards. What is NOT covered is stated in the bundle itself.
import { createRecorder, sha256 } from "../acceptance/audit-lib.mjs";

export const BACKUP_FORMAT = "hero.control-plane-backup/v1";
export const BACKUP_EXCLUDES = Object.freeze(["identity credentials and MFA secrets", "Secret Store values", "private object bytes (uploaded files)", "owner sessions", "container images (kept by digest in the registry)"]);
const DOMAIN_NAMES = ["performance", "notifications", "hardening", "readiness"];
const SECTIONS = Object.freeze([
  ...DOMAIN_NAMES.map(name => ({ name: `domain:${name}`, read: runtime => runtime.domainRecords.listRecords(name), write: (runtime, record) => runtime.domainRecords.appendRecord(name, record) })),
  { name: "command-center", read: runtime => runtime.commandCenter.listRecords(), write: (runtime, record) => runtime.commandCenter.appendRecord(record) },
  { name: "system-catalog", read: runtime => runtime.systemCatalog.listRecords(), write: (runtime, record) => runtime.systemCatalog.appendRecord(record) },
  { name: "collaboration", read: runtime => runtime.collaboration.listRecords(), write: (runtime, record) => runtime.collaboration.appendRecord(record) }
]);
// A restore inserts rows with new database timestamps; identity is everything else.
const canonical = record => { const { recordedAt: _ignored, ...rest } = record; return JSON.stringify(sortKeys(rest)); };
function sortKeys(value) { if (Array.isArray(value)) return value.map(sortKeys); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])])); }
const sectionDigest = records => sha256([...records].map(canonical).sort());

export async function createBackup({ runtime, now = () => new Date().toISOString() }) {
  const sections = {};
  for (const section of SECTIONS) { const records = (await section.read(runtime)).map(record => structuredClone(record)); sections[section.name] = { count: records.length, digest: sectionDigest(records), records }; }
  const manifest = Object.fromEntries(Object.entries(sections).map(([name, value]) => [name, { count: value.count, digest: value.digest }]));
  return { format: BACKUP_FORMAT, createdAt: now(), excludes: [...BACKUP_EXCLUDES], manifest, manifestDigest: sha256(manifest), sections };
}

/** Recomputes every digest; a single changed, added or removed record is detected. */
export function verifyBackup(bundle) {
  const recorder = createRecorder("tools/audit/backup-restore.verify");
  recorder.check("backup has the expected format", bundle?.format === BACKUP_FORMAT, bundle?.format);
  recorder.check("backup lists exactly the known sections", JSON.stringify(Object.keys(bundle?.sections ?? {}).sort()) === JSON.stringify(SECTIONS.map(section => section.name).sort()));
  for (const section of SECTIONS) {
    const entry = bundle?.sections?.[section.name]; if (!entry) { recorder.check(`${section.name}: present`, false); continue; }
    recorder.check(`${section.name}: record count matches the manifest (${entry.records.length})`, entry.records.length === entry.count && bundle.manifest?.[section.name]?.count === entry.count);
    recorder.check(`${section.name}: digest matches the content`, sectionDigest(entry.records) === entry.digest && bundle.manifest?.[section.name]?.digest === entry.digest);
  }
  recorder.check("manifest digest matches", sha256(bundle?.manifest ?? {}) === bundle?.manifestDigest);
  recorder.check("backup states what it does not cover", Array.isArray(bundle?.excludes) && bundle.excludes.length >= 4);
  return recorder.finish();
}

export class RestoreError extends Error { constructor(code, message) { super(message); this.name = "RestoreError"; this.code = code; } }

/** Verified restore into an EMPTY target. Nothing is written if the backup does not verify or the target holds data. */
export async function restoreBackup({ bundle, runtime }) {
  const verdict = verifyBackup(bundle); if (verdict.checks.passed !== verdict.checks.total) throw new RestoreError("BACKUP_INVALID", `The backup failed verification: ${verdict.findings.join("; ")}`);
  for (const section of SECTIONS) if ((await section.read(runtime)).length > 0) throw new RestoreError("TARGET_NOT_EMPTY", `The target already holds ${section.name} records; restore only into a clean target.`);
  const restored = {};
  for (const section of SECTIONS) { for (const record of bundle.sections[section.name].records) await section.write(runtime, record); restored[section.name] = bundle.sections[section.name].records.length; }
  return restored;
}

/** Counted comparison of two runtimes, section by section. */
export async function compareRuntimes({ source, target }) {
  const recorder = createRecorder("tools/audit/backup-restore.compare");
  for (const section of SECTIONS) { const [a, b] = [await section.read(source), await section.read(target)]; recorder.check(`${section.name}: ${a.length} records, same digest in source and target`, a.length === b.length && sectionDigest(a) === sectionDigest(b), `${a.length} vs ${b.length}`); }
  return recorder.finish();
}

/** Backup then restore into a clean target, returning the counted evidence. */
export async function rehearseTransfer({ source, createTarget, now }) {
  const recorder = createRecorder("tools/audit/backup-restore.rehearsal");
  const bundle = await createBackup({ runtime: source, now }); const verified = verifyBackup(bundle);
  recorder.check(`backup of ${Object.values(bundle.sections).reduce((sum, section) => sum + section.count, 0)} records verifies`, verified.checks.passed === verified.checks.total, verified.findings.join(";"));
  const target = await createTarget();
  await restoreBackup({ bundle, runtime: target });
  const compared = await compareRuntimes({ source, target }); recorder.check("restored target matches the source in every section", compared.checks.passed === compared.checks.total, compared.findings.join(";"));
  let refused = null; try { await restoreBackup({ bundle, runtime: target }); } catch (error) { refused = error.code; }
  recorder.check("a second restore into the now-populated target is refused", refused === "TARGET_NOT_EMPTY", refused);
  const tampered = structuredClone(bundle); const section = Object.values(tampered.sections).find(entry => entry.records.length); if (section) section.records[0].version += 1;
  let tamperRefused = null; try { await restoreBackup({ bundle: tampered, runtime: await createTarget() }); } catch (error) { tamperRefused = error.code; }
  recorder.check("a tampered backup is refused before anything is written", tamperRefused === "BACKUP_INVALID", tamperRefused);
  return { bundle, target, result: recorder.finish() };
}
