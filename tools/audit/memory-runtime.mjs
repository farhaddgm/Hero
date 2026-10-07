// An in-memory stand-in for the PostgreSQL runtime with the same store contracts
// (append-only, listRecords). It lets backup, restore, transfer and replay be
// rehearsed against a real Hero server without a database.
export function createMemoryRuntime({ failing = () => false } = {}) {
  const domain = []; const command = []; const catalog = []; const collaboration = [];
  const guard = () => { if (failing()) { const error = new Error("simulated database outage"); error.code = "ECONNRESET"; throw error; } };
  const uniqueness = (rows, same, record) => { if (rows.some(row => same(row, record))) { const error = new Error("duplicate key"); error.code = "23505"; throw error; } };
  const stamp = record => ({ ...structuredClone(record), recordedAt: record.recordedAt ?? new Date().toISOString() });
  return {
    async ping() { return true; },
    // Projects, settings and inputs are rebuilt by the fixture; only list/read calls must succeed here.
    projectWorkspace: new Proxy({}, { get: (_target, name) => typeof name === "string" && name !== "then" ? async () => (/^(list|read)/.test(name) ? [] : {}) : undefined }),
    domainRecords: { async appendRecord(name, record) { guard(); uniqueness(domain, (row, next) => row.domain === name && row.kind === next.kind && row.key === next.key && row.version === next.version, record); domain.push({ domain: name, ...stamp(record) }); return record; }, async listRecords(name) { return domain.filter(row => row.domain === name).map(({ domain: _ignored, ...rest }) => structuredClone(rest)); } },
    commandCenter: { async appendRecord(record) { guard(); uniqueness(command, (row, next) => row.kind === next.kind && row.key === next.key && row.version === next.version, record); command.push(stamp(record)); return record; }, async listRecords() { return command.map(row => structuredClone(row)); } },
    systemCatalog: { async appendRecord(record) { guard(); uniqueness(catalog, (row, next) => row.kind === next.kind && row.key === next.key && row.version === next.version, record); catalog.push(stamp(record)); return record; }, async listRecords() { return catalog.map(row => structuredClone(row)); } },
    collaboration: { async appendRecord(record) { guard(); uniqueness(collaboration, (row, next) => row.recordId === next.recordId, record); collaboration.push(stamp(record)); return record; }, async listRecords() { return collaboration.map(row => structuredClone(row)); } },
    size() { return domain.length + command.length + catalog.length + collaboration.length; }
  };
}
