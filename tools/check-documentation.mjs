import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REPO_ROOT, isInsideRoot } from "./fs-policy.mjs";

const DOCUMENT_REGISTRY = "docs/registry/document-registry.json";
const PRODUCT_REGISTRY = "docs/registry/product-registry.json";
const DOCUMENT_TYPES = new Set([
  "architecture",
  "decision",
  "governance",
  "operation",
  "specification",
  "evidence",
  "roadmap",
  "template",
  "index"
]);
const DOCUMENT_SCOPES = new Set(["hero", "product", "cross-project"]);
const DOCUMENT_STATUSES = new Set(["active", "proposed", "superseded", "archived"]);
const REVIEW_CADENCES = new Set([
  "per-change",
  "per-release",
  "monthly",
  "quarterly",
  "annual",
  "event-driven",
  "none"
]);
const PRODUCT_STATUSES = new Set(["proposed", "active", "paused", "retired", "archived"]);
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const DOCUMENT_ID = /^[A-Z][A-Z0-9.-]+$/;

function addError(errors, code, filePath, documentId, detail) {
  errors.push({
    code,
    path: filePath || "unknown",
    documentId: documentId || "unknown",
    detail
  });
}

function readJson(root, relativePath, errors) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    addError(errors, "MISSING_REGISTRY", relativePath, "registry", "required registry file does not exist");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    addError(errors, "INVALID_REGISTRY_JSON", relativePath, "registry", error.message);
    return null;
  }
}

function listFiles(root, relativeDirectory, predicate) {
  const start = path.join(root, relativeDirectory);
  if (!fs.existsSync(start)) return [];
  const files = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && predicate(absolute)) {
        files.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
    }
  }
  return files.sort();
}

function validateDocumentRegistry(root, registry, errors) {
  const documents = Array.isArray(registry?.documents) ? registry.documents : [];
  if (!registry || !SEMVER.test(registry.schema_version ?? "")) {
    addError(errors, "INVALID_SCHEMA_VERSION", DOCUMENT_REGISTRY, "registry", "schema_version must be SemVer");
  }
  if (!Array.isArray(registry?.documents)) {
    addError(errors, "INVALID_DOCUMENT_COLLECTION", DOCUMENT_REGISTRY, "registry", "documents must be an array");
    return { documents: [], byId: new Map(), byPath: new Map() };
  }

  const byId = new Map();
  const byPath = new Map();
  const required = [
    "id",
    "path",
    "title",
    "type",
    "scope",
    "status",
    "version",
    "owner",
    "canonical",
    "supersedes",
    "review_cadence"
  ];

  for (const document of documents) {
    const id = typeof document?.id === "string" ? document.id : "unknown";
    const filePath = typeof document?.path === "string" ? document.path : DOCUMENT_REGISTRY;
    for (const field of required) {
      if (!(field in (document ?? {}))) {
        addError(errors, "MISSING_DOCUMENT_FIELD", filePath, id, `missing field ${field}`);
      }
    }
    if (!DOCUMENT_ID.test(id)) addError(errors, "INVALID_DOCUMENT_ID", filePath, id, "ID must use uppercase stable characters");
    if (byId.has(id)) {
      addError(errors, "DUPLICATE_DOCUMENT_ID", filePath, id, `also registered at ${byId.get(id).path}`);
      if (document.canonical === true && byId.get(id).canonical === true) {
        addError(errors, "MULTIPLE_CANONICAL_PATHS", filePath, id, `canonical path already exists at ${byId.get(id).path}`);
      }
    } else {
      byId.set(id, document);
    }
    if (byPath.has(filePath)) {
      addError(errors, "DUPLICATE_DOCUMENT_PATH", filePath, id, `also used by ${byPath.get(filePath).id}`);
    } else {
      byPath.set(filePath, document);
    }

    const normalized = path.posix.normalize(filePath);
    const absolute = path.resolve(root, filePath);
    if (
      filePath.includes("\\") ||
      normalized !== filePath ||
      !filePath.startsWith("docs/") ||
      !filePath.endsWith(".md") ||
      !isInsideRoot(absolute, root)
    ) {
      addError(errors, "INVALID_DOCUMENT_PATH", filePath, id, "path must be a normalized repository-relative Markdown path under docs/");
    } else if (!fs.existsSync(absolute)) {
      addError(errors, "MISSING_DOCUMENT_PATH", filePath, id, "registered path does not exist");
    }

    if (typeof document.title !== "string" || document.title.trim() === "") addError(errors, "INVALID_TITLE", filePath, id, "title is required");
    if (!DOCUMENT_TYPES.has(document.type)) addError(errors, "INVALID_DOCUMENT_TYPE", filePath, id, String(document.type));
    if (!DOCUMENT_SCOPES.has(document.scope)) addError(errors, "INVALID_DOCUMENT_SCOPE", filePath, id, String(document.scope));
    if (!DOCUMENT_STATUSES.has(document.status)) addError(errors, "INVALID_DOCUMENT_STATUS", filePath, id, String(document.status));
    if (!SEMVER.test(document.version ?? "")) addError(errors, "INVALID_DOCUMENT_VERSION", filePath, id, String(document.version));
    if (typeof document.owner !== "string" || document.owner.trim() === "") addError(errors, "INVALID_DOCUMENT_OWNER", filePath, id, "owner is required");
    if (typeof document.canonical !== "boolean") addError(errors, "INVALID_CANONICAL_FLAG", filePath, id, "canonical must be boolean");
    if (!Array.isArray(document.supersedes)) addError(errors, "INVALID_SUPERSEDES", filePath, id, "supersedes must be an array");
    if (!REVIEW_CADENCES.has(document.review_cadence)) addError(errors, "INVALID_REVIEW_CADENCE", filePath, id, String(document.review_cadence));
  }

  for (const document of documents) {
    const id = document?.id ?? "unknown";
    const filePath = document?.path ?? DOCUMENT_REGISTRY;
    for (const replacedId of Array.isArray(document?.supersedes) ? document.supersedes : []) {
      if (!byId.has(replacedId)) addError(errors, "UNKNOWN_SUPERSEDED_DOCUMENT", filePath, id, replacedId);
    }
    if (document?.status === "superseded") {
      if (typeof document.superseded_by !== "string" || !byId.has(document.superseded_by)) {
        addError(errors, "MISSING_SUPERSEDING_DOCUMENT", filePath, id, "superseded document must reference a registered replacement");
      } else if (document.superseded_by === id) {
        addError(errors, "SELF_SUPERSESSION", filePath, id, "document cannot supersede itself");
      }
    }
  }

  const migrationManifest = Array.isArray(registry.migration_manifest) ? registry.migration_manifest : [];
  const exceptions = new Set();
  for (const item of migrationManifest) {
    const filePath = item?.path ?? DOCUMENT_REGISTRY;
    if (
      typeof item?.path !== "string" ||
      typeof item?.owner !== "string" ||
      typeof item?.reason !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item?.expires_on ?? "")
    ) {
      addError(errors, "INVALID_MIGRATION_EXCEPTION", filePath, "migration-manifest", "path, owner, reason and expires_on are required");
    } else {
      exceptions.add(item.path);
    }
  }

  for (const markdownPath of listFiles(root, "docs", file => file.endsWith(".md"))) {
    if (!byPath.has(markdownPath) && !exceptions.has(markdownPath)) {
      addError(errors, "UNREGISTERED_MARKDOWN", markdownPath, "unregistered", "every Markdown document must be registered");
    }
  }

  return { documents, byId, byPath };
}

function validateProductRegistry(registry, documentIndex, errors) {
  if (!registry || !SEMVER.test(registry.schema_version ?? "")) {
    addError(errors, "INVALID_SCHEMA_VERSION", PRODUCT_REGISTRY, "product-registry", "schema_version must be SemVer");
  }
  if (!Array.isArray(registry?.products)) {
    addError(errors, "INVALID_PRODUCT_COLLECTION", PRODUCT_REGISTRY, "product-registry", "products must be an array");
    return [];
  }

  const required = [
    "product_id",
    "name",
    "owner",
    "status",
    "hero_control_plane",
    "test_environment_reference",
    "production_environment_reference",
    "inherited_document_ids",
    "product_specific_document_ids",
    "release_policy"
  ];
  const ids = new Set();
  for (const product of registry.products) {
    const productId = typeof product?.product_id === "string" ? product.product_id : "unknown";
    for (const field of required) {
      if (!(field in (product ?? {}))) addError(errors, "MISSING_PRODUCT_FIELD", PRODUCT_REGISTRY, productId, `missing field ${field}`);
    }
    if (!DOCUMENT_ID.test(productId)) addError(errors, "INVALID_PRODUCT_ID", PRODUCT_REGISTRY, productId, "product_id must use uppercase stable characters");
    if (ids.has(productId)) addError(errors, "DUPLICATE_PRODUCT_ID", PRODUCT_REGISTRY, productId, "product_id must be unique");
    ids.add(productId);
    if (!PRODUCT_STATUSES.has(product.status)) addError(errors, "INVALID_PRODUCT_STATUS", PRODUCT_REGISTRY, productId, String(product.status));
    for (const field of ["name", "owner", "hero_control_plane", "test_environment_reference", "production_environment_reference", "release_policy"]) {
      if (typeof product[field] !== "string" || product[field].trim() === "") {
        addError(errors, "INVALID_PRODUCT_FIELD", PRODUCT_REGISTRY, productId, `${field} must be a non-empty string`);
      }
    }
    for (const field of ["inherited_document_ids", "product_specific_document_ids"]) {
      if (!Array.isArray(product[field])) {
        addError(errors, "INVALID_PRODUCT_DOCUMENT_LIST", PRODUCT_REGISTRY, productId, `${field} must be an array`);
        continue;
      }
      for (const documentId of product[field]) {
        const referenced = documentIndex.byId.get(documentId);
        if (!referenced) {
          addError(errors, "UNKNOWN_PRODUCT_DOCUMENT", PRODUCT_REGISTRY, productId, `${field}:${documentId}`);
        } else if (referenced.canonical !== true) {
          addError(errors, "NONCANONICAL_PRODUCT_DOCUMENT", PRODUCT_REGISTRY, productId, `${field}:${documentId}`);
        } else if (field === "product_specific_document_ids" && referenced.scope !== "product") {
          addError(errors, "INVALID_PRODUCT_DOCUMENT_SCOPE", PRODUCT_REGISTRY, productId, `${field}:${documentId} must have product scope`);
        } else if (field === "inherited_document_ids" && referenced.scope === "product") {
          addError(errors, "INVALID_INHERITED_DOCUMENT_SCOPE", PRODUCT_REGISTRY, productId, `${field}:${documentId} must be shared`);
        }
      }
    }
    for (const field of ["test_environment_reference", "production_environment_reference", "release_policy"]) {
      const documentId = product[field];
      if (typeof documentId === "string" && documentId !== "") {
        const referenced = documentIndex.byId.get(documentId);
        if (!referenced) {
          addError(errors, "UNKNOWN_PRODUCT_DOCUMENT", PRODUCT_REGISTRY, productId, `${field}:${documentId}`);
        } else if (referenced.canonical !== true) {
          addError(errors, "NONCANONICAL_PRODUCT_DOCUMENT", PRODUCT_REGISTRY, productId, `${field}:${documentId}`);
        } else if (field !== "release_policy" && referenced.scope !== "product") {
          addError(errors, "INVALID_PRODUCT_DOCUMENT_SCOPE", PRODUCT_REGISTRY, productId, `${field}:${documentId} must have product scope`);
        }
      }
    }
  }
  return registry.products;
}

function withoutFencedCode(content) {
  let fence = null;
  return content.split(/\r?\n/).map(line => {
    const marker = line.match(/^\s*(```|~~~)/)?.[1] ?? null;
    if (marker) {
      fence = fence === null ? marker : fence === marker ? null : fence;
      return "";
    }
    return fence === null ? line : "";
  }).join("\n");
}

function validateLinks(root, documentIndex, errors) {
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const document of documentIndex.documents) {
    const filePath = document.path;
    const absolute = path.join(root, filePath);
    if (!fs.existsSync(absolute)) continue;
    const content = withoutFencedCode(fs.readFileSync(absolute, "utf8"));
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      let target = match[1].replace(/^<|>$/g, "");
      if (target.startsWith("#") || target.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) continue;
      target = target.split("#", 1)[0].split("?", 1)[0];
      if (target === "") continue;
      try {
        target = decodeURIComponent(target);
      } catch {
        addError(errors, "INVALID_LINK_ENCODING", filePath, document.id, match[1]);
        continue;
      }
      if (path.isAbsolute(target)) {
        addError(errors, "ABSOLUTE_INTERNAL_LINK", filePath, document.id, target);
        continue;
      }
      const resolved = path.resolve(path.dirname(absolute), target);
      if (!isInsideRoot(resolved, root)) {
        addError(errors, "LINK_OUTSIDE_REPOSITORY", filePath, document.id, target);
      } else if (!fs.existsSync(resolved)) {
        addError(errors, "BROKEN_INTERNAL_LINK", filePath, document.id, target);
      }
    }
  }
}

function validateSecretPatterns(root, errors) {
  const files = listFiles(root, "docs", file => file.endsWith(".md") || file.endsWith(".json"));
  const highConfidencePatterns = [
    ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ["GITHUB_TOKEN", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
    ["AWS_ACCESS_KEY", /\bAKIA[0-9A-Z]{16}\b/g],
    ["GOOGLE_API_KEY", /\bAIza[0-9A-Za-z_-]{30,}\b/g],
    ["OPENAI_API_KEY", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g]
  ];
  const assignment = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z0-9_]*)\s*=\s*(.*?)\s*$/gm;
  const credentialUri = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s/]+:([^@\s]+)@/g;

  for (const filePath of files) {
    const content = fs.readFileSync(path.join(root, filePath), "utf8");
    for (const [name, pattern] of highConfidencePatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (match) {
        const line = content.slice(0, match.index).split(/\r?\n/).length;
        addError(errors, "POSSIBLE_SECRET", filePath, "content", `${name} pattern at line ${line}`);
      }
    }
    assignment.lastIndex = 0;
    let match;
    while ((match = assignment.exec(content)) !== null) {
      const value = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (value === "" || /^(?:<|\$\{|\{\$|\[?REDACTED|CHANGEME|EXAMPLE)/i.test(value)) continue;
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      addError(errors, "POSSIBLE_SECRET_ASSIGNMENT", filePath, "content", `${match[1]} has a non-placeholder value at line ${line}`);
    }
    credentialUri.lastIndex = 0;
    while ((match = credentialUri.exec(content)) !== null) {
      if (/^(?:<|\$\{|\{\$|\[?REDACTED)/i.test(match[1])) continue;
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      addError(errors, "POSSIBLE_CREDENTIAL_URI", filePath, "content", `credential-bearing URI at line ${line}`);
    }
  }
}

export function validateDocumentation({ root = REPO_ROOT } = {}) {
  const errors = [];
  const documentRegistry = readJson(root, DOCUMENT_REGISTRY, errors);
  const productRegistry = readJson(root, PRODUCT_REGISTRY, errors);
  const documentIndex = validateDocumentRegistry(root, documentRegistry, errors);
  const products = validateProductRegistry(productRegistry, documentIndex, errors);
  validateLinks(root, documentIndex, errors);
  validateSecretPatterns(root, errors);
  errors.sort((a, b) => `${a.path}:${a.code}:${a.documentId}`.localeCompare(`${b.path}:${b.code}:${b.documentId}`));
  return {
    documents: documentIndex.documents.length,
    products: products.length,
    errors
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === invokedFile) {
  const report = validateDocumentation();
  for (const error of report.errors) {
    console.error(`ERROR ${error.code} path=${error.path} document_id=${error.documentId} detail=${error.detail}`);
  }
  console.log(
    `Documentation check: ${report.errors.length === 0 ? "PASS" : "FAIL"} — ${report.documents} documents, ${report.products} products, ${report.errors.length} error(s)`
  );
  if (report.errors.length > 0) process.exitCode = 1;
}
