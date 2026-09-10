import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateDocumentation } from "../tools/check-documentation.mjs";

function document(id, filePath, overrides = {}) {
  return {
    id,
    path: filePath,
    title: id,
    type: "governance",
    scope: "hero",
    status: "active",
    version: "1.0.0",
    owner: "test-owner",
    canonical: true,
    supersedes: [],
    superseded_by: null,
    review_cadence: "per-change",
    ...overrides
  };
}

function fixture(documents, products = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hero-docs-"));
  fs.mkdirSync(path.join(root, "docs", "registry"), { recursive: true });
  for (const item of documents) {
    const absolute = path.join(root, item.path);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, item.content ?? `# ${item.id}\n`, "utf8");
  }
  fs.writeFileSync(path.join(root, "docs", "registry", "document-registry.json"), JSON.stringify({
    schema_version: "1.0.0",
    migration_manifest: [],
    documents: documents.map(({ content, ...item }) => item)
  }), "utf8");
  fs.writeFileSync(path.join(root, "docs", "registry", "product-registry.json"), JSON.stringify({
    schema_version: "1.0.0",
    products
  }), "utf8");
  return root;
}

test("the repository documentation library is valid and fully registered", () => {
  const report = validateDocumentation();
  assert.equal(report.documents >= 87, true);
  assert.deepEqual(report.errors, []);
});

test("duplicate IDs and competing canonical paths fail with exact context", t => {
  const docs = [
    { ...document("HERO-DOC-ONE", "docs/one.md"), content: "# One\n" },
    { ...document("HERO-DOC-ONE", "docs/two.md"), content: "# Two\n" }
  ];
  const root = fixture(docs);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const report = validateDocumentation({ root });
  assert.ok(report.errors.some(error => error.code === "DUPLICATE_DOCUMENT_ID" && error.documentId === "HERO-DOC-ONE"));
  assert.ok(report.errors.some(error => error.code === "MULTIPLE_CANONICAL_PATHS" && error.path === "docs/two.md"));
});

test("unregistered Markdown, broken links and secret assignments fail closed", t => {
  const docs = [{
    ...document("HERO-DOC-ONE", "docs/one.md"),
    content: "# One\n\n[missing](missing.md)\n\nHERO_API_KEY=not-a-placeholder-value\n"
  }];
  const root = fixture(docs);
  fs.writeFileSync(path.join(root, "docs", "unregistered.md"), "# Unregistered\n", "utf8");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const report = validateDocumentation({ root });
  assert.ok(report.errors.some(error => error.code === "UNREGISTERED_MARKDOWN" && error.path === "docs/unregistered.md"));
  assert.ok(report.errors.some(error => error.code === "BROKEN_INTERNAL_LINK" && error.documentId === "HERO-DOC-ONE"));
  assert.ok(report.errors.some(error => error.code === "POSSIBLE_SECRET_ASSIGNMENT" && error.path === "docs/one.md"));
});

test("superseded documents and Product references require registered replacements", t => {
  const docs = [{
    ...document("HERO-DOC-OLD", "docs/old.md", {
      status: "superseded",
      superseded_by: "HERO-DOC-MISSING",
      canonical: false,
      scope: "cross-project"
    }),
    content: "# Old\n"
  }];
  const products = [{
    product_id: "PRODUCT-ONE",
    name: "Product One",
    owner: "product-owner",
    status: "proposed",
    hero_control_plane: "hero-production",
    test_environment_reference: "PRODUCT-TEST-MISSING",
    production_environment_reference: "PRODUCT-PRODUCTION-MISSING",
    inherited_document_ids: ["HERO-DOC-OLD", "HERO-DOC-MISSING"],
    product_specific_document_ids: [],
    release_policy: "HERO-RELEASE-MISSING"
  }];
  const root = fixture(docs, products);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const report = validateDocumentation({ root });
  assert.ok(report.errors.some(error => error.code === "MISSING_SUPERSEDING_DOCUMENT" && error.documentId === "HERO-DOC-OLD"));
  assert.ok(report.errors.some(error => error.code === "UNKNOWN_PRODUCT_DOCUMENT" && error.documentId === "PRODUCT-ONE"));
  assert.ok(report.errors.some(error => error.code === "NONCANONICAL_PRODUCT_DOCUMENT" && error.documentId === "PRODUCT-ONE"));
});
