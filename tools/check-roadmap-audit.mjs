import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HERO_OPEN_ROADMAP } from "../packages/contracts/src/roadmap.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = Object.freeze({
  open50: path.join(root, "docs", "roadmap", "OPEN-50-PRIORITY-20260904.md"),
  next100: path.join(root, "docs", "roadmap", "NEXT-100-STEPS-20260904.md")
});

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

function toAsciiDigits(value) {
  return String(value).replace(/[۰-۹٠-٩]/g, digit => {
    const index = persianDigits.indexOf(digit);
    if (index >= 0) return String(index);
    const arabicIndex = arabicDigits.indexOf(digit);
    return arabicIndex >= 0 ? String(arabicIndex) : digit;
  });
}

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Roadmap file is missing: ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

function rows(source) {
  return source.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^\|\s*[۰-۹٠-٩]+\s*\|/.test(line));
}

function validate(name, source, expectedCount) {
  const errors = [];
  const parsed = rows(source).map((line, index) => {
    const columns = line.split("|").slice(1, -1).map(value => value.trim());
    const ordinal = Number(toAsciiDigits(columns[0] ?? ""));
    const reference = columns[1] ?? "";
    if (columns.length !== 5) errors.push(`${name} row ${index + 1} must have five table columns.`);
    if (!Number.isInteger(ordinal) || ordinal !== index + 1) errors.push(`${name} row ${index + 1} has a non-contiguous ordinal.`);
    if (columns.slice(1).some(value => value.length === 0)) errors.push(`${name} row ${index + 1} has an empty required field.`);
    const status = name === "OPEN-50" ? columns[3] ?? "" : columns[2] ?? "";
    return { ordinal, reference, status };
  });
  if (parsed.length !== expectedCount) errors.push(`${name} must contain exactly ${expectedCount} numbered rows; found ${parsed.length}.`);
  const references = parsed.map(row => row.reference).filter(Boolean);
  if (new Set(references).size !== references.length) errors.push(`${name} contains duplicate roadmap references.`);
  return { errors, parsed };
}

const open50 = validate("OPEN-50", read(files.open50), 50);
const next100 = validate("NEXT-100", read(files.next100), 100);
const nextOrdinals = new Set(next100.parsed.map(row => row.ordinal));
for (const row of open50.parsed) {
  const reference = Number(toAsciiDigits(row.reference));
  if (Number.isInteger(reference) && !nextOrdinals.has(reference)) {
    open50.errors.push(`OPEN-50 row ${row.ordinal} references missing NEXT-100 step ${row.reference}.`);
  }
}
const open50ByReference = new Map(open50.parsed.map(row => [toAsciiDigits(row.reference), row]));
const next100ByOrdinal = new Map(next100.parsed.map(row => [String(row.ordinal), row]));
for (const contractRow of HERO_OPEN_ROADMAP) {
  const reference = String(contractRow.reference);
  const open50Row = open50ByReference.get(reference);
  const next100Row = next100ByOrdinal.get(reference);
  if (!open50Row || open50Row.status !== contractRow.status) {
    open50.errors.push(`OPEN-50 status for reference ${reference} must match the contract.`);
  }
  if (!next100Row || next100Row.status !== contractRow.status) {
    next100.errors.push(`NEXT-100 status for reference ${reference} must match the contract.`);
  }
}
const errors = [...open50.errors, ...next100.errors];

if (errors.length > 0) {
  console.error("Roadmap audit: FAILED");
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("Roadmap audit: PASS — OPEN-50=50, NEXT-100=100, required fields, cross-references and selected status parity are valid.");
}
