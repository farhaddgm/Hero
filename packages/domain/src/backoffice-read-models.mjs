import { digestBackofficeValue } from "./backoffice-event-envelope.mjs";

const PROJECT_EVENTS = new Set(["project.requested"]);
const TASK_EVENTS = new Set(["task.created", "task.updated"]);
const OUTPUT_EVENTS = new Set(["artifact.delivered", "release.test-evidence-recorded", "release.production-deployment-recorded"]);

function bySequence(left, right) {
  return (left.sequence ?? 0) - (right.sequence ?? 0) || String(left.eventId).localeCompare(String(right.eventId));
}

function projectIdOf(project) {
  return project.projectId ?? project.id;
}

function projectNameOf(project) {
  return project.name ?? project.title ?? project.projectId ?? project.id;
}

function assertSafeData(value, path = "data") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafeData(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization)/i.test(key)) {
      throw new Error(`${path}.${key}: sensitive field cannot enter a read model.`);
    }
    assertSafeData(child, `${path}.${key}`);
  }
}

function normalizeProject(project) {
  const projectId = projectIdOf(project);
  if (typeof projectId !== "string" || projectId.length < 3) throw new Error("A project read model row requires projectId.");
  const row = {
    projectId,
    name: projectNameOf(project),
    status: project.status ?? "unknown",
    lifecycle: project.lifecycle ?? "active",
    health: project.health ?? "unknown",
    tokenUsage: project.tokenUsage ?? null,
    latestCompletedTask: project.latestCompletedTask ?? null,
    nextTasks: Array.isArray(project.nextTasks) ? [...project.nextTasks] : [],
    latestOutput: project.latestOutput ?? null,
    lastEventSequence: project.lastEventSequence ?? 0
  };
  assertSafeData(row);
  return row;
}

function projectEventState(project, events) {
  const row = normalizeProject(project);
  for (const event of events.filter(item => item.projectId === row.projectId || item.aggregateId === row.projectId).sort(bySequence)) {
    assertSafeData(event.data ?? {});
    row.lastEventSequence = Math.max(row.lastEventSequence, event.sequence ?? 0);
    const data = event.data ?? {};
    if (PROJECT_EVENTS.has(event.type)) {
      row.status = data.status ?? row.status;
      row.lifecycle = data.lifecycle ?? row.lifecycle;
      row.name = data.name ?? row.name;
    }
    if (TASK_EVENTS.has(event.type)) {
      const task = data.task ?? data;
      const taskStatus = task.status ?? data.status;
      const taskRow = { taskId: task.taskId ?? task.id ?? event.aggregateId, title: task.title ?? null, status: taskStatus ?? "unknown", sequence: event.sequence ?? 0 };
      if (["completed", "done", "accepted"].includes(taskStatus)) row.latestCompletedTask = taskRow;
      else if (!row.nextTasks.some(item => item.taskId === taskRow.taskId)) row.nextTasks.push(taskRow);
    }
    if (OUTPUT_EVENTS.has(event.type)) {
      row.latestOutput = { artifactId: data.artifactId ?? data.artifact?.artifactId ?? null, releaseId: data.releaseId ?? null, type: event.type, sequence: event.sequence ?? 0 };
    }
    if (data.health !== undefined) row.health = data.health;
    if (data.tokenUsage !== undefined) row.tokenUsage = data.tokenUsage;
  }
  row.nextTasks.sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0) || String(left.taskId ?? left.id ?? left.title ?? "").localeCompare(String(right.taskId ?? right.id ?? right.title ?? "")));
  return row;
}

export function rebuildProjectReadModel({ project, events = [], modelVersion = "1.0", sourceSequence } = {}) {
  const row = projectEventState(project, events);
  const source = sourceSequence ?? Math.max(0, ...events.map(event => event.sequence ?? 0));
  const model = { modelId: "project-overview", modelVersion, projectId: row.projectId, sourceSequence: source, project: row };
  return Object.freeze({ ...model, digest: digestBackofficeValue(model) });
}

export function rebuildPortfolioReadModel({ projects = [], events = [], modelVersion = "1.0", sourceSequence } = {}) {
  if (!Array.isArray(projects) || !Array.isArray(events)) throw new TypeError("Portfolio rebuild requires projects and events arrays.");
  const rowsById = new Map(projects.map(project => [projectIdOf(project), project]));
  for (const event of events) {
    if (event.type === "project.requested" && !rowsById.has(event.aggregateId)) rowsById.set(event.aggregateId, { projectId: event.aggregateId, name: event.data?.name ?? event.aggregateId, status: event.data?.status ?? "intake" });
  }
  const rows = [...rowsById.values()].map(project => projectEventState(project, events)).sort((left, right) => left.projectId.localeCompare(right.projectId));
  const source = sourceSequence ?? Math.max(0, ...events.map(event => event.sequence ?? 0));
  const model = { modelId: "portfolio-overview", modelVersion, sourceSequence: source, projectCount: rows.length, projects: rows };
  return Object.freeze({ ...model, digest: digestBackofficeValue(model) });
}
