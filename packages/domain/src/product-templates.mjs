import {
  PRODUCT_TEMPLATE_KINDS,
  PRODUCT_TEMPLATE_REQUIRED_FORBIDDEN,
  PRODUCT_TEMPLATE_REQUIRED_GATES,
  PRODUCT_TEMPLATE_RISK_KEYS,
  PRODUCT_TEMPLATE_ROLES
} from "../../contracts/src/product-templates.mjs";

/** Product templates: governed starting points that produce a reviewable proposal and nothing else. */

const TEMPLATE_ID = /^[a-z][a-z0-9-]{2,62}$/;
const ANSWERS = new Set(["unknown", "yes", "no"]);
const SECRET_LIKE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bpassword\s*[:=]\s*\S+)/i;
const HOST_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|Users|mnt|opt|root|etc)\/)/;

export class ProductTemplateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProductTemplateError";
    this.code = code;
  }
}

function hasCycle(tasks) {
  const deps = new Map(tasks.map(task => [task.key, task.dependsOn ?? []]));
  const state = new Map();
  const visit = key => {
    if (state.get(key) === 1) return true;
    if (state.get(key) === 2) return false;
    state.set(key, 1);
    const cyclic = (deps.get(key) ?? []).some(dep => deps.has(dep) && visit(dep));
    state.set(key, 2);
    return cyclic;
  };
  return [...deps.keys()].some(visit);
}

export function validateTemplate(template) {
  const errors = [];
  const label = template?.templateId ?? "unknown";
  const fail = message => errors.push(`${label}: ${message}`);
  if (!template || typeof template !== "object") return ["template is required"];
  if (template.schema !== "hero.product-template/v1") fail("unexpected schema");
  if (!TEMPLATE_ID.test(template.templateId ?? "")) fail("templateId is invalid");
  if (!/^\d+\.\d+\.\d+$/.test(template.version ?? "")) fail("version must be SemVer");
  if (!PRODUCT_TEMPLATE_KINDS.includes(template.kind)) fail("kind is not supported");
  for (const field of ["title", "summary"]) if (typeof template[field] !== "string" || template[field].trim().length < 3) fail(`${field} is required`);

  const risk = template.defaultRiskAnswers ?? {};
  for (const key of PRODUCT_TEMPLATE_RISK_KEYS) {
    if (!ANSWERS.has(risk[key])) fail(`defaultRiskAnswers.${key} must be yes, no or unknown`);
    if (risk[key] === "no" && !(typeof template.riskRationale?.[key] === "string" && template.riskRationale[key].trim().length >= 10)) {
      fail(`a 'no' for ${key} needs a structural rationale; unknown must not be disguised as no`);
    }
  }
  for (const key of Object.keys(risk)) if (!PRODUCT_TEMPLATE_RISK_KEYS.includes(key)) fail(`unknown risk question ${key}`);

  const policy = template.policyPack ?? {};
  if (policy.autonomy !== "approval-each-stage") fail("policyPack.autonomy must be approval-each-stage");
  if (policy.egress !== "closed") fail("policyPack.egress must be closed");
  if (policy.reviewerIndependent !== true) fail("policyPack.reviewerIndependent must be true");
  for (const gate of PRODUCT_TEMPLATE_REQUIRED_GATES) if (!(policy.requiredGates ?? []).includes(gate)) fail(`policyPack.requiredGates must include ${gate}`);
  for (const item of PRODUCT_TEMPLATE_REQUIRED_FORBIDDEN) if (!(policy.forbidden ?? []).includes(item)) fail(`policyPack.forbidden must include ${item}`);

  const tasks = Array.isArray(template.taskSkeleton) ? template.taskSkeleton : [];
  const keys = new Set();
  for (const task of tasks) {
    if (typeof task?.key !== "string" || !/^[a-z][a-z0-9-]{0,30}$/.test(task.key) || keys.has(task.key)) { fail("each task needs a unique key"); continue; }
    keys.add(task.key);
    if (!PRODUCT_TEMPLATE_ROLES.includes(task.role)) fail(`task ${task.key} has an unsupported role`);
    if (typeof task.title !== "string" || task.title.trim().length < 3) fail(`task ${task.key} needs a title`);
  }
  for (const task of tasks) for (const dep of task.dependsOn ?? []) if (!keys.has(dep)) fail(`task ${task.key} depends on unknown task ${dep}`);
  if (hasCycle(tasks)) fail("the task skeleton has a cycle");
  const roles = new Set(tasks.map(task => task.role));
  for (const role of ["implementer", "tester", "reviewer"]) if (!roles.has(role)) fail(`the skeleton needs a ${role} task`);
  const implementers = tasks.filter(task => task.role === "implementer").map(task => task.key);
  for (const reviewer of tasks.filter(task => task.role === "reviewer")) {
    if (!(reviewer.dependsOn ?? []).some(dep => implementers.includes(dep))) fail(`reviewer ${reviewer.key} must depend on implementation`);
  }

  const criteria = template.acceptanceCriteria;
  if (!Array.isArray(criteria) || criteria.length < 3 || criteria.some(item => typeof item !== "string" || item.trim().length < 10)) fail("at least three acceptance criteria of 10+ characters are required");
  if (!Array.isArray(template.outOfScope) || template.outOfScope.length < 1) fail("outOfScope must list at least one exclusion");
  if (!(template.productTestPlan?.healthPath?.startsWith("/") && template.productTestPlan?.readyPath?.startsWith("/")) && template.kind !== "mobile") fail("web and api templates need health and ready paths");
  const serialized = JSON.stringify(template);
  if (SECRET_LIKE.test(serialized)) fail("looks like it contains a credential");
  if (HOST_PATH.test(serialized)) fail("contains a host-specific path");
  return errors;
}

export function validateTemplateRegistry(registry) {
  const errors = [];
  if (!registry || registry.schema !== "hero.product-template-registry/v1") return ["unexpected registry schema"];
  const ids = new Set();
  for (const template of registry.templates ?? []) {
    if (ids.has(template.templateId)) errors.push(`${template.templateId}: duplicate templateId`);
    ids.add(template.templateId);
    errors.push(...validateTemplate(template));
  }
  if ((registry.templates ?? []).length < 3) errors.push("the registry needs at least three templates");
  return errors;
}

export function createProductTemplateRegistry(registry) {
  const problems = validateTemplateRegistry(registry);
  if (problems.length > 0) throw new ProductTemplateError("INVALID_REGISTRY", `Template registry is invalid: ${problems[0]}`);
  const byId = new Map(registry.templates.map(template => [template.templateId, Object.freeze(structuredClone(template))]));
  return Object.freeze({
    list: () => Object.freeze([...byId.values()].map(template => Object.freeze({ templateId: template.templateId, version: template.version, kind: template.kind, title: template.title, summary: template.summary }))),
    get: templateId => byId.get(templateId) ?? null,

    /**
     * Builds a reviewable proposal. The owner's answers win over template defaults, but an answer
     * can never silently turn a structural 'yes' into 'no': that is reported as a conflict.
     */
    instantiate({ templateId, projectId, name, answers = {} } = {}) {
      const template = byId.get(templateId);
      if (!template) throw new ProductTemplateError("TEMPLATE_NOT_FOUND", "Unknown template.");
      if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{2,62}$/.test(projectId)) throw new ProductTemplateError("INVALID_PROJECT_ID", "projectId is invalid.");
      if (typeof name !== "string" || name.trim().length < 2 || name.length > 120) throw new ProductTemplateError("INVALID_NAME", "name is required.");
      const conflicts = [];
      const riskAnswers = {};
      for (const key of PRODUCT_TEMPLATE_RISK_KEYS) {
        const supplied = answers[key];
        if (supplied !== undefined && !ANSWERS.has(supplied)) throw new ProductTemplateError("INVALID_ANSWER", `Answer for ${key} must be yes, no or unknown.`);
        const implied = template.defaultRiskAnswers[key];
        if (supplied === undefined || (supplied === "unknown" && implied !== "unknown")) riskAnswers[key] = implied;
        else {
          riskAnswers[key] = supplied;
          if (implied === "yes" && supplied === "no") conflicts.push({ question: key, template: "yes", owner: "no", rule: "The template structurally implies yes; the owner must resolve this before the proposal can proceed." });
        }
      }
      const unknownQuestions = PRODUCT_TEMPLATE_RISK_KEYS.filter(key => riskAnswers[key] === "unknown");
      const taskGraph = template.taskSkeleton.map(task => Object.freeze({ taskId: `${projectId}-${task.key}`, role: task.role, title: task.title, dependsOn: Object.freeze((task.dependsOn ?? []).map(dep => `${projectId}-${dep}`)) }));
      return Object.freeze({
        schema: "hero.template-proposal/v1",
        projectId, name: name.trim(), templateId: template.templateId, templateVersion: template.version, kind: template.kind,
        riskAnswers: Object.freeze(riskAnswers), unknownRiskQuestions: Object.freeze(unknownQuestions),
        riskCompleteness: unknownQuestions.length === 0 ? "complete" : "needs-review",
        conflicts: Object.freeze(conflicts),
        policyPack: Object.freeze(structuredClone(template.policyPack)),
        taskGraph: Object.freeze(taskGraph),
        acceptanceCriteria: Object.freeze([...template.acceptanceCriteria]),
        outOfScope: Object.freeze([...template.outOfScope]),
        ready: conflicts.length === 0,
        boundary: "proposal-only: no repository, container, secret or deployment is created"
      });
    }
  });
}
