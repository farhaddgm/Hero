import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DOCUMENT_EDIT_CLASSES,
  PRODUCT_DOCUMENT_REQUIRED_ROLES,
  validateDocumentCatalogEntry,
  validateProductManifest,
  roadmapStatusFromText
} from "../../contracts/src/index.mjs";
import { HERO_OPEN_ROADMAP } from "../../contracts/src/roadmap.mjs";
import { createRoadmapGraph, evaluateProductCompleteness } from "./roadmap-completeness.mjs";

const DOCUMENT_REGISTRY = path.join("docs", "registry", "document-registry.json");
const PRODUCT_REGISTRY = path.join("docs", "registry", "product-registry.json");
const MANIFEST_FILE = "hero-product.json";
const ROADMAP_GRAPH_FILE = path.join("config", "product-development", "hero-roadmap-graph.json");

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function withoutVolatileIndexTimestamps(value) {
  if (Array.isArray(value)) return value.map(withoutVolatileIndexTimestamps);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "lastIndexedAt").map(([key, nested]) => [key, withoutVolatileIndexTimestamps(nested)]));
}

function isInsideRoot(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function readJson(root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  if (!isInsideRoot(absolute, root) && absolute !== root) throw new ProductDevelopmentError("PATH_OUTSIDE_REPOSITORY", `Path is outside the repository: ${relativePath}`);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function readOptionalJson(root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  if (!isInsideRoot(absolute, root) && absolute !== root) throw new ProductDevelopmentError("PATH_OUTSIDE_REPOSITORY", `Path is outside the repository: ${relativePath}`);
  if (!fs.existsSync(absolute)) return null;
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function editClassFor(document) {
  if (document.type === "evidence" || document.id.includes("AUTHORIZATION") || document.id.includes("RELEASE")) return "mirror-only";
  if (document.type === "architecture" || document.type === "governance" || document.type === "decision") return "protected-proposal";
  if (document.type === "roadmap" || document.type === "specification" || document.type === "operation" || document.type === "template") return "proposal-editable";
  return "notion-working-note";
}

function documentRole(document) {
  const value = `${document.id} ${document.path} ${document.title}`.toLowerCase();
  if (value.includes("brief")) return "brief";
  if (value.includes("test-environment") || value.includes("test_environment") || value.includes("test")) return "test-environment";
  if (value.includes("release-policy") || value.includes("release_policy")) return "release-policy";
  return null;
}

function documentClassification(document) {
  return ["public", "internal", "restricted"].includes(document.classification) ? document.classification : "internal";
}

function documentClassificationSource(document) {
  return ["public", "internal", "restricted"].includes(document.classification) ? "explicit" : "default-internal";
}

function readSourceCommit() {
  const value = process.env.HERO_SOURCE_COMMIT;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "workspace-uncommitted";
}

export class ProductDevelopmentError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "ProductDevelopmentError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createProductDevelopmentCatalog({ root = process.cwd(), sourceCommit = readSourceCommit(), now = () => new Date().toISOString() } = {}) {
  const repositoryRoot = path.resolve(root);
  const proposals = new Map();

  function load() {
    const documentRegistry = readJson(repositoryRoot, DOCUMENT_REGISTRY);
    const productRegistry = readJson(repositoryRoot, PRODUCT_REGISTRY);
    const registryDocuments = Array.isArray(documentRegistry.documents) ? documentRegistry.documents : [];
    const registryProducts = Array.isArray(productRegistry.products) ? productRegistry.products : [];
    const errors = [];
    const documents = [];
    const documentById = new Map();
    const manifestPath = path.join(repositoryRoot, MANIFEST_FILE);
    let manifest = null;
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        for (const error of validateProductManifest(manifest)) errors.push({ code: "INVALID_PRODUCT_MANIFEST", detail: error });
      } catch (error) {
        errors.push({ code: "INVALID_PRODUCT_MANIFEST_JSON", detail: error.message });
      }
    }

    let roadmapGraph = null;
    try {
      const configuredGraph = readOptionalJson(repositoryRoot, ROADMAP_GRAPH_FILE);
      if (configuredGraph) roadmapGraph = createRoadmapGraph(configuredGraph);
    } catch (error) {
      errors.push({ code: "INVALID_ROADMAP_GRAPH", detail: error.message });
    }

    for (const entry of registryDocuments) {
      const entryErrors = validateDocumentCatalogEntry(entry);
      for (const detail of entryErrors) errors.push({ code: "INVALID_DOCUMENT_ENTRY", documentId: entry?.id ?? "unknown", detail });
      if (documentById.has(entry.id)) errors.push({ code: "DUPLICATE_DOCUMENT_ID", documentId: entry.id, detail: "document id is duplicated" });
      const absolutePath = path.resolve(repositoryRoot, entry.path);
      if (!isInsideRoot(absolutePath, repositoryRoot)) {
        errors.push({ code: "DOCUMENT_OUTSIDE_REPOSITORY", documentId: entry.id, detail: entry.path });
        continue;
      }
      const exists = fs.existsSync(absolutePath);
      const content = exists ? fs.readFileSync(absolutePath, "utf8") : "";
      if (!exists) errors.push({ code: "MISSING_DOCUMENT_FILE", documentId: entry.id, detail: entry.path });
      const document = immutableCopy({
        ...entry,
        exists,
        editClass: editClassFor(entry),
        role: documentRole(entry),
        classification: documentClassification(entry),
        classificationSource: documentClassificationSource(entry),
        notionEligible: documentClassification(entry) !== "restricted",
        sourceCommit,
        checksum: hash(content),
        bytes: Buffer.byteLength(content),
        lastIndexedAt: now()
      });
      documents.push(document);
      documentById.set(entry.id, document);
    }

    const products = registryProducts.map(product => {
      const relationErrors = [];
      const inheritedDocuments = [];
      const productDocuments = [];
      for (const documentId of [...(product.inherited_document_ids ?? []), ...(product.product_specific_document_ids ?? []), product.release_policy].filter(Boolean)) {
        const document = documentById.get(documentId);
        if (!document) {
          relationErrors.push(`missing document ${documentId}`);
          continue;
        }
        if (product.inherited_document_ids?.includes(documentId)) inheritedDocuments.push(document);
        else productDocuments.push(document);
      }
      const requiredRoles = PRODUCT_DOCUMENT_REQUIRED_ROLES.map(role => ({
        role,
        documents: productDocuments.filter(document => document.role === role),
        satisfied: productDocuments.some(document => document.role === role && document.exists && document.status === "active")
      }));
      const stage = product.lifecycle_stage ?? (product.status === "active" ? "in-development" : product.status === "retired" || product.status === "archived" ? "retiring" : "proposed");
      const completeness = evaluateProductCompleteness({
        product: { ...product, relationErrors },
        productDocuments,
        documents: [...inheritedDocuments, ...productDocuments],
        stage,
        riskProfile: product.risk_profile ?? (product.product_id === manifest?.product_id ? manifest?.risk_profile ?? {} : {})
      });
      return immutableCopy({
        ...product,
        inheritedDocuments,
        productDocuments,
        relationErrors,
        requiredRoles,
        completeness: {
          ...completeness,
          passed: completeness.checks.filter(check => check.passed).length,
          total: completeness.checks.length,
          stage
        },
        sourceCommit
      });
    });

    const roadmap = HERO_OPEN_ROADMAP.map(row => immutableCopy({
      id: `HERO-ROADMAP-${String(row.order).padStart(3, "0")}`,
      order: row.order,
      reference: row.reference,
      title: row.title,
      statusLabel: row.status,
      nextAction: row.next,
      status: roadmapStatusFromText(row.status),
      owner: "project-owner",
      productId: "HERO-PRODUCT-HERO-001",
      dependencies: [],
      evidence: row.status.includes("Evidence") || row.status.includes("انجام شد") || row.status.includes("تأیید")
    }));

    const snapshot = {
      schemaVersion: "1.0",
      generatedAt: now(),
      source: { kind: "git", repositoryRoot: repositoryRoot === process.cwd() ? "." : "configured-repository", commit: sourceCommit, registry: DOCUMENT_REGISTRY },
      manifest,
      products,
      documents,
      roadmap,
      roadmapGraph,
      errors,
      summary: {
        productCount: products.length,
        documentCount: documents.length,
        activeDocumentCount: documents.filter(document => document.status === "active").length,
        missingDocumentCount: documents.filter(document => !document.exists).length,
        roadmapCount: roadmap.length,
        blockedRoadmapCount: roadmap.filter(item => item.status === "blocked").length,
        roadmapGraphNodeCount: roadmapGraph?.summary.nodeCount ?? 0,
        roadmapGraphBlockedCount: roadmapGraph?.summary.blockedCount ?? 0,
        roadmapGraphCycleCount: roadmapGraph?.summary.dependencyCycleCount ?? 0,
        completeness: products.length === 0 ? 0 : Math.round(products.reduce((total, product) => total + product.completeness.score, 0) / products.length),
        errorCount: errors.length
      }
    };
    snapshot.digest = hash(JSON.stringify(withoutVolatileIndexTimestamps({ products: snapshot.products, documents: snapshot.documents, roadmap: snapshot.roadmap, roadmapGraph: snapshot.roadmapGraph, errors: snapshot.errors })));
    return immutableCopy(snapshot);
  }

  function document(documentId) {
    const snapshot = load();
    const entry = snapshot.documents.find(item => item.id === documentId);
    if (!entry) throw new ProductDevelopmentError("DOCUMENT_NOT_FOUND", `Document ${documentId} was not found.`, 404);
    if (!entry.exists) throw new ProductDevelopmentError("DOCUMENT_FILE_NOT_FOUND", `Document file ${entry.path} was not found.`, 404);
    const absolutePath = path.resolve(repositoryRoot, entry.path);
    return immutableCopy({ ...entry, content: fs.readFileSync(absolutePath, "utf8") });
  }

  function search({ query = "", productId } = {}) {
    const normalized = String(query).trim().toLocaleLowerCase("fa");
    const snapshot = load();
    const allowedDocumentIds = productId
      ? new Set(snapshot.products.find(product => product.product_id === productId)?.productDocuments.map(item => item.id) ?? [])
      : null;
    return Object.freeze(snapshot.documents.filter(entry => {
      if (allowedDocumentIds && !allowedDocumentIds.has(entry.id)) return false;
      if (!normalized) return true;
      const haystack = `${entry.id} ${entry.title} ${entry.path} ${entry.type} ${entry.owner}`.toLocaleLowerCase("fa");
      return haystack.includes(normalized);
    }).slice(0, 100));
  }

  function createChangeProposal({ documentId, proposedContent, actor = "project-owner", reason = "notion-edit" } = {}) {
    const entry = document(documentId);
    if (typeof proposedContent !== "string" || proposedContent.length > 512_000) throw new ProductDevelopmentError("INVALID_PROPOSED_CONTENT", "Proposed content must be a string smaller than 512KB.");
    if (entry.editClass === "mirror-only") throw new ProductDevelopmentError("DOCUMENT_MIRROR_ONLY", "این سند فقط از Git به نماها منتشر می‌شود و از Notion قابل ویرایش نیست.", 403);
    const proposalId = `DCP-${hash(`${documentId}:${entry.checksum}:${proposedContent}:${actor}`).slice(0, 20)}`;
    const proposal = immutableCopy({
      proposalId,
      documentId,
      baseChecksum: entry.checksum,
      proposedChecksum: hash(proposedContent),
      editClass: entry.editClass,
      actor,
      reason,
      status: "proposed",
      createdAt: now(),
      gitWrite: "not-executed",
      nextStep: "review-and-branch"
    });
    proposals.set(proposalId, proposal);
    return proposal;
  }

  function listChangeProposals() {
    return Object.freeze([...proposals.values()]);
  }

  return Object.freeze({ load, snapshot: load, document, search, createChangeProposal, listChangeProposals, contract: () => ({ editClasses: DOCUMENT_EDIT_CLASSES }) });
}
