import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createGitWorktreePort } from "../packages/adapters/src/git-worktree-port.mjs";

function port({ dirty = false } = {}) {
  const calls = [];
  const adapter = createGitWorktreePort({
    repositoryRoot: "/workspace/hero",
    worktreeRoot: "/workspace/hero/.hero/worktrees",
    execute(command) {
      calls.push(command);
      if (command.args.includes("status")) return { status: 0, stdout: dirty ? " M package.json\n" : "" };
      return { status: 0, stdout: "" };
    }
  });
  return { adapter, calls };
}

test("git worktree port composes a bounded detached worktree and task branch", () => {
  const { adapter, calls } = port();
  const workspace = adapter.prepare({
    workspaceKey: ".hero/worktrees/run-008",
    branchName: "hero/task/run-008",
    baseRef: "main",
    network: "disabled",
    baseRefReadOnly: true
  });
  assert.equal(workspace.isolated, true);
  assert.deepEqual(calls.map(call => call.args.slice(0, 3)), [
    ["worktree", "add", "--detach"],
    ["-C", path.resolve("/workspace/hero/.hero/worktrees/run-008"), "switch"]
  ]);
  assert.equal(adapter.cleanup({ workspaceKey: ".hero/worktrees/run-008" }).cleaned, true);
  assert.equal(calls.at(-1).args[0], "worktree");
  assert.equal(calls.at(-1).args[1], "remove");
});

test("git worktree port rejects unsafe boundaries and never force-removes a dirty workspace", () => {
  const { adapter, calls } = port({ dirty: true });
  assert.throws(
    () => adapter.prepare({
      workspaceKey: "../another-project",
      branchName: "hero/task/run-unsafe",
      baseRef: "main",
      network: "disabled",
      baseRefReadOnly: true
    }),
    /safe relative/
  );
  adapter.prepare({
    workspaceKey: ".hero/worktrees/run-dirty",
    branchName: "hero/task/run-dirty",
    baseRef: "main",
    network: "disabled",
    baseRefReadOnly: true
  });
  assert.throws(() => adapter.cleanup({ workspaceKey: ".hero/worktrees/run-dirty" }), /dirty/);
  assert.equal(calls.some(call => call.args.includes("--force")), false);
});
