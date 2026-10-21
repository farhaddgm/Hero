/**
 * Static accessibility and right-to-left audit of full-page HTML (NX-037 moved it out of the test so
 * its checks can be named and mapped to WCAG 2.2 criteria). It needs no browser. It looks at structure
 * and declared CSS only; real rendering, focus order, colour in context and screen-reader behaviour
 * stay with the browser audit and human review.
 */

/**
 * The checks. `wcag` lists the success criteria the check gives evidence for; `strength` is how much of
 * the criterion the check can establish: `substantial` (the check decides the criterion for what it sees)
 * or `partial` (a necessary condition only). No check is ever a conformance claim.
 */
export const STATIC_CHECKS = Object.freeze([
  { id: "html-lang", wcag: ["3.1.1"], strength: "substantial", description: "html lang is fa" },
  { id: "html-dir", wcag: [], strength: "partial", description: "html dir is rtl" },
  { id: "viewport", wcag: ["1.4.10"], strength: "partial", description: "responsive viewport meta is present" },
  { id: "zoom-allowed", wcag: ["1.4.4"], strength: "substantial", description: "zoom is not disabled" },
  { id: "page-title", wcag: ["2.4.2"], strength: "substantial", description: "page has a title" },
  { id: "single-main", wcag: ["1.3.1", "2.4.1"], strength: "partial", description: "exactly one main landmark" },
  { id: "skip-link", wcag: ["2.4.1"], strength: "substantial", description: "skip link and its target exist" },
  { id: "no-positive-tabindex", wcag: ["2.4.3"], strength: "partial", description: "no positive tabindex" },
  { id: "unique-ids", wcag: ["4.1.2"], strength: "partial", description: "ids are unique" },
  { id: "aria-references", wcag: ["1.3.1", "4.1.2"], strength: "partial", description: "aria references point at existing ids" },
  { id: "img-alt", wcag: ["1.1.1"], strength: "substantial", description: "images have alt text" },
  { id: "control-names", wcag: ["1.3.1", "3.3.2", "4.1.2"], strength: "substantial", description: "form controls have an accessible name" },
  { id: "button-names", wcag: ["4.1.2"], strength: "substantial", description: "buttons have an accessible name" },
  { id: "link-names", wcag: ["2.4.4"], strength: "partial", description: "links have an accessible name" },
  { id: "heading-structure", wcag: ["1.3.1", "2.4.6"], strength: "partial", description: "headings are not empty and levels do not skip" },
  { id: "input-autocomplete", wcag: ["1.3.5"], strength: "partial", description: "identity fields declare an autocomplete purpose" },
  { id: "no-media", wcag: [], strength: "partial", description: "the page has no audio, video or embedded frames" },
  { id: "orientation-lock", wcag: ["1.3.4"], strength: "partial", description: "scripts do not lock the screen orientation" },
  { id: "no-motion-listeners", wcag: ["2.5.4"], strength: "partial", description: "scripts do not react to device motion" }
]);

const withoutScripts = html => html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map(match => match[1]);
const attr = (attrs, name) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs)?.slice(1).find(value => value !== undefined);
const IDENTITY_FIELD = /^(?:email|password|tel|username|name)$/i;

/** Returns the findings as { checkId, message }. An empty list means no automated finding on this page. */
export function auditPageDetailed(source) {
  const html = withoutScripts(source);
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join("\n");
  const problems = [];
  const add = (checkId, message) => problems.push({ checkId, message });
  const root = tags(html, "html")[0] ?? "";
  if (attr(root, "lang") !== "fa") add("html-lang", "lang must be fa");
  if (attr(root, "dir") !== "rtl") add("html-dir", "dir must be rtl");
  if (!/<meta[^>]+name="viewport"[^>]+width=device-width/.test(html)) add("viewport", "responsive viewport is missing");
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?\b/.test(html)) add("zoom-allowed", "zoom is disabled");
  if (!/<title>[^<]{2,}<\/title>/.test(html)) add("page-title", "title is missing");
  if (tags(html, "main").length !== 1) add("single-main", "exactly one main landmark is required");
  if (!/class="hero-skip-link"[^>]*href="#hero-main"/.test(html) || !/id="hero-main"/.test(html)) add("skip-link", "skip link or its target is missing");
  for (const attrs of tags(html, "[a-z]+")) {
    const tabindex = Number(attr(attrs, "tabindex"));
    if (Number.isFinite(tabindex) && tabindex > 0) add("no-positive-tabindex", `positive tabindex: ${attrs.slice(0, 60)}`);
  }
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  for (const id of new Set(ids.filter((value, index) => ids.indexOf(value) !== index))) add("unique-ids", `duplicate id: ${id}`);
  const known = new Set(ids);
  // Dynamic regions are filled by the page script; only references no script could define are errors.
  const scriptsCreateIds = (source.match(/\.id\s*=|setAttribute\(["']id["']/g) ?? []).length > 0;
  if (!scriptsCreateIds) {
    for (const match of html.matchAll(/\saria-(?:labelledby|describedby|controls)="([^"]+)"/g)) {
      for (const ref of match[1].split(/\s+/)) if (!known.has(ref)) add("aria-references", `aria reference to missing id: ${ref}`);
    }
  }
  for (const attrs of tags(html, "img")) if (attr(attrs, "alt") === undefined) add("img-alt", `img without alt: ${attrs.slice(0, 60)}`);
  const labelFor = new Set([...html.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map(match => match[1]));
  const wrapped = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map(match => match[1]);
  for (const element of ["input", "select", "textarea"]) {
    for (const match of html.matchAll(new RegExp(`<${element}\\b([^>]*)>`, "gi"))) {
      const attrs = match[1];
      const type = (attr(attrs, "type") ?? "text").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
      const id = attr(attrs, "id");
      const named = attr(attrs, "aria-label") || attr(attrs, "aria-labelledby") || attr(attrs, "title") || (id && labelFor.has(id));
      if (!named && !wrapped.some(body => body.includes(match[0]))) add("control-names", `${element}${id ? `#${id}` : ""} has no accessible name`);
      if (element === "input" && ["email", "password", "tel"].includes(type) && !attr(attrs, "autocomplete")) add("input-autocomplete", `${element}${id ? `#${id}` : ""} (type ${type}) has no autocomplete purpose`);
    }
  }
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (!text && !attr(match[1], "aria-label") && !attr(match[1], "aria-labelledby") && !attr(match[1], "title")) add("button-names", `button has no accessible name: ${match[1].slice(0, 60)}`);
  }
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (attr(match[1], "href") === undefined) continue;
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (!text && !attr(match[1], "aria-label") && !attr(match[1], "aria-labelledby") && !attr(match[1], "title") && !/<img\b[^>]*\balt="[^"]+"/i.test(match[2])) add("link-names", `link has no accessible name: ${match[1].slice(0, 60)}`);
  }
  let previousLevel = 0;
  for (const match of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const level = Number(match[1]);
    if (match[2].replace(/<[^>]+>/g, "").trim() === "") add("heading-structure", `empty h${level}`);
    if (previousLevel !== 0 && level > previousLevel + 1) add("heading-structure", `heading level skips from h${previousLevel} to h${level}`);
    previousLevel = level;
  }
  if (/<(?:video|audio|iframe|embed|object)\b/i.test(html)) add("no-media", "the page embeds media or a frame");
  if (/screen\.orientation\.lock|lockOrientation\s*\(/.test(scripts)) add("orientation-lock", "a script locks the screen orientation");
  if (/devicemotion|deviceorientation/i.test(scripts)) add("no-motion-listeners", "a script listens to device motion");
  return problems;
}

/** Messages only, kept for callers that just need the text. */
export function auditPage(source) {
  return auditPageDetailed(source).map(item => item.message);
}

/* ------------------------------------------------------------ design-system checks (CSS and colour) */

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new RangeError(`Not a #rrggbb colour: ${hex}`);
  const number = parseInt(match[1], 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

/** WCAG relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex) {
  const [red, green, blue] = parseHex(hex);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21), rounded to two decimals. */
export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const [lighter, darker] = a >= b ? [a, b] : [b, a];
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/** Reads the colour tokens a design-system stylesheet declares for the light and dark themes. */
export function readColorTokens(css) {
  const block = (open) => {
    const start = css.indexOf(open);
    if (start === -1) return {};
    const end = css.indexOf("}", start);
    const tokens = {};
    for (const match of css.slice(start, end).matchAll(/(--hero-[a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[match[1]] = match[2];
    return tokens;
  };
  const light = block(":root {");
  const dark = { ...light, ...block(':root[data-hero-theme="dark"] {') };
  return { light, dark };
}

/**
 * Colour pairs that carry text or interface boundaries in the design system, with the minimum ratio the
 * criterion asks for: 4.5 for normal text (1.4.3) and 3 for UI components and focus indicators (1.4.11).
 */
export const TOKEN_CONTRAST_PAIRS = Object.freeze([
  { id: "ink-on-surface", foreground: "--hero-ink", background: "--hero-surface", minimum: 4.5, criterion: "1.4.3" },
  { id: "ink-on-canvas", foreground: "--hero-ink", background: "--hero-canvas", minimum: 4.5, criterion: "1.4.3" },
  { id: "muted-on-surface", foreground: "--hero-muted", background: "--hero-surface", minimum: 4.5, criterion: "1.4.3" },
  { id: "muted-on-canvas", foreground: "--hero-muted", background: "--hero-canvas", minimum: 4.5, criterion: "1.4.3" },
  { id: "brand-on-surface", foreground: "--hero-brand", background: "--hero-surface", minimum: 4.5, criterion: "1.4.3" },
  { id: "brand-on-brand-soft", foreground: "--hero-brand", background: "--hero-brand-soft", minimum: 4.5, criterion: "1.4.3" },
  { id: "on-brand-on-brand", foreground: "--hero-on-brand", background: "--hero-brand", minimum: 4.5, criterion: "1.4.3" },
  { id: "success-on-soft", foreground: "--hero-success", background: "--hero-success-soft", minimum: 4.5, criterion: "1.4.3" },
  { id: "warning-on-soft", foreground: "--hero-warning", background: "--hero-warning-soft", minimum: 4.5, criterion: "1.4.3" },
  { id: "danger-on-soft", foreground: "--hero-danger", background: "--hero-danger-soft", minimum: 4.5, criterion: "1.4.3" },
  { id: "focus-ring-on-surface", foreground: "--hero-brand", background: "--hero-surface", minimum: 3, criterion: "1.4.11" },
  { id: "focus-ring-on-canvas", foreground: "--hero-brand", background: "--hero-canvas", minimum: 3, criterion: "1.4.11" },
  { id: "control-border-on-surface", foreground: "--hero-line-strong", background: "--hero-surface", minimum: 3, criterion: "1.4.11" }
]);

/** Computes every token pair for both themes. A missing token is reported, never skipped. */
export function evaluateTokenContrast(css) {
  const themes = readColorTokens(css);
  const results = [];
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const pair of TOKEN_CONTRAST_PAIRS) {
      const foreground = tokens[pair.foreground];
      const background = tokens[pair.background];
      if (!foreground || !background) { results.push({ ...pair, theme, ratio: null, passed: false, reason: "token-missing" }); continue; }
      const ratio = contrastRatio(foreground, background);
      results.push({ ...pair, theme, ratio, passed: ratio >= pair.minimum, reason: ratio >= pair.minimum ? null : "below-minimum" });
    }
  }
  return results;
}

/** Declared-CSS checks: a visible focus rule exists and controls are at least 44px tall. */
export function evaluateDesignSystemCss(css) {
  const findings = [];
  if (!/:focus-visible\s*\{[^}]*outline:\s*(?:[2-9]|\d{2,})px\s+solid/.test(css)) findings.push({ checkId: "focus-style-css", message: "no :focus-visible rule with an outline of at least 2px" });
  if (/:focus(?:-visible)?\s*\{[^}]*outline:\s*(?:none|0)\b/.test(css)) findings.push({ checkId: "focus-style-css", message: "a focus rule removes the outline" });
  if (!/--hero-control-height:\s*44px/.test(css) || !/min-height:\s*44px/.test(css)) findings.push({ checkId: "target-size-css", message: "controls do not declare a 44px minimum height" });
  return findings;
}
