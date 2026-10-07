// Shared, dependency-free audit helpers used by the local audit runner, the test
// suite and the Test-host acceptance. Every function returns counted checks so a
// result can be recorded as evidence without anyone asserting that it passed.
import crypto from "node:crypto";

export const AUDIT_LIB_VERSION = "1.0";
// Canonical form: object keys are sorted, so the same content has the same digest however a store (PostgreSQL jsonb reorders keys) returns it.
export function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value) ?? "null"; }
export const sha256 = value => `sha256:${crypto.createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex")}`;

/** Collects named checks; `finish` returns the counted result and the digest of the raw output. */
export function createRecorder(tool) {
  const results = [];
  return {
    check(name, ok, detail = "") { results.push({ name, ok: Boolean(ok), ...(detail && !ok ? { detail: String(detail).slice(0, 300) } : {}) }); return Boolean(ok); },
    finish(extra = {}) {
      const raw = JSON.stringify({ tool, version: AUDIT_LIB_VERSION, results, ...extra });
      const passed = results.filter(item => item.ok).length;
      return { tool, toolVersion: AUDIT_LIB_VERSION, evidenceDigest: sha256(raw), checks: { total: results.length, passed }, findings: results.filter(item => !item.ok).map(item => `${item.name}${item.detail ? `: ${item.detail}` : ""}`), results };
    }
  };
}

// ---------- WCAG contrast ----------
function hexToRgb(hex) {
  const value = hex.replace("#", ""); const full = value.length === 3 ? [...value].map(character => character + character).join("") : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));
}
const channel = value => { const scaled = value / 255; return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4; };
const luminance = rgb => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
export function contrastRatio(foreground, background) {
  const a = hexToRgb(foreground); const b = hexToRgb(background); if (!a || !b) return null;
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Resolves a colour, following `var(--token)` chains through the token table. */
function resolveColor(value, tokens, depth = 0) {
  const text = String(value).trim().toLowerCase(); if (depth > 8) return null;
  const variable = text.match(/^var\(--([a-z0-9-]+)(?:\s*,\s*([^)]+))?\)$/);
  if (variable) { const next = tokens[variable[1]] ?? variable[2]; return next === undefined ? null : resolveColor(next, tokens, depth + 1); }
  if (text === "white") return "#ffffff"; if (text === "black") return "#000000";
  if (/^#[0-9a-f]{3}$/.test(text)) return `#${[...text.slice(1)].map(character => character + character).join("")}`;
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  return null;
}
/**
 * Every rule that sets both a text colour and a background colour is measured at 4.5:1.
 * A page can carry a light and a dark theme: tokens declared under a selector that
 * mentions "dark" apply only to the dark pass, and each rule is measured under every
 * theme it can render in.
 */
export function auditContrast(html) {
  const style = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join("\n");
  const rules = [...style.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(rule => ({ selector: rule[1].trim().replace(/\s+/g, " ").replace(/^.*\*\/\s*/, ""), body: rule[2] }));
  const isDark = selector => /dark/i.test(selector);
  const light = {}; const dark = {};
  for (const rule of rules) for (const token of rule.body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/g)) { const value = token[2].trim(); if (!isDark(rule.selector)) { light[token[1]] = value; dark[token[1]] ??= value; } }
  Object.assign(dark, light); for (const rule of rules) if (isDark(rule.selector)) for (const token of rule.body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/g)) dark[token[1]] = token[2].trim();
  const pairs = [];
  for (const rule of rules) {
    const foreground = rule.body.match(/(?:^|;|\s)color\s*:\s*([^;]+)/i)?.[1]; const background = rule.body.match(/background(?:-color)?\s*:\s*([^;]+)/i)?.[1]; if (!foreground || !background) continue;
    for (const [theme, tokens] of (isDark(rule.selector) ? [["dark", dark]] : [["light", light], ["dark", dark]])) {
      const fg = resolveColor(foreground, tokens); const bg = resolveColor(background.trim().split(/\s+/)[0], tokens);
      if (fg && bg) pairs.push({ selector: `${rule.selector.slice(0, 80)} [${theme}]`, foreground: fg, background: bg, ratio: Number(contrastRatio(fg, bg).toFixed(2)) });
    }
  }
  return pairs;
}

// ---------- structure ----------
const strip = markup => markup.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
const text = markup => strip(markup).replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ?? (new RegExp(`\\s${name}(\\s|>|/)`, "i").test(tag) ? "" : null);

/** Accessibility checks for one rendered page: structure, names, labels, focus, contrast and non-colour status. */
export function auditPage(html, { name = "page", expectLocale = null } = {}) {
  const recorder = createRecorder("tools/acceptance/audit-lib.accessibility");
  const body = strip(html); const label = value => `${name}: ${value}`;
  const htmlTag = html.match(/<html[^>]*>/i)?.[0] ?? ""; const lang = attr(htmlTag, "lang"); const dir = attr(htmlTag, "dir");
  recorder.check(label("document declares a language"), Boolean(lang));
  recorder.check(label("document declares a direction matching its language"), (lang === "fa" && dir === "rtl") || (lang === "en" && dir === "ltr") || (lang && !["fa", "ar", "he"].includes(lang) && (dir === "ltr" || dir === null)), `${lang}/${dir}`);
  if (expectLocale) recorder.check(label(`language is ${expectLocale}`), lang === expectLocale, lang ?? "none");
  recorder.check(label("has a non-empty title"), /<title>[^<]{2,}<\/title>/i.test(html));
  recorder.check(label("exactly one main landmark"), (body.match(/<main[\s>]/gi) ?? []).length === 1);
  recorder.check(label("exactly one h1"), (body.match(/<h1[\s>]/gi) ?? []).length === 1);
  recorder.check(label("no positive tabindex"), ![...body.matchAll(/<[a-z][^>]*\stabindex="(\d+)"/gi)].some(match => Number(match[1]) > 0));
  // names for interactive elements
  const buttons = [...body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
  recorder.check(label(`every button has an accessible name (${buttons.length})`), buttons.every(match => text(match[2]).length > 0 || attr(match[1], "aria-label")), buttons.filter(match => !text(match[2]) && !attr(match[1], "aria-label")).length);
  const anchors = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  recorder.check(label(`every link has a name and a destination (${anchors.length})`), anchors.every(match => (text(match[2]).length > 0 || attr(match[1], "aria-label")) && attr(match[1], "href") !== null));
  const images = [...body.matchAll(/<img\b([^>]*)>/gi)]; recorder.check(label(`every image has alt (${images.length})`), images.every(match => attr(match[1], "alt") !== null));
  // form controls need a label
  const controls = [...body.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)].filter(match => !["hidden", "submit", "button"].includes((attr(match[2], "type") ?? "").toLowerCase()));
  const labelFor = new Set([...body.matchAll(/<label\b[^>]*\sfor="([^"]+)"/gi)].map(match => match[1]));
  const wrapped = [...body.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)].map(match => match[1]);
  const labelled = control => attr(control[2], "aria-label") || attr(control[2], "aria-labelledby") || (attr(control[2], "id") && labelFor.has(attr(control[2], "id"))) || wrapped.some(inner => inner.includes(control[0]));
  recorder.check(label(`every form control is labelled (${controls.length})`), controls.every(labelled), controls.filter(control => !labelled(control)).map(control => attr(control[2], "name") ?? control[1]).join(","));
  // tabs
  const tabs = [...body.matchAll(/<[a-z]+\b[^>]*role="tab"[^>]*>/gi)];
  if (tabs.length) recorder.check(label("tabs expose aria-selected and tabpanels exist"), tabs.every(match => attr(match[0], "aria-selected") !== null) && /role="tabpanel"/i.test(body) && /role="tablist"/i.test(body));
  // focus visibility
  const style = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join("\n");
  const removesOutline = /outline\s*:\s*(none|0)\b/i.test(style); const restores = /:focus-visible|:focus\s*\{[^}]*(outline|box-shadow|border)/i.test(style);
  recorder.check(label("focus indicator is never removed without a replacement"), !removesOutline || restores);
  // status is never conveyed by colour alone
  const pills = [...body.matchAll(/<(?:span|strong|b)\b[^>]*class="[^"]*\bpill\b[^"]*"[^>]*>([\s\S]*?)<\/(?:span|strong|b)>/gi)];
  recorder.check(label(`status badges carry text (${pills.length})`), pills.every(match => text(match[1]).length > 0));
  // contrast
  const pairs = auditContrast(html); const failing = pairs.filter(pair => pair.ratio < 4.5);
  recorder.check(label(`text/background pairs reach 4.5:1 (${pairs.length} measured)`), failing.length === 0, failing.slice(0, 5).map(pair => `${pair.selector} ${pair.foreground}/${pair.background}=${pair.ratio}`).join("; "));
  return recorder.finish({ page: name, measuredPairs: pairs.length });
}

/** Merges several recorder results into one counted evidence record. */
export function mergeResults(tool, parts) {
  const recorder = createRecorder(tool);
  for (const part of parts) for (const item of part.results) recorder.check(item.name, item.ok, item.detail);
  return recorder.finish({ parts: parts.map(part => part.evidenceDigest) });
}
