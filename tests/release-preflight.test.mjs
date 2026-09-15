import assert from "node:assert/strict";
import test from "node:test";

import { runReleasePreflight } from "../tools/release-preflight.mjs";

test("release preflight fails closed for production and malformed commit inputs", () => {
  const production = runReleasePreflight({ version: "1.2.3", environment: "production", checkClean: false, checkTagFree: false, checkRemote: false });
  assert.equal(production.ok, false);
  assert.match(production.errors.join("\n"), /environment=test/);

  const malformedCommit = runReleasePreflight({ version: "1.2.3", commit: "not-a-sha", environment: "test", checkClean: false, checkTagFree: false, checkRemote: false });
  assert.equal(malformedCommit.ok, false);
  assert.match(malformedCommit.errors.join("\n"), /valid Git SHA/);
});
