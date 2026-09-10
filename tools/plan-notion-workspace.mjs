import fs from "node:fs";

import { createNotionWorkspaceBlueprint } from "../packages/contracts/src/index.mjs";
import { createProductDevelopmentCatalog } from "../packages/domain/src/product-development.mjs";

const allowlist = JSON.parse(fs.readFileSync("config/product-development/notion-allowlist.json", "utf8"));
const catalog = createProductDevelopmentCatalog({ root: process.cwd(), sourceCommit: process.env.HERO_SOURCE_COMMIT || "workspace-uncommitted" });
const blueprint = createNotionWorkspaceBlueprint();
const documents = (allowlist.documents ?? []).map(item => {
  const document = catalog.document(item.document_id);
  return {
    documentId: document.id,
    title: document.title,
    classification: document.classification ?? "internal-by-policy",
    editPolicy: document.editClass,
    approved: item.external_write_approved === true,
    sourceChecksum: document.checksum
  };
});

console.log(JSON.stringify({
  mode: allowlist.mode,
  externalRequests: 0,
  workspace: blueprint,
  allowlist: documents,
  nextGate: "owner-approval-required-before-adding-more-documents"
}, null, 2));
