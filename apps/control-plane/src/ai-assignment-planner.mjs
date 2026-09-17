import {
  AI_DEFAULT_ROLE_POLICIES,
  AI_ROLES,
  AI_ROLE_MUTATION_POLICIES,
  AI_ROLE_OUTPUT_SCHEMAS
} from "../../../packages/contracts/src/ai-orchestration.mjs";

const READY_CONNECTIONS = new Set(["healthy", "local-ready"]);
const NON_ASSIGNABLE_PROVIDERS = new Set(["cursor"]);
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;

function publicProfile(profile, provider, model, extras = {}) {
  if (!profile && (!provider || !model)) return null;
  return Object.freeze({
    profileId: profile?.profileId ?? extras.profileId ?? null,
    profileVersion: profile?.profileVersion ?? extras.profileVersion ?? null,
    role: profile?.role ?? extras.role ?? null,
    providerId: profile?.providerId ?? provider?.providerId ?? null,
    providerName: provider?.displayName ?? profile?.providerId ?? null,
    modelId: profile?.modelId ?? model?.modelId ?? null,
    modelName: model?.displayName ?? profile?.modelId ?? null,
    outputSchema: profile?.outputSchema ?? extras.outputSchema ?? null,
    toolPolicy: profile?.toolPolicy ?? extras.toolPolicy ?? null,
    status: profile?.status ?? extras.status ?? "to-be-created",
    connectionState: provider?.connection?.state ?? "not-verified",
    profileProvisioning: extras.profileProvisioning ?? (profile ? "existing" : "create-with-safe-defaults")
  });
}

function roleLabel(role) {
  return {
    analyst: "تحلیلگر",
    evaluator: "ارزیاب",
    "decision-maker": "تصمیم‌گیر",
    planner: "برنامه‌ریز",
    researcher: "پژوهشگر",
    executor: "اجراکننده",
    verifier: "راستی‌آزما",
    "code-reviewer": "بازبین کد"
  }[role] ?? role;
}

function compareProfiles(left, right, role, policies) {
  const policy = policies?.[role] ?? AI_DEFAULT_ROLE_POLICIES[role];
  const score = profile => {
    let value = 0;
    if (profile.providerId === policy?.providerId) value += 8;
    if (profile.modelId === policy?.modelId) value += 6;
    if (profile.toolPolicy === AI_ROLE_MUTATION_POLICIES[role]) value += 5;
    if (profile.outputSchema === AI_ROLE_OUTPUT_SCHEMAS[role]) value += 5;
    if (profile.providerId === "deterministic") value -= 1;
    return value;
  };
  return score(right) - score(left)
    || String(left.providerId).localeCompare(String(right.providerId))
    || String(left.modelId).localeCompare(String(right.modelId))
    || String(left.profileId).localeCompare(String(right.profileId));
}

function compareProviderModels(left, right, role, policies) {
  const policy = policies?.[role] ?? AI_DEFAULT_ROLE_POLICIES[role];
  const score = item => {
    let value = 0;
    if (item.provider.providerId === policy?.providerId) value += 8;
    if (item.model.modelId === policy?.modelId) value += 6;
    if (item.provider.mode === "deterministic") value -= 1;
    return value;
  };
  return score(right) - score(left)
    || String(left.provider.providerId).localeCompare(String(right.provider.providerId))
    || String(left.model.modelId).localeCompare(String(right.model.modelId));
}

function currentDirectBinding(bindings, projectId, role) {
  return (bindings ?? []).find(binding =>
    binding.projectId === projectId && binding.role === role && !binding.teamId && !binding.skillId
  ) ?? null;
}

function profileEligibility(profile, providers, models, role) {
  if (!profile || profile.role !== role) return "Profile با این Role سازگار نیست.";
  if (profile.status !== "active") return "فقط Profile فعال قابل تخصیص است.";
  if (profile.outputSchema !== AI_ROLE_OUTPUT_SCHEMAS[role]) return `خروجی Profile باید ${AI_ROLE_OUTPUT_SCHEMAS[role]} باشد.`;
  if (profile.toolPolicy !== AI_ROLE_MUTATION_POLICIES[role]) return `سیاست ابزار این Role باید ${AI_ROLE_MUTATION_POLICIES[role]} باشد.`;
  const provider = providers.get(profile.providerId);
  if (!provider) return "Provider این Profile در کاتالوگ موجود نیست.";
  if (NON_ASSIGNABLE_PROVIDERS.has(provider.providerId)) return "این Provider برای اتصال مستقیم این بخش در دسترس نیست.";
  if (provider.mode === "disabled") return "Provider غیرفعال است.";
  if (!READY_CONNECTIONS.has(provider.connection?.state)) return "سلامت اتصال Provider هنوز تأیید نشده است.";
  if (!models.has(`${profile.providerId}:${profile.modelId}`)) return "Model این Profile در کاتالوگ موجود نیست.";
  return null;
}

function readyProviderModels(providers, models, role, policies) {
  const providerList = providers instanceof Map ? [...providers.values()] : providers;
  const modelList = models instanceof Map ? [...models.values()] : models;
  return modelList
    .map(model => ({ model, provider: providerList.find(item => item.providerId === model.providerId) }))
    .filter(item => item.provider)
    .filter(item => !NON_ASSIGNABLE_PROVIDERS.has(item.provider.providerId))
    .filter(item => item.provider.mode !== "disabled")
    .filter(item => READY_CONNECTIONS.has(item.provider.connection?.state))
    .sort((left, right) => compareProviderModels(left, right, role, policies));
}

/**
 * Builds a deterministic, provider-agnostic proposal from the current public
 * catalog. It never calls a model; the apply step may provision only a
 * versioned Profile from a Provider/Model that is already ready.
 */
export function createAiAssignmentProposal({ projectId, roles = AI_ROLES, providers = [], models = [], profiles = [], bindings = [], defaultRolePolicies = [] } = {}) {
  if (typeof projectId !== "string" || !IDENTIFIER.test(projectId)) throw new Error("projectId is invalid.");
  const requestedRoles = [...new Set((Array.isArray(roles) ? roles : AI_ROLES).filter(role => AI_ROLES.includes(role)))];
  const providerMap = new Map(providers.map(provider => [provider.providerId, provider]));
  const modelMap = new Map(models.map(model => [`${model.providerId}:${model.modelId}`, model]));
  const policies = Array.isArray(defaultRolePolicies)
    ? Object.fromEntries(defaultRolePolicies.map(policy => [policy.role, policy]))
    : defaultRolePolicies;
  const profileList = profiles.filter(profile => profile && profile.status === "active");
  const plan = requestedRoles.map(role => {
    const existing = currentDirectBinding(bindings, projectId, role);
    const existingProfile = profiles.find(profile => profile.profileId === existing?.profileId);
    const existingReason = existing ? profileEligibility(existingProfile, providerMap, modelMap, role) : null;
    const candidates = profileList
      .filter(profile => profile.role === role)
      .filter(profile => profileEligibility(profile, providerMap, modelMap, role) === null)
      .sort((left, right) => compareProfiles(left, right, role, policies));
    const recommendation = candidates[0] ?? null;
    const providerModelRecommendation = readyProviderModels(providerMap, modelMap, role, policies)[0] ?? null;
    if (existing && existingReason === null) {
      return Object.freeze({
        role,
        roleLabel: roleLabel(role),
        status: "already-bound",
        operation: "unchanged",
        reason: "این نقش از قبل به یک Profile فعال و آماده وصل است؛ برای جلوگیری از جایگزینی ناخواسته دست‌نخورده می‌ماند.",
        existingBindingId: existing.bindingId,
        existingProfile: publicProfile(existingProfile, providerMap.get(existingProfile?.providerId), modelMap.get(`${existingProfile?.providerId}:${existingProfile?.modelId}`)),
        recommendedProfile: publicProfile(existingProfile, providerMap.get(existingProfile?.providerId), modelMap.get(`${existingProfile?.providerId}:${existingProfile?.modelId}`))
      });
    }
    if (!recommendation && providerModelRecommendation) {
      const recommendedProfile = publicProfile(null, providerModelRecommendation.provider, providerModelRecommendation.model, {
        role,
        outputSchema: AI_ROLE_OUTPUT_SCHEMAS[role],
        toolPolicy: AI_ROLE_MUTATION_POLICIES[role],
        profileProvisioning: "create-with-safe-defaults"
      });
      return Object.freeze({
        role,
        roleLabel: roleLabel(role),
        status: "ready",
        operation: existing ? "replace-with-created-profile" : "create-with-created-profile",
        reason: existing
          ? `تخصیص فعلی آماده نیست؛ از ${recommendedProfile.providerName} / ${recommendedProfile.modelName} یک Profile نسخه‌دار با تنظیمات امن ساخته و جایگزین می‌شود.`
          : `برای این Role Profile آماده وجود ندارد؛ از ${recommendedProfile.providerName} / ${recommendedProfile.modelName} یک Profile نسخه‌دار با تنظیمات امن ساخته و متصل می‌شود.`,
        existingBindingId: existing?.bindingId ?? null,
        existingProfile: publicProfile(existingProfile, providerMap.get(existingProfile?.providerId), modelMap.get(`${existingProfile?.providerId}:${existingProfile?.modelId}`)),
        recommendedProfile,
        requiresProfileCreation: true
      });
    }
    if (!recommendation) {
      const missingTarget = existingReason
        ? ` تخصیص فعلی آماده نیست: ${existingReason}`
        : " هیچ Provider/Model سالم و قابل استفاده‌ای هم برای ساخت Profile پیدا نشد.";
      return Object.freeze({
        role,
        roleLabel: roleLabel(role),
        status: "needs-admin-setup",
        operation: "none",
        reason: `برای این Role، Profile فعال با Policy، Output Schema و اتصال سالم پیدا نشد.${missingTarget}`,
        existingBindingId: existing?.bindingId ?? null,
        existingProfile: publicProfile(existingProfile, providerMap.get(existingProfile?.providerId), modelMap.get(`${existingProfile?.providerId}:${existingProfile?.modelId}`)),
        recommendedProfile: null,
        requiresProfileCreation: false
      });
    }
    return Object.freeze({
      role,
      roleLabel: roleLabel(role),
      status: "ready",
      operation: existing ? "replace" : "create",
      reason: existing ? "Profile فعلی آماده نیست؛ این Profile فعال و سازگار به‌عنوان جایگزین نسخه‌دار پیشنهاد شده است." : "Profile فعال با Policy نقش، Output Schema و سلامت اتصال سازگار است.",
      existingBindingId: existing?.bindingId ?? null,
      existingProfile: publicProfile(existingProfile, providerMap.get(existingProfile?.providerId), modelMap.get(`${existingProfile?.providerId}:${existingProfile?.modelId}`)),
      recommendedProfile: publicProfile(recommendation, providerMap.get(recommendation.providerId), modelMap.get(`${recommendation.providerId}:${recommendation.modelId}`)),
      requiresProfileCreation: false
    });
  });
  const ready = plan.filter(item => item.status === "ready").length;
  const blocked = plan.filter(item => item.status === "needs-admin-setup").length;
  const unchanged = plan.filter(item => item.status === "already-bound").length;
  const profilesToCreate = plan.filter(item => item.requiresProfileCreation === true).length;
  return Object.freeze({
    schemaVersion: "hero.ai-assignment-proposal/v1",
    projectId,
    roles: Object.freeze(requestedRoles),
    policy: Object.freeze({ preserveExisting: true, providerAgnostic: true, createsCatalogEntries: profilesToCreate > 0, createsProviderModelEntries: false, createsProfileEntries: profilesToCreate > 0, invokesProvider: false }),
    counts: Object.freeze({ total: plan.length, ready, blocked, unchanged, profilesToCreate }),
    assignments: Object.freeze(plan),
    generatedAt: new Date().toISOString()
  });
}

export function advisorProfileOptions({ profiles = [], providers = [], models = [] } = {}) {
  const providerMap = new Map(providers.map(provider => [provider.providerId, provider]));
  const modelMap = new Map(models.map(model => [`${model.providerId}:${model.modelId}`, model]));
  return Object.freeze(profiles
    .filter(profile => profile.status === "active" && profile.role === "analyst")
    .filter(profile => profile.outputSchema === AI_ROLE_OUTPUT_SCHEMAS.analyst && profile.toolPolicy === "read-only")
    .filter(profile => profileEligibility(profile, providerMap, modelMap, "analyst") === null)
    .map(profile => publicProfile(profile, providerMap.get(profile.providerId), modelMap.get(`${profile.providerId}:${profile.modelId}`))));
}
