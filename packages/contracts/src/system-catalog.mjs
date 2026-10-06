export const SYSTEM_CATALOG_CONTRACT_VERSION = "1.1";
export const SYSTEM_ENTITY_TYPES = Object.freeze(["project", "application", "component", "service", "repository", "api", "data", "environment", "server"]);
export const SYSTEM_ENTITY_LIFECYCLES = Object.freeze(["planned", "active", "deprecated", "retired"]);
export const SYSTEM_RECORD_KINDS = Object.freeze(["entity", "dependency", "inventory", "drift-proposal", "knowledge"]);

/** BO-089: allowed lifecycle moves. Retired is terminal; a planned sketch may be dropped. */
export const SYSTEM_LIFECYCLE_TRANSITIONS = Object.freeze({
  planned: Object.freeze(["active", "retired"]),
  active: Object.freeze(["deprecated"]),
  deprecated: Object.freeze(["active", "retired"]),
  retired: Object.freeze([])
});

/** BO-089/090: a planned entity may be a sketch; activation needs the type's
 * required metadata. Enumerated fields are always validated when present. */
export const SYSTEM_ENTITY_RULES = Object.freeze({
  project: Object.freeze({ requiredForActive: Object.freeze([]), enums: Object.freeze({}) }),
  application: Object.freeze({ requiredForActive: Object.freeze(["owner"]), enums: Object.freeze({}) }),
  component: Object.freeze({ requiredForActive: Object.freeze([]), enums: Object.freeze({}) }),
  service: Object.freeze({ requiredForActive: Object.freeze(["owner"]), enums: Object.freeze({}) }),
  repository: Object.freeze({ requiredForActive: Object.freeze(["provider", "defaultBranch"]), enums: Object.freeze({ provider: Object.freeze(["github", "gitlab", "local"]) }) }),
  api: Object.freeze({ requiredForActive: Object.freeze(["protocol"]), enums: Object.freeze({ protocol: Object.freeze(["http", "grpc", "graphql", "event"]) }) }),
  data: Object.freeze({ requiredForActive: Object.freeze(["classification"]), enums: Object.freeze({ classification: Object.freeze(["public", "internal", "confidential", "restricted"]) }) }),
  environment: Object.freeze({ requiredForActive: Object.freeze(["tier"]), enums: Object.freeze({ tier: Object.freeze(["development", "test", "staging", "production"]) }) }),
  server: Object.freeze({ requiredForActive: Object.freeze(["environment"]), enums: Object.freeze({}) })
});

const ANY_SYSTEM = Object.freeze(SYSTEM_ENTITY_TYPES.filter(type => type !== "project"));
/** Allowed relation → [from types, to types]. Acyclic relations may not form a loop. */
export const SYSTEM_DEPENDENCY_RELATIONS = Object.freeze({
  "depends-on": Object.freeze({ from: ANY_SYSTEM, to: ANY_SYSTEM, acyclic: true }),
  contains: Object.freeze({ from: Object.freeze(["project", "application", "service"]), to: Object.freeze(["application", "component", "service", "repository", "api", "data"]), acyclic: true }),
  "hosted-on": Object.freeze({ from: Object.freeze(["application", "service", "component", "data"]), to: Object.freeze(["server"]), acyclic: true }),
  "deploys-to": Object.freeze({ from: Object.freeze(["application", "service", "repository"]), to: Object.freeze(["environment"]), acyclic: true }),
  "runs-in": Object.freeze({ from: Object.freeze(["server"]), to: Object.freeze(["environment"]), acyclic: true }),
  exposes: Object.freeze({ from: Object.freeze(["application", "service", "component"]), to: Object.freeze(["api"]), acyclic: true }),
  reads: Object.freeze({ from: Object.freeze(["application", "service", "component"]), to: Object.freeze(["data"]), acyclic: false }),
  writes: Object.freeze({ from: Object.freeze(["application", "service", "component"]), to: Object.freeze(["data"]), acyclic: false }),
  "built-from": Object.freeze({ from: Object.freeze(["application", "service", "component"]), to: Object.freeze(["repository"]), acyclic: true })
});

/** BO-091: observed metadata arrives as an offline snapshot. A live GitHub call is
 * a separate authorization and is never made by the catalog itself. */
export const SYSTEM_DISCOVERY_SOURCES = Object.freeze(["github-snapshot", "local-manifest"]);
export const SYSTEM_DRIFT_RESOLUTIONS = Object.freeze(["adopt-observed", "fix-source", "reject"]);

export function getSystemCatalogContractSummary() {
  return Object.freeze({
    version: SYSTEM_CATALOG_CONTRACT_VERSION,
    entityTypes: SYSTEM_ENTITY_TYPES,
    lifecycle: SYSTEM_ENTITY_LIFECYCLES,
    transitions: SYSTEM_LIFECYCLE_TRANSITIONS,
    rules: SYSTEM_ENTITY_RULES,
    relations: Object.fromEntries(Object.entries(SYSTEM_DEPENDENCY_RELATIONS).map(([relation, rule]) => [relation, { from: rule.from, to: rule.to, acyclic: rule.acyclic }])),
    discoverySources: SYSTEM_DISCOVERY_SOURCES,
    liveDiscovery: "github-live-call requires a separate authorization; the catalog only ingests offline snapshots",
    drift: { resolutions: SYSTEM_DRIFT_RESOLUTIONS, overwrite: "forbidden", staleWhenEntityVersionChanges: true },
    sourceOfTruth: "Git is canonical; Notion remains projection/proposal only"
  });
}

export function validateSystemCatalogContract() {
  const errors = [];
  if (SYSTEM_CATALOG_CONTRACT_VERSION !== "1.1") errors.push("Unexpected System Catalog contract version.");
  if (SYSTEM_ENTITY_TYPES.length !== 9) errors.push("System Catalog must define nine entity types.");
  for (const type of SYSTEM_ENTITY_TYPES) if (!SYSTEM_ENTITY_RULES[type]) errors.push(`${type} has no rule.`);
  for (const lifecycle of SYSTEM_ENTITY_LIFECYCLES) if (!SYSTEM_LIFECYCLE_TRANSITIONS[lifecycle]) errors.push(`${lifecycle} has no transitions.`);
  if (SYSTEM_LIFECYCLE_TRANSITIONS.retired.length) errors.push("Retired must be terminal.");
  for (const [relation, rule] of Object.entries(SYSTEM_DEPENDENCY_RELATIONS)) for (const type of [...rule.from, ...rule.to]) if (!SYSTEM_ENTITY_TYPES.includes(type)) errors.push(`${relation} names unknown type ${type}.`);
  return errors;
}
