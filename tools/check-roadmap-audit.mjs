import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    return { ordinal, reference };
  });
  if (parsed.length !== expectedCount) errors.push(`${name} must contain exactly ${expectedCount} numbered rows; found ${parsed.length}.`);
  const references = parsed.map(row => row.reference).filter(Boolean);
  if (new Set(references).size !== references.length) errors.push(`${name} contains duplicate roadmap references.`);
  return errors;
}

const errors = [
  ...validate("OPEN-50", read(files.open50), 50),
  ...validate("NEXT-100", read(files.next100), 100)
];

if (errors.length > 0) {
  console.error("Roadmap audit: FAILED");
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("Roadmap audit: PASS — OPEN-50=50, NEXT-100=100, required fields and references are valid.");
}
