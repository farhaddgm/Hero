import {
  COMPLETENESS_SEVERITIES,
  COMPLETENESS_STAGES,
  ROADMAP_EDGE_TYPES,
  ROADMAP_NODE_STATUSES,
  validateRoadmapGraph
} from "../../contracts/src/index.mjs";

const DEFAULT_STAGE = "proposed";

function copy(value) {
  return structuredClone(value);
}

function freeze(value) {
  return Object.freeze(copy(value));
}

function check(id, label, passed, severity = "required", detail = "") {
  return { id, label, passed: passed === true, severity, detail };
}

function hasDocumentRole(documents, role) {
  return documents.some(document => document.exists !== false && document.status === "active" && document.role === role);
}

function hasDocumentType(documents, type) {
  return documents.some(document => document.exists !== false && document.status === "active" && document.type === type);
}

const STAGE_REQUIREMENTS = Object.freeze({
  proposed: Object.freeze({ roles: ["brief"], types: [] }),
  discovery: Object.freeze({ roles: ["brief"], types: ["evidence"] }),
  planned: Object.freeze({ roles: ["brief"], types: ["architecture", "decision"] }),
  "in-development": Object.freeze({ roles: ["brief", "test-environment"], types: ["architecture", "specification"] }),
  "in-test": Object.freeze({ roles: ["brief", "test-environment", "release-policy"], types: ["evidence"] }),
  "production-ready": Object.freeze({ roles: ["brief", "test-environment", "release-policy"], types: ["evidence", "operation"] }),
  operating: Object.freeze({ roles: ["brief", "test-environment", "release-policy"], types: ["operation", "evidence"] }),
  retiring: Object.freeze({ roles: ["release-policy"], types: ["operation"] })
});

const RISK_REQUIREMENTS = Object.freeze({
  pii: Object.freeze({ types: ["governance", "architecture", "operation"], label: "PII policy and handling evidence" }),
  payment: Object.freeze({ types: ["governance", "operation", "evidence"], label: "payment control and reconciliation evidence" }),
  ai: Object.freeze({ types: ["architecture", "specification", "evidence"], label: "AI model, evaluation and cost evidence" }),
  external_integration: Object.freeze({ types: ["architecture", "operation"], label: "external integration and outage policy" })
});

function stageFor(status) {
  if (status === "proposed") return "proposed";
  if (status === "active") return "operating";
  if (status === "retired" || status === "archived") return "retiring";
  return DEFAULT_STAGE;
}

export function evaluateProductCompleteness({ product, documents = [], productDocuments = documents, stage = stageFor(product?.status), riskProfile = {} } = {}) {
  const selectedStage = COMPLETENESS_STAGES.includes(stage) ? stage : DEFAULT_STAGE;
  const requirements = STAGE_REQUIREMENTS[selectedStage];
  const checks = [
    check("registry-relations", "ارتباط‌های رجیستری معتبر", (product?.relationErrors ?? []).length === 0),
    check("product-documents-exist", "فایل اسناد اختصاصی موجود است", productDocuments.length > 0 && productDocuments.every(document => document.exists !== false)),
    ...requirements.roles.map(role => check(`required-role-${role}`, `سند نقش ${role}`, hasDocumentRole(productDocuments, role))),
    ...requirements.types.map(type => check(`recommended-type-${type}`, `سند نوع ${type}`, hasDocumentType(documents, type), "recommended"))
  ];
  for (const [risk, requirement] of Object.entries(RISK_REQUIREMENTS)) {
    if (riskProfile?.[risk] !== true) continue;
    const passed = requirement.types.some(type => hasDocumentType(documents, type));
    checks.push(check(`risk-${risk}`, requirement.label, passed, "required", passed ? "" : `risk_profile.${risk}=true`));
  }
  const required = checks.filter(item => item.severity === "required");
  const passedRequired = required.filter(item => item.passed).length;
  const passedAll = checks.filter(item => item.passed).length;
  const score = checks.length === 0 ? 0 : Math.round((passedAll / checks.length) * 100);
  const blocking = checks.filter(item => item.severity === "required" && !item.passed);
  return freeze({
    stage: selectedStage,
    checks,
    score,
    requiredScore: required.length === 0 ? 100 : Math.round((passedRequired / required.length) * 100),
    status: blocking.length > 0 ? "blocked" : "ready",
    missing: checks.filter(item => !item.passed).map(item => ({ id: item.id, label: item.label, severity: item.severity, detail: item.detail }))
  });
}

function detectDependencyCycles(nodes, edges) {
  const dependencies = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    if (edge.type !== "depends-on") continue;
    dependencies.get(edge.from)?.push(edge.to);
  }
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];
  function visit(nodeId, stack = []) {
    if (visiting.has(nodeId)) {
      const index = stack.indexOf(nodeId);
      cycles.push([...stack.slice(index), nodeId]);
      return;
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const next of dependencies.get(nodeId) ?? []) visit(next, [...stack, nodeId]);
    visiting.delete(nodeId);
    visited.add(nodeId);
  }
  for (const node of nodes) visit(node.id);
  return cycles;
}

export function createRoadmapGraph(graph) {
  const errors = validateRoadmapGraph(graph);
  if (errors.length > 0) throw new Error(`Invalid roadmap graph: ${errors.join(" ")}`);
  const nodes = graph.nodes.map(node => ({ ...node, evidence: [...(node.evidence ?? [])] }));
  const edges = graph.edges.map(edge => ({ ...edge }));
  const referenced = new Set(edges.flatMap(edge => [edge.from, edge.to]));
  const cycles = detectDependencyCycles(nodes, edges);
  const blocked = nodes.filter(node => node.status === "blocked");
  return freeze({
    schema_version: graph.schema_version,
    product_id: graph.product_id ?? null,
    nodes,
    edges,
    indexes: {
      nodeIds: nodes.map(node => node.id),
      orphanNodeIds: nodes.filter(node => !referenced.has(node.id)).map(node => node.id),
      blockedNodeIds: blocked.map(node => node.id)
    },
    diagnostics: {
      dependencyCycles: cycles,
      statusVocabulary: ROADMAP_NODE_STATUSES,
      edgeVocabulary: ROADMAP_EDGE_TYPES,
      hasBlockingCycle: cycles.length > 0
    },
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      blockedCount: blocked.length,
      doneCount: nodes.filter(node => node.status === "done").length,
      orphanCount: nodes.filter(node => !referenced.has(node.id)).length,
      dependencyCycleCount: cycles.length
    }
  });
}

export function getCompletenessContractSummary() {
  return Object.freeze({
    stages: COMPLETENESS_STAGES,
    severities: COMPLETENESS_SEVERITIES,
    requiredStatus: "blocked-until-required-checks-pass",
    unknownPolicy: "missing-or-unverifiable-evidence-is-not-complete"
  });
}
