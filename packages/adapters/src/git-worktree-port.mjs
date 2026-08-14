import path from "node:path";

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function assertSafeWorkspaceKey(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith(".hero/worktrees/") ||
    value.includes("\\") ||
    value.includes("..") ||
    !/^[a-zA-Z0-9._/-]+$/.test(value)
  ) {
    throw new Error("workspaceKey must be a safe relative .hero/worktrees path.");
  }
}

function assertBranchName(value) {
  if (typeof value !== "string" || !/^hero\/task\/[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error("branchName must use the hero/task/<id> format.");
  }
}

function assertBaseRef(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._/-]{3,128}$/.test(value) || value.includes("..")) {
    throw new Error("baseRef must be a safe Git ref.");
  }
}

function assertInside(parent, candidate, label) {
  const relative = path.relative(parent, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the configured worktree root.`);
  }
  return candidate;
}

function commandSucceeded(result) {
  return result?.exitCode === 0 || result?.status === 0;
}

function commandOutput(result) {
  return String(result?.stdout ?? result?.output ?? "");
}

export function createGitWorktreePort({ repositoryRoot, worktreeRoot, execute }) {
  if (typeof repositoryRoot !== "string" || typeof worktreeRoot !== "string") {
    throw new Error("repositoryRoot and worktreeRoot are required runtime paths.");
  }
  if (typeof execute !== "function") throw new Error("execute is required.");
  const repository = path.resolve(repositoryRoot);
  const root = path.resolve(worktreeRoot);
  assertInside(repository, root, "worktreeRoot");
  const knownWorktrees = new Map();

  function run(args, cwd = repository) {
    const result = execute(Object.freeze({ command: "git", args: Object.freeze([...args]), cwd }));
    if (!commandSucceeded(result)) {
      throw new Error(`Git command failed: git ${args.join(" ")}`);
    }
    return result;
  }

  function workspacePath(workspaceKey) {
    assertSafeWorkspaceKey(workspaceKey);
    const suffix = workspaceKey.slice(".hero/worktrees/".length);
    return assertInside(root, path.resolve(root, suffix), "workspace path");
  }

  return Object.freeze({
    prepare(input) {
      assertSafeWorkspaceKey(input?.workspaceKey);
      assertBranchName(input?.branchName);
      assertBaseRef(input?.baseRef);
      if (input?.network !== "disabled" || input?.baseRefReadOnly !== true) {
        throw new Error("Git worktree port requires disabled network and a read-only base ref.");
      }
      if (knownWorktrees.has(input.workspaceKey)) throw new Error(`Workspace ${input.workspaceKey} already exists.`);
      const target = workspacePath(input.workspaceKey);
      run(["worktree", "add", "--detach", target, input.baseRef]);
      try {
        run(["-C", target, "switch", "-c", input.branchName]);
      } catch (error) {
        try { run(["worktree", "remove", target]); } catch {}
        throw error;
      }
      const workspace = immutableCopy({
        workspaceKey: input.workspaceKey,
        branchName: input.branchName,
        baseRef: input.baseRef,
        isolated: true,
        baseRefReadOnly: true,
        network: "disabled"
      });
      knownWorktrees.set(input.workspaceKey, { workspace, target });
      return immutableCopy(workspace);
    },
    cleanup({ workspaceKey }) {
      const known = knownWorktrees.get(workspaceKey);
      if (!known) throw new Error(`Workspace ${workspaceKey} does not exist.`);
      const status = commandOutput(run(["-C", known.target, "status", "--porcelain"]));
      if (status.trim()) throw new Error(`Workspace ${workspaceKey} is dirty and cannot be removed.`);
      run(["worktree", "remove", known.target]);
      knownWorktrees.delete(workspaceKey);
      return immutableCopy({ workspaceKey, cleaned: true });
    },
    get(workspaceKey) {
      const known = knownWorktrees.get(workspaceKey);
      return known ? immutableCopy(known.workspace) : null;
    }
  });
}
