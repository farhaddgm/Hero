import { GITHUB_ALLOWED_PATHS } from "../../contracts/src/infrastructure-control.mjs";

/**
 * BO-122: read-only GitHub metadata (repository, branches, workflows, releases, deployments).
 *
 * The adapter never opens a connection itself. A `fetchJson(path)` function is injected by whoever
 * is allowed to make the call; without one the adapter reports "not-connected" and returns nothing.
 * Only the five allowlisted GET paths are accepted, and every response is cut down to a fixed set of
 * non-sensitive fields: no file contents, no tokens, no e-mail addresses.
 */
export class GithubMetadataError extends Error { constructor(code, message, statusCode = 409) { super(message); this.name = "GithubMetadataError"; this.code = code; this.statusCode = statusCode; } }

const OWNER_REPO = /^[A-Za-z0-9_.-]{1,100}$/;
const text = (value, max = 200) => (typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max) : null);
const iso = value => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null);
const sha = value => (typeof value === "string" && /^[a-f0-9]{7,64}$/i.test(value) ? value.toLowerCase() : null);
const list = value => (Array.isArray(value) ? value.slice(0, 100) : []);

export function createGithubMetadataAdapter({ fetchJson = null } = {}) {
  const connected = typeof fetchJson === "function";

  async function get(path) {
    if (!connected) throw new GithubMetadataError("GITHUB_NOT_CONNECTED", "No GitHub connection is configured; nothing was fetched.", 503);
    if (!GITHUB_ALLOWED_PATHS.some(pattern => pattern.test(path))) throw new GithubMetadataError("GITHUB_PATH_NOT_ALLOWED", "Only read-only repository metadata paths are allowed.", 400);
    return fetchJson(path);
  }

  const shapes = {
    repository: body => ({ fullName: text(body?.full_name), defaultBranch: text(body?.default_branch, 120), private: body?.private === true, archived: body?.archived === true, pushedAt: iso(body?.pushed_at) }),
    branch: item => ({ name: text(item?.name, 120), protected: item?.protected === true, headSha: sha(item?.commit?.sha) }),
    workflow: item => ({ name: text(item?.name), path: text(item?.path), state: text(item?.state, 40) }),
    release: item => ({ tag: text(item?.tag_name, 120), name: text(item?.name), prerelease: item?.prerelease === true, draft: item?.draft === true, publishedAt: iso(item?.published_at) }),
    deployment: item => ({ environment: text(item?.environment, 80), ref: text(item?.ref, 120), sha: sha(item?.sha), createdAt: iso(item?.created_at) })
  };

  return Object.freeze({
    connected,
    status: connected ? "connected-read-only" : "not-connected",
    /** Fetches and normalises the five metadata kinds for one repository. */
    async describe({ owner, repo }) {
      if (!OWNER_REPO.test(String(owner)) || !OWNER_REPO.test(String(repo))) throw new GithubMetadataError("GITHUB_REPOSITORY_INVALID", "Owner and repository names are invalid.", 400);
      const base = `/repos/${owner}/${repo}`;
      const [repository, branches, workflows, releases, deployments] = await Promise.all([get(base), get(`${base}/branches`), get(`${base}/actions/workflows`), get(`${base}/releases`), get(`${base}/deployments`)]);
      return Object.freeze({
        mode: "read-only-metadata",
        repository: Object.freeze(shapes.repository(repository)),
        branches: Object.freeze(list(branches).map(shapes.branch)),
        workflows: Object.freeze(list(workflows?.workflows ?? workflows).map(shapes.workflow)),
        releases: Object.freeze(list(releases).map(shapes.release)),
        deployments: Object.freeze(list(deployments).map(shapes.deployment))
      });
    }
  });
}
