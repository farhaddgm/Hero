export const PRODUCT_ROADMAP_CONTRACT_VERSION = "1.0";

export const ROADMAP_NODE_TYPES = Object.freeze([
  "objective",
  "initiative",
  "capability",
  "milestone",
  "release",
  "decision",
  "risk",
  "task"
]);

export const ROADMAP_EDGE_TYPES = Object.freeze([
  "contains",
  "depends-on",
  "enables",
  "conflicts-with",
  "validated-by",
  "delivered-by"
]);

export const ROADMAP_NODE_STATUSES = Object.freeze([
  "idea",
  "planned",
  "in_progress",
  "blocked",
  "done",
  "retired"
]);

export const COMPLETENESS_STAGES = Object.freeze([
  "proposed",
  "discovery",
  "planned",
  "in-development",
  "in-test",
  "production-ready",
  "operating",
  "retiring"
]);

export const COMPLETENESS_SEVERITIES = Object.freeze(["required", "recommended", "advisory"]);

const IDENTIFIER = /^[A-Z][A-Z0-9._:-]{2,127}$/;

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function validateRoadmapGraph(graph) {
  const errors = [];
  if (!isRecord(graph)) return ["graph must be an object."];
  if (typeof graph.schema_version !== "string" || graph.schema_version.length === 0) errors.push("schema_version is required.");
  if (!Array.isArray(graph.nodes)) errors.push("nodes must be an array.");
  if (!Array.isArray(graph.edges)) errors.push("edges must be an array.");
  const nodeIds = new Set();
  for (const node of graph.nodes ?? []) {
    if (!isRecord(node)) {
      errors.push("every node must be an object.");
      continue;
    }
    if (typeof node.id !== "string" || !IDENTIFIER.test(node.id)) errors.push("node.id must be a safe identifier.");
    if (nodeIds.has(node.id)) errors.push(`duplicate roadmap node ${node.id}.`);
    nodeIds.add(node.id);
    if (!ROADMAP_NODE_TYPES.includes(node.type)) errors.push(`node ${node.id ?? "unknown"} has an invalid type.`);
    if (!ROADMAP_NODE_STATUSES.includes(node.status)) errors.push(`node ${node.id ?? "unknown"} has an invalid status.`);
    if (typeof node.title !== "string" || node.title.trim() === "") errors.push(`node ${node.id ?? "unknown"} requires a title.`);
    if (node.product_id !== undefined && (typeof node.product_id !== "string" || !IDENTIFIER.test(node.product_id))) errors.push(`node ${node.id ?? "unknown"} has an invalid product_id.`);
    if (node.evidence !== undefined && (!Array.isArray(node.evidence) || node.evidence.some(value => typeof value !== "string" || !IDENTIFIER.test(value)))) errors.push(`node ${node.id ?? "unknown"} evidence must contain document identifiers.`);
  }
  for (const edge of graph.edges ?? []) {
    if (!isRecord(edge)) {
      errors.push("every edge must be an object.");
      continue;
    }
    if (typeof edge.id !== "string" || !IDENTIFIER.test(edge.id)) errors.push("edge.id must be a safe identifier.");
    if (!ROADMAP_EDGE_TYPES.includes(edge.type)) errors.push(`edge ${edge.id ?? "unknown"} has an invalid type.`);
    if (!nodeIds.has(edge.from)) errors.push(`edge ${edge.id ?? "unknown"} references missing from node ${edge.from}.`);
    if (!nodeIds.has(edge.to)) errors.push(`edge ${edge.id ?? "unknown"} references missing to node ${edge.to}.`);
    if (edge.from === edge.to) errors.push(`edge ${edge.id ?? "unknown"} cannot point to itself.`);
  }
  return errors;
}

export function getProductRoadmapContractSummary() {
  return Object.freeze({
    contractVersion: PRODUCT_ROADMAP_CONTRACT_VERSION,
    nodeTypes: ROADMAP_NODE_TYPES,
    edgeTypes: ROADMAP_EDGE_TYPES,
    nodeStatuses: ROADMAP_NODE_STATUSES,
    completenessStages: COMPLETENESS_STAGES,
    completenessSeverities: COMPLETENESS_SEVERITIES,
    mutationBoundary: "roadmap-intent-is-proposal-editable; computed-state-and-authorization-are-hero-owned"
  });
}
