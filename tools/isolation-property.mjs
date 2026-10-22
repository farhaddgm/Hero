/**
 * NX-049 — pure helpers for the project-isolation property test.
 *
 * Everything here is deterministic: a seed fully determines the scenario, so a failing run can be
 * replayed with `HERO_ISOLATION_SEED=<seed>`. No network, no clock, no file writes.
 */

const PROJECT_CAPTURES = ["([a-z][a-z0-9-]{2,62})", "([A-Za-z][A-Za-z0-9._:-]{2,127})", "([^/]+)"];
export const PROJECT_TOKEN = "__PROJECT__";
const SAMPLE = "sample-id";

/** mulberry32: tiny seeded PRNG, no dependency. */
export function createPrng(seed) {
  if (!Number.isSafeInteger(seed)) throw new TypeError("seed must be a safe integer.");
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.freeze({
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: items => items[Math.floor(next() * items.length)],
    shuffle: items => {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(next() * (index + 1));
        [copy[index], copy[other]] = [copy[other], copy[index]];
      }
      return copy;
    }
  });
}

function sampleFromRegex(body) {
  let out = "";
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === "\\") {
      out += body[i + 1] === "/" ? "/" : body[i + 1] === "." ? "." : body[i + 1] === "d" ? "1" : "";
      i += 2;
      continue;
    }
    if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      while (j < body.length && depth > 0) {
        if (body[j] === "\\") j += 2;
        else {
          if (body[j] === "(") depth += 1;
          if (body[j] === ")") depth -= 1;
          j += 1;
        }
      }
      const inner = body.slice(i + 1, j - 1).replace(/^\?:/, "");
      out += /[[\]{}+*]/.test(inner) ? SAMPLE : inner.split("|")[0].replace(/\\\//g, "/");
      i = j;
      if (body[i] === "?") i += 1;
      continue;
    }
    if (ch === "?" || ch === "^" || ch === "$") {
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Finds every `/api/projects/:projectId/...` route and every other `/api/...` route in the Control
 * Plane source. Project routes become templates with `:projectId`; others are listed separately.
 * Routes whose pattern cannot be sampled are reported in `unmatched` so they cannot hide.
 */
export function discoverRoutes(source) {
  const projectTemplates = new Set();
  const otherRoutes = new Set();
  const unmatched = [];

  for (const match of source.matchAll(/pathname === "(\/api\/[^"]*)"/g)) {
    const path = match[1];
    if (path.includes("*")) continue;
    (path.startsWith("/api/projects/") ? projectTemplates : otherRoutes).add(path);
  }

  for (const match of source.matchAll(/\.match\(\/(\^\\\/api\\\/[^\n]*?\$)\/\)/g)) {
    const pattern = match[1];
    const body = pattern.slice(1, -1);
    const prefix = "\\/api\\/projects\\/";
    let scoped = false;
    let workable = body;
    if (body.startsWith(prefix)) {
      for (const capture of PROJECT_CAPTURES) {
        if (body.slice(prefix.length).startsWith(capture)) {
          workable = `${prefix}${PROJECT_TOKEN}${body.slice(prefix.length + capture.length)}`;
          scoped = true;
          break;
        }
      }
    }
    const sampled = sampleFromRegex(workable);
    let ok = false;
    try {
      ok = new RegExp(scoped ? workable.replace(PROJECT_TOKEN, "(.+?)") : pattern).test(sampled);
    } catch {
      ok = false;
    }
    if (!ok) {
      unmatched.push(pattern);
      continue;
    }
    if (scoped) projectTemplates.add(sampled.replace(PROJECT_TOKEN, ":projectId"));
    else if (sampled.startsWith("/api/projects/")) unmatched.push(pattern);
    else otherRoutes.add(sampled);
  }

  return Object.freeze({
    projectTemplates: Object.freeze([...projectTemplates].sort()),
    otherRoutes: Object.freeze([...otherRoutes].sort()),
    unmatched: Object.freeze(unmatched)
  });
}

export function instantiateTemplate(template, projectId) {
  return template.replaceAll(":projectId", projectId);
}

/**
 * A scenario: which user holds which role on which project. Roles are `none`, `viewer` or `admin`;
 * the owner is implicit and is not part of the grants. Every project ends up with at least one
 * granted user and at least one user without access, so both sides of the property are exercised.
 */
export function planScenario({ seed, projectCount = 4, userCount = 4 } = {}) {
  const prng = createPrng(seed);
  const projects = Array.from({ length: projectCount }, (_, index) => `iso-${String.fromCharCode(97 + index)}${prng.int(100, 999)}`);
  const users = Array.from({ length: userCount }, (_, index) => `iso-user-${index + 1}`);
  const roles = ["none", "viewer", "admin"];
  const grants = new Map(users.map(user => [user, new Map(projects.map(project => [project, prng.pick(roles)]))]));
  // Guarantee both sides of the property on every project.
  projects.forEach((project, index) => {
    const granted = users[index % users.length];
    const denied = users[(index + 1) % users.length];
    if (grants.get(granted).get(project) === "none") grants.get(granted).set(project, prng.pick(["viewer", "admin"]));
    grants.get(denied).set(project, "none");
  });
  return Object.freeze({ seed, projects: Object.freeze(projects), users: Object.freeze(users), grants, prng });
}

export const READ_METHODS = Object.freeze(["GET"]);
export const WRITE_METHODS = Object.freeze(["POST", "PUT", "PATCH", "DELETE"]);

/** What the isolation property allows for one request. */
export function expectation({ role, method }) {
  if (role === "none") return "deny";
  if (READ_METHODS.includes(method)) return "any";
  return role === "admin" ? "any" : "deny";
}

/**
 * Judges observations. A violation is a 2xx/3xx where the property demands a denial, a body that
 * names a project the caller holds no grant on, or a 5xx (unexpected failure is never "safe").
 */
export function findViolations(observations, { projects, grantedProjects }) {
  const violations = [];
  const forbidden = projects.filter(project => !grantedProjects.has(project));
  for (const item of observations) {
    const label = `${item.user} ${item.method} ${item.path}`;
    const allowedOutcome = item.status >= 400;
    if (item.expect === "deny" && !allowedOutcome) violations.push({ kind: "ACCESS_NOT_DENIED", label, status: item.status, role: item.role });
    if (item.status >= 500 && item.status !== 503) violations.push({ kind: "SERVER_ERROR", label, status: item.status, role: item.role });
    if (item.status >= 200 && item.status < 300 && typeof item.body === "string") {
      const leaked = forbidden.filter(project => item.body.includes(project));
      if (leaked.length > 0) violations.push({ kind: "FOREIGN_PROJECT_IN_BODY", label, status: item.status, leaked });
    }
  }
  return violations;
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REPO_ROOT } from "./fs-policy.mjs";

export const SERVER_SOURCE = "apps/control-plane/src/server.mjs";
export const ROUTE_MANIFEST = "tests/fixtures/project-scoped-routes.json";

/** `node tools/isolation-property.mjs --print` prints the route manifest to copy into the fixture. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes("--print")) {
  const found = discoverRoutes(fs.readFileSync(path.join(REPO_ROOT, SERVER_SOURCE), "utf8"));
  process.stdout.write(`${JSON.stringify({ projectTemplates: found.projectTemplates, otherRoutes: found.otherRoutes, unmatched: found.unmatched.length }, null, 2)}\n`);
}
