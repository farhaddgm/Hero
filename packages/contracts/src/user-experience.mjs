export const USER_EXPERIENCE_CONTRACT_VERSION = "1.0";

export const USER_EXPERIENCE_LANGUAGE = "fa-IR";

export const SIMPLE_DEVELOPMENT_STATUSES = Object.freeze({
  notStarted: "شروع نشده",
  inDevelopment: "در حال توسعه",
  inReview: "در حال بازبینی",
  needsUserDecision: "نیاز به تصمیم شما",
  readyToDeliver: "آماده تحویل",
  completed: "تکمیل",
  stopped: "متوقف",
  failed: "ناموفق"
});

export const COLLABORATION_MODES = Object.freeze({
  guided: Object.freeze({
    label: "حالت راهنما",
    default: true,
    description: "کاربر برنامه را می‌بیند و پیش از هر گام مجاز می‌تواند تصمیم بگیرد."
  }),
  fullAutonomySnapshot: Object.freeze({
    label: "اختیار کامل برای گام‌های فعلی",
    authorizationModel: "versioned-snapshot",
    allowedOperations: Object.freeze([
      "design",
      "document",
      "version",
      "develop",
      "test",
      "review",
      "commit"
    ]),
    description:
      "فقط گام‌ها و نسخه‌های موجود در Snapshot را تا checkpoint امن بعدی پیش می‌برد."
  })
});

export const ALWAYS_SEPARATELY_APPROVED_ACTIONS = Object.freeze([
  "production_deploy",
  "external_spend",
  "secret_change",
  "destructive_data_operation",
  "external_message",
  "irreversible_operation"
]);

export const UX_REQUIRED_SCREENS = Object.freeze([
  "home",
  "work_detail",
  "decision_center",
  "delivery"
]);

export const UX_QUESTION_POLICY = Object.freeze({
  language: USER_EXPERIENCE_LANGUAGE,
  maximumQuestionsPerTurn: 3,
  askOnlyFor: Object.freeze([
    "scope_ambiguity",
    "priority_ambiguity",
    "acceptance_criteria_ambiguity",
    "external_impact"
  ]),
  neverAskFor: Object.freeze(["implementation_jargon", "internal_agent_routing"])
});

export function validateUserExperienceContract() {
  const errors = [];
  const requiredStatuses = [
    "notStarted",
    "inDevelopment",
    "inReview",
    "needsUserDecision",
    "readyToDeliver",
    "completed",
    "stopped",
    "failed"
  ];

  for (const status of requiredStatuses) {
    if (!SIMPLE_DEVELOPMENT_STATUSES[status]) errors.push(`missing status: ${status}`);
  }

  if (COLLABORATION_MODES.guided.default !== true) {
    errors.push("guided mode must remain the default");
  }

  if (COLLABORATION_MODES.fullAutonomySnapshot.authorizationModel !== "versioned-snapshot") {
    errors.push("full autonomy must be bound to a versioned snapshot");
  }

  if (UX_QUESTION_POLICY.maximumQuestionsPerTurn > 3) {
    errors.push("the user question limit must not exceed three");
  }

  if (UX_REQUIRED_SCREENS.length !== 4) errors.push("the initial screen set must stay explicit");

  return errors;
}
