export const ACCEPTANCE_CRITERIA_CONTRACT_VERSION = "1.0";

/** Stable identifier of one structured criterion: AC-<templateId>-<NNN>. */
export const ACCEPTANCE_CRITERION_ID = /^AC-[a-z][a-z0-9-]{2,40}-\d{3}$/;

export const CRITERION_STATUSES = Object.freeze(["automatable", "manual", "needs-clarification"]);

/** Words that sound like a measure but are not one. Without a declared numeric threshold they are refused. */
export const VAGUE_TERMS = Object.freeze(["کافی", "مناسب", "خوب", "سریع", "زیبا", "ساده", "کاربرپسند", "معقول", "بهینه", "امن", "درست", "مطلوب"]);

/** Preconditions that say nothing. */
export const EMPTY_PRECONDITIONS = Object.freeze(["همیشه", "هرگاه", "هر وقت", "هر زمان", "در هر حالت"]);

const SET = (...items) => Object.freeze(items);

/**
 * Closed vocabulary of machine checks. A criterion compiles only when its check names one of these
 * kinds and its params satisfy the schema. Everything else stays `needs-clarification`.
 * Param specs: { enum: [...] } one value, { subset: [...] } non-empty distinct list from a set,
 * { paths: true } list of absolute URL paths, { map: {...} } string map with fixed allowed keys,
 * { integer: [min, max] } integer, { number: [min, max] } number.
 */
export const CHECK_KINDS = Object.freeze({
  "html-attributes": Object.freeze({ automatable: true, params: Object.freeze({ scope: { enum: SET("all-pages") }, attributes: { map: SET("lang", "dir") } }) }),
  "http-ok": Object.freeze({ automatable: true, params: Object.freeze({ paths: { paths: true }, expectStatus: { integer: [200, 299], optional: true } }) }),
  "no-external-request": Object.freeze({ automatable: true, params: Object.freeze({ scope: { enum: SET("page-load", "app-run") } }) }),
  "access-denied": Object.freeze({ automatable: true, params: Object.freeze({ methods: { subset: SET("POST", "PUT", "PATCH", "DELETE") }, actors: { subset: SET("anonymous", "viewer") } }) }),
  "log-absence": Object.freeze({ automatable: true, params: Object.freeze({ dataClasses: { subset: SET("email", "username", "password", "token", "personal-id") } }) }),
  "input-validation": Object.freeze({ automatable: true, params: Object.freeze({ constraints: { subset: SET("max-length", "sanitized", "rate-limit", "schema", "structured-error", "body-size") } }) }),
  "requires-authorization": Object.freeze({ automatable: true, params: Object.freeze({ action: { enum: SET("external-email", "ios-cloud-build", "production-deploy", "external-spend") } }) }),
  "data-locality": Object.freeze({ automatable: true, params: Object.freeze({ store: { enum: SET("product-database", "device-only") } }) }),
  "contract-conformance": Object.freeze({ automatable: true, params: Object.freeze({ specification: { enum: SET("openapi") } }) }),
  "error-hygiene": Object.freeze({ automatable: true, params: Object.freeze({ forbidden: { subset: SET("stack-trace", "host-path") } }) }),
  "migration-safety": Object.freeze({ automatable: true, params: Object.freeze({ properties: { subset: SET("additive", "rollback-path") } }) }),
  "record-retention": Object.freeze({ automatable: true, params: Object.freeze({ strategy: { enum: SET("recoverable-or-audited") } }) }),
  "html-accessibility": Object.freeze({ automatable: true, params: Object.freeze({ checks: { subset: SET("image-alt", "contrast-ratio") }, threshold: { number: [1, 21], optional: true } }), thresholdRequiredFor: "contrast-ratio" }),
  "ui-locale": Object.freeze({ automatable: true, params: Object.freeze({ language: { enum: SET("fa") }, direction: { enum: SET("rtl") }, scope: { enum: SET("all-screens") } }) }),
  "ui-metric": Object.freeze({ automatable: true, params: Object.freeze({ metric: { enum: SET("min-touch-target-points") }, threshold: { number: [1, 200] } }) }),
  "manual-review": Object.freeze({ automatable: false, params: Object.freeze({ reviewer: { enum: SET("owner", "independent-reviewer") } }) })
});

export function getAcceptanceCriteriaContractSummary() {
  return Object.freeze({
    version: ACCEPTANCE_CRITERIA_CONTRACT_VERSION,
    statuses: CRITERION_STATUSES,
    checkKinds: Object.freeze(Object.keys(CHECK_KINDS)),
    format: "وقتی <پیش‌شرط> آنگاه <نتیجهٔ مورد انتظار>",
    rules: Object.freeze([
      "A criterion without a precondition, an expectation, a known check kind or valid params is needs-clarification, never pass.",
      "A vague word (e.g. sufficient, suitable) without a declared numeric threshold is needs-clarification.",
      "The compiler is deterministic: the same input gives the same checklist, skeleton and digest.",
      "The compiler never approves a criterion; use requires the project owner's approval."
    ]),
    boundary: "The generated test skeleton is text. It is run only inside the isolated Product Runner and is never executed inside the Hero process."
  });
}

export function validateAcceptanceCriteriaContract() {
  const errors = [];
  for (const [kind, spec] of Object.entries(CHECK_KINDS)) {
    if (!/^[a-z][a-z-]{2,40}$/.test(kind)) errors.push(`${kind}: kind name is invalid`);
    if (typeof spec.automatable !== "boolean") errors.push(`${kind}: automatable must be boolean`);
    if (!spec.params || Object.keys(spec.params).length === 0) errors.push(`${kind}: params are required`);
  }
  if (!CHECK_KINDS["manual-review"] || CHECK_KINDS["manual-review"].automatable !== false) errors.push("manual-review must exist and be non-automatable");
  if (new Set(VAGUE_TERMS).size !== VAGUE_TERMS.length) errors.push("VAGUE_TERMS contains duplicates");
  return errors;
}
