import fs from "node:fs";

function loadRuntimeEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const separator = normalized.indexOf("=");
    if (separator < 1) continue;
    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

loadRuntimeEnv();

const enabled = process.env.HERO_NOTION_ENABLED === "true";
const token = process.env.HERO_NOTION_API_TOKEN ?? "";
const parentPageId = process.env.HERO_NOTION_PARENT_PAGE_ID ?? "";
const apiVersion = process.env.HERO_NOTION_API_VERSION ?? "2026-03-11";
const classifications = (process.env.HERO_NOTION_ALLOWED_CLASSIFICATIONS ?? "internal").split(",").map(value => value.trim()).filter(Boolean);
const errors = [];

if (!enabled) {
  console.log("Notion preflight: PASS — connector disabled; no external request is allowed.");
  process.exit(0);
}

if (token.trim() === "" || /^(?:<|CHANGEME|REDACTED)/i.test(token.trim())) errors.push("HERO_NOTION_API_TOKEN is required at runtime and must not be a placeholder.");
if (!/^[A-Za-z0-9-]{16,64}$/.test(parentPageId)) errors.push("HERO_NOTION_PARENT_PAGE_ID must be a valid Notion page identifier.");
if (apiVersion !== "2026-03-11") errors.push("HERO_NOTION_API_VERSION must be 2026-03-11 for the current Markdown API adapter.");
if (!classifications.includes("internal")) errors.push("HERO_NOTION_ALLOWED_CLASSIFICATIONS must include internal for the first controlled pilot.");

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR NOTION_CONFIG ${error}`);
  console.log("Notion preflight: FAIL — no external request was made.");
  process.exitCode = 1;
} else {
  console.log("Notion preflight: PASS — local configuration shape is valid; network and write authorization remain separate gates.");
}
