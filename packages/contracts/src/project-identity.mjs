export const PROJECT_IDENTITY_CONTRACT_VERSION = "1.0";

export const HUMAN_ROLES = Object.freeze(["project-owner", "admin", "viewer"]);

export const PROJECT_ACCESS_ACTIONS = Object.freeze([
  "project.read",
  "project.write",
  "project.settings.write",
  "project.credentials.manage",
  "project.release.accept",
  "project.production.request",
  "project.grant.read",
  "project.grant.manage",
  "user.invite",
  "user.remove",
  "project.create",
  "project.archive",
  "secret.reveal"
]);

export const HUMAN_IDENTITY_EVENTS = Object.freeze([
  "identity.user-created",
  "identity.project-grant-upserted",
  "identity.project-grant-revoked",
  "identity.login-challenged",
  "identity.session-issued",
  "identity.session-revoked",
  "identity.recovery-requested",
  "identity.recovery-completed",
  "identity.step-up-verified",
  "identity.mfa-enrolled",
  "identity.user-disabled",
  "identity.sessions-revoked-all"
]);

export const OWNER_ONLY_ACTIONS = Object.freeze([
  "project.grant.manage",
  "user.invite",
  "user.remove",
  "project.create",
  "project.archive",
  "secret.reveal"
]);

export const PROJECT_ROLE_PERMISSIONS = Object.freeze({
  "project-owner": Object.freeze(PROJECT_ACCESS_ACTIONS),
  admin: Object.freeze([
    "project.read",
    "project.write",
    "project.settings.write",
    "project.credentials.manage",
    "project.release.accept",
    "project.production.request",
    "project.grant.read"
  ]),
  viewer: Object.freeze(["project.read", "project.grant.read"])
});

export const MFA_REQUIRED_ROLES = Object.freeze(["project-owner", "admin"]);

export function getProjectIdentityContractSummary() {
  return Object.freeze({
    version: PROJECT_IDENTITY_CONTRACT_VERSION,
    roles: HUMAN_ROLES,
    accessActions: PROJECT_ACCESS_ACTIONS,
    ownerOnlyActions: OWNER_ONLY_ACTIONS,
    mfaRequiredRoles: MFA_REQUIRED_ROLES,
    defaultAccess: "deny",
    authentication: "email/password plus MFA for owner/admin",
    recovery: "verified owner email plus recovery code or private-console fallback",
    sensitiveCooldown: "recovery blocks secret reveal and production requests until cooldown expires"
  });
}

export function validateProjectIdentityContract() {
  const errors = [];
  if (PROJECT_IDENTITY_CONTRACT_VERSION !== "1.0") errors.push("Unexpected project identity contract version.");
  if (HUMAN_ROLES.join(",") !== "project-owner,admin,viewer") errors.push("The three fixed human roles are required.");
  if (new Set(PROJECT_ACCESS_ACTIONS).size !== PROJECT_ACCESS_ACTIONS.length) errors.push("Project actions must be unique.");
  if (!MFA_REQUIRED_ROLES.includes("project-owner") || !MFA_REQUIRED_ROLES.includes("admin")) errors.push("Owner and admin MFA is required.");
  if (PROJECT_ROLE_PERMISSIONS.viewer.some(action => action !== "project.read" && action !== "project.grant.read")) errors.push("Viewer must remain read-only.");
  if (PROJECT_ROLE_PERMISSIONS.admin.some(action => OWNER_ONLY_ACTIONS.includes(action))) errors.push("Admin must not receive owner-only actions.");
  return errors;
}
