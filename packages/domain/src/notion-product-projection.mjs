import crypto from "node:crypto";

import { HERO_OPEN_ROADMAP, HERO_OPEN_ROADMAP_VERSION } from "../../contracts/src/roadmap.mjs";
import { roadmapStatusFromText } from "../../contracts/src/product-development.mjs";

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function copy(value) {
  return structuredClone(value);
}

function notionStatus(status) {
  if (status === "blocked") return "blocked";
  if (status === "evidence") return "done";
  if (status === "in_progress") return "active";
  return "proposed";
}

function roadmapRecord(row) {
  const order = row?.order;
  const reference = row?.reference;
  const title = row?.title;
  const statusText = row?.statusText ?? row?.status;
  const nextAction = row?.nextAction ?? row?.next;
  const id = `HERO-ROADMAP-${String(order).padStart(3, "0")}`;
  const status = notionStatus(roadmapStatusFromText(statusText));
  return {
    id,
    title,
    status,
    order,
    reference,
    statusText,
    nextAction,
    productId: "HERO-PRODUCT-HERO-001",
    owner: "hero-operations",
    sourceVersion: HERO_OPEN_ROADMAP_VERSION,
    source: "packages/contracts/src/roadmap.mjs",
    checksum: digest({ id, title, status, order, reference, statusText, nextAction, sourceVersion: HERO_OPEN_ROADMAP_VERSION })
  };
}

export function createNotionProductProjection({ roadmap = HERO_OPEN_ROADMAP, roadmapGraph = null } = {}) {
  const roadmapItems = roadmap.map(roadmapRecord);
  const graphNodes = Array.isArray(roadmapGraph?.nodes) ? roadmapGraph.nodes : [];
  const objectiveIds = new Set(graphNodes.filter(node => node.type === "objective").map(node => node.id));
  const objectiveForInitiative = new Map((Array.isArray(roadmapGraph?.edges) ? roadmapGraph.edges : [])
    .filter(edge => edge.type === "contains" && objectiveIds.has(edge.from))
    .map(edge => [edge.to, edge.from]));
  const objectives = graphNodes.filter(node => node.type === "objective").map(node => ({
    id: node.id,
    title: node.title,
    status: notionStatus(node.status),
    productId: node.product_id ?? "HERO-PRODUCT-HERO-001",
    owner: "project-owner",
    nodeType: node.type,
    evidence: node.evidence ?? [],
    sourceVersion: roadmapGraph?.schema_version ?? "1.0.0",
    checksum: digest(node)
  }));
  const initiatives = graphNodes.filter(node => node.type === "initiative").map(node => ({
    id: node.id,
    title: node.title,
    status: notionStatus(node.status),
    productId: node.product_id ?? "HERO-PRODUCT-HERO-001",
    owner: "project-owner",
    nodeType: node.type,
    evidence: node.evidence ?? [],
    objectiveId: objectiveForInitiative.get(node.id),
    sourceVersion: roadmapGraph?.schema_version ?? "1.0.0",
    checksum: digest(node)
  }));
  const iterations = [{
    id: "HERO-ITERATION-BACKLOG",
    title: "Backlog — بدون بازهٔ زمانی",
    status: "active",
    goal: "نگهداری کارهای رودمپ تا زمان تعیین Iteration رسمی توسط مالک",
    start: null,
    end: null,
    taskCount: roadmapItems.length,
    sourceVersion: HERO_OPEN_ROADMAP_VERSION,
    checksum: digest({ id: "HERO-ITERATION-BACKLOG", taskCount: roadmapItems.length, sourceVersion: HERO_OPEN_ROADMAP_VERSION })
  }];
  const workItems = roadmapItems.map(item => ({
    id: `HERO-WORK-${item.order.toString().padStart(3, "0")}`,
    title: `Work Item — ${item.title}`,
    status: item.status,
    type: "roadmap-delivery",
    priority: item.order,
    roadmapId: item.id,
    productId: item.productId,
    owner: item.owner,
    sourceVersion: item.sourceVersion,
    nextAction: item.nextAction,
    checksum: digest({ kind: "work-item", item })
  }));
  const tasks = roadmapItems.map((item, index) => ({
    id: `HERO-TASK-${item.order.toString().padStart(3, "0")}`,
    title: item.title,
    status: item.status,
    type: "roadmap-task",
    priority: item.order,
    workItemId: workItems[index].id,
    roadmapId: item.id,
    projectId: "HERO-PRODUCT-HERO-001",
    owner: item.owner,
    nextAction: item.nextAction,
    iterationId: iterations[0].id,
    sourceVersion: item.sourceVersion,
    checksum: digest({ kind: "task", item, workItemId: workItems[index].id, iterationId: iterations[0].id })
  }));
  return Object.freeze(copy({
    source: { roadmapVersion: HERO_OPEN_ROADMAP_VERSION, roadmapPath: "packages/contracts/src/roadmap.mjs", graphPath: "config/product-development/hero-roadmap-graph.json" },
    objectives,
    initiatives,
    roadmapItems,
    iterations,
    workItems,
    tasks
  }));
}

export function projectionMarkdown(kind, record) {
  const lines = [
    `> Hero Projection: \`${record.id}\``,
    `> Projection type: \`${kind}\``,
    `> Source version: \`${record.sourceVersion ?? "unknown"}\``,
    `> Canonical checksum: \`${record.checksum}\``,
    "",
    `# ${record.title}`,
    ""
  ];
  const labels = {
    status: "Status",
    statusText: "Current status",
    nextAction: "Next action",
    goal: "Goal",
    owner: "Owner",
    productId: "Product ID",
    projectId: "Project ID",
    roadmapId: "Roadmap ID",
    workItemId: "Work Item ID",
    iterationId: "Iteration ID",
    priority: "Priority",
    reference: "Reference",
    order: "Order",
    taskCount: "Task count",
    type: "Type"
  };
  for (const [key, label] of Object.entries(labels)) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") lines.push(`- **${label}:** ${String(record[key])}`);
  }
  if (Array.isArray(record.evidence) && record.evidence.length > 0) lines.push(`- **Evidence:** ${record.evidence.join(", ")}`);
  return lines.join("\n");
}

export function projectionSummary(projection) {
  return Object.freeze({
    objectives: projection.objectives.length,
    initiatives: projection.initiatives.length,
    roadmapItems: projection.roadmapItems.length,
    workItems: projection.workItems.length,
    tasks: projection.tasks.length,
    iterations: projection.iterations.length
  });
}
