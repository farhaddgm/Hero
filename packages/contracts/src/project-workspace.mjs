export const PROJECT_WORKSPACE_CONTRACT_VERSION = "1.0";

export const PROJECT_LIFECYCLES = Object.freeze(["draft", "intake", "foundation-review", "active", "archived", "deletion-requested"]);
export const PROJECT_INPUT_TYPES = Object.freeze(["text", "pdf", "word", "excel", "image", "zip", "link", "github-repository"]);
export const FOUNDATION_PROPOSAL_STATES = Object.freeze(["proposed", "revision-requested", "approved", "superseded"]);

export function getProjectWorkspaceContractSummary() {
  return Object.freeze({
    version: PROJECT_WORKSPACE_CONTRACT_VERSION,
    lifecycle: PROJECT_LIFECYCLES,
    inputTypes: PROJECT_INPUT_TYPES,
    upload: "private project-scoped object key, quota, checksum, signature validation and scan result; PostgreSQL stores metadata only",
    import: "GitHub inventory is read-only and never fetches, commits, changes Secrets or deploys without a separate authorization",
    clone: "copies approved structure/settings only; Secret, data, memory and private history are excluded",
    persistence: "append-only project, input, foundation and import metadata with startup hydration"
  });
}

export function validateProjectWorkspaceContract() {
  const errors = [];
  if (PROJECT_WORKSPACE_CONTRACT_VERSION !== "1.0") errors.push("Unexpected project workspace contract version.");
  if (!PROJECT_LIFECYCLES.includes("deletion-requested")) errors.push("Deletion must remain a request, not immediate removal.");
  if (!PROJECT_INPUT_TYPES.includes("github-repository")) errors.push("GitHub import input is required.");
  return errors;
}
