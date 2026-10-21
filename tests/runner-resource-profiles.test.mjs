import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { PRODUCT_RUNTIME_DEFAULTS } from "../packages/contracts/src/product-factory.mjs";
import {
  RUNNER_PROFILE_FIELDS,
  RUNNER_PROFILE_IDS,
  RUNNER_RESOURCE_CEILINGS,
  getRunnerResourceProfilesSummary,
  isValidLimit,
  validateRunnerProfileRegistry
} from "../packages/contracts/src/runner-resource-profiles.mjs";
import {
  RunnerProfileError,
  admitProfileRun,
  createRunnerReservationLedger,
  resolveRunnerProfile,
  sumReservations,
  toContainerOptions
} from "../packages/domain/src/runner-resource-profiles.mjs";
import { createPrng } from "../tools/isolation-property.mjs";

const registry = JSON.parse(fs.readFileSync(new URL("../config/runner-profiles/runner-resource-profiles-v1.json", import.meta.url), "utf8"));
const clone = () => structuredClone(registry);
const capacity = (patch = {}) => ({ snapshotId: "capacity-test-001", targetId: "hero-product-test", environment: "test", cpuCores: 4, memoryMiB: 4096, pidsLimit: 1024, maxConcurrentRuns: 4, diskMiB: 20_480, source: "docker.info", observedAt: "2026-10-21T12:00:00.000Z", ...patch });
const codeOf = fn => { try { fn(); return null; } catch (error) { return error instanceof RunnerProfileError ? error.code : `other:${error.message}`; } };

test("the shipped registry is valid, ordered and tied to the hard ceilings", () => {
  assert.deepEqual(validateRunnerProfileRegistry(registry), []);
  assert.deepEqual(Object.keys(registry.profiles), RUNNER_PROFILE_IDS);
  for (const field of RUNNER_PROFILE_FIELDS) {
    assert.ok(registry.profiles.light[field] <= registry.profiles.standard[field] && registry.profiles.standard[field] <= registry.profiles.heavy[field], field);
    assert.ok(registry.profiles.heavy[field] <= RUNNER_RESOURCE_CEILINGS[field], field);
  }
  assert.equal(RUNNER_RESOURCE_CEILINGS.cpuCores, PRODUCT_RUNTIME_DEFAULTS.cpuLimit);
  assert.equal(RUNNER_RESOURCE_CEILINGS.memoryMiB, PRODUCT_RUNTIME_DEFAULTS.memoryMiB);
  assert.equal(RUNNER_RESOURCE_CEILINGS.pidsLimit, PRODUCT_RUNTIME_DEFAULTS.pidsLimit);
  assert.equal(RUNNER_RESOURCE_CEILINGS.timeoutSeconds, PRODUCT_RUNTIME_DEFAULTS.timeoutSeconds);
  assert.equal(getRunnerResourceProfilesSummary().rules.length, 4);
});

test("registry validation refuses an unknown profile, a zero or unlimited limit, a ceiling breach and a non-monotone ladder", () => {
  const bad = patch => { const copy = clone(); patch(copy); return validateRunnerProfileRegistry(copy); };
  assert.ok(bad(copy => { delete copy.profiles.light; }).some(item => /light is missing/.test(item)));
  assert.ok(bad(copy => { copy.profiles.giant = { ...copy.profiles.heavy }; }).some(item => /giant is not part of the contract/.test(item)));
  for (const value of [0, -1, Number.POSITIVE_INFINITY, Number.NaN, "unlimited", null, undefined]) {
    assert.ok(bad(copy => { copy.profiles.light.memoryMiB = value; }).some(item => /light\.memoryMiB must be/.test(item)), String(value));
  }
  assert.ok(bad(copy => { copy.profiles.heavy.memoryMiB = RUNNER_RESOURCE_CEILINGS.memoryMiB + 1; }).some(item => /exceeds the hard ceiling/.test(item)));
  assert.ok(bad(copy => { copy.profiles.heavy.cpuCores = 2; }).some(item => /exceeds the hard ceiling/.test(item)));
  assert.ok(bad(copy => { copy.profiles.heavy.diskMiB = 999_999; }).some(item => /diskMiB exceeds/.test(item)));
  assert.ok(bad(copy => { copy.profiles.light.pidsLimit = 200; }).some(item => /light\.pidsLimit must not exceed standard/.test(item)));
  assert.ok(bad(copy => { copy.profiles.light.pidsLimit = 1.5; }).some(item => /light\.pidsLimit must be a finite positive integer/.test(item)));
  assert.ok(bad(copy => { copy.profiles.light.extraPower = 9; }).some(item => /extraPower is not a known limit/.test(item)));
  assert.deepEqual(validateRunnerProfileRegistry({ schema: "x" }), ["unexpected runner profile registry schema"]);
  assert.equal(isValidLimit("cpuCores", 0.1), true);
  assert.equal(isValidLimit("memoryMiB", 0.5), false);
});

test("a task without a profile, or with an unknown one, is refused and never defaulted", () => {
  for (const missing of [undefined, null, ""]) assert.equal(codeOf(() => resolveRunnerProfile({ registry, profileId: missing })), "PROFILE_REQUIRED");
  for (const unknown of ["giant", "HEAVY", "__proto__", "constructor", "toString", 7, {}, ["light"]]) assert.equal(codeOf(() => resolveRunnerProfile({ registry, profileId: unknown })), "PROFILE_UNKNOWN", String(unknown));
  assert.equal(codeOf(() => resolveRunnerProfile({})), "PROFILE_REGISTRY_INVALID", "no registry is not a default registry");
  assert.equal(codeOf(() => resolveRunnerProfile({ registry: { schema: "x" }, profileId: "light" })), "PROFILE_REGISTRY_INVALID");
  const broken = clone(); broken.profiles.light.memoryMiB = 0;
  assert.equal(codeOf(() => resolveRunnerProfile({ registry: broken, profileId: "light" })), "PROFILE_REGISTRY_INVALID", "a weakened registry cannot be resolved");
});

test("a project may lower a limit but never raise it, zero it or make it unlimited", () => {
  const resolved = resolveRunnerProfile({ registry, profileId: "standard" });
  assert.deepEqual({ ...resolved.limits }, { cpuCores: 0.5, memoryMiB: 512, pidsLimit: 128, diskMiB: 2048, timeoutSeconds: 900, maxConcurrentRuns: 1 });
  assert.deepEqual([...resolved.loweredFields], []);
  const lowered = resolveRunnerProfile({ registry, profileId: "standard", overrides: { memoryMiB: 256, timeoutSeconds: 600 } });
  assert.equal(lowered.limits.memoryMiB, 256);
  assert.deepEqual([...lowered.loweredFields], ["memoryMiB", "timeoutSeconds"]);
  assert.equal(resolveRunnerProfile({ registry, profileId: "standard", overrides: { memoryMiB: 512 } }).limits.memoryMiB, 512, "equal to the profile is allowed");
  assert.equal(codeOf(() => resolveRunnerProfile({ registry, profileId: "standard", overrides: { memoryMiB: 513 } })), "PROFILE_RAISE_REFUSED");
  assert.equal(codeOf(() => resolveRunnerProfile({ registry, profileId: "light", overrides: { cpuCores: 0.5 } })), "PROFILE_RAISE_REFUSED");
  assert.equal(codeOf(() => resolveRunnerProfile({ registry, profileId: "heavy", overrides: { memoryMiB: 4096 } })), "PROFILE_RAISE_REFUSED", "the hard ceiling is not reachable by override");
  for (const value of [0, -5, Number.POSITIVE_INFINITY, Number.NaN, "unlimited", null, 1.5]) {
    assert.equal(codeOf(() => resolveRunnerProfile({ registry, profileId: "standard", overrides: { pidsLimit: value } })), "PROFILE_LIMIT_INVALID", String(value));
  }
  assert.equal(codeOf(() => resolveRunnerProfile({ registry, profileId: "standard", overrides: { privileged: true } })), "PROFILE_OVERRIDE_UNKNOWN_FIELD");
  assert.equal(codeOf(() => resolveRunnerProfile({ registry, profileId: "standard", overrides: [] })), "PROFILE_LIMIT_INVALID");
  assert.throws(() => { resolved.limits.memoryMiB = 1; }, TypeError, "a resolved profile is immutable");
});

test("container options are data only, carry every limit, and refuse a tampered resolution", () => {
  const options = toContainerOptions(resolveRunnerProfile({ registry, profileId: "light" }));
  assert.equal(options.sideEffects, "none");
  const argv = options.argv;
  const valueOf = flag => argv[argv.indexOf(flag) + 1];
  assert.equal(valueOf("--cpus"), "0.25");
  assert.equal(valueOf("--memory"), "256m");
  assert.equal(valueOf("--memory-swap"), "256m", "swap equals memory so a limit cannot be exceeded through swap");
  assert.equal(valueOf("--pids-limit"), "64");
  assert.equal(valueOf("--network"), "none");
  assert.equal(valueOf("--cap-drop"), "ALL");
  assert.match(valueOf("--tmpfs"), /^\/tmp:rw,noexec,nosuid,size=512m$/);
  assert.ok(argv.includes("--read-only"));
  assert.equal(valueOf("--security-opt"), "no-new-privileges");
  assert.equal(options.timeoutSeconds, 300);
  assert.deepEqual({ ...options.composeLimits }, { cpus: "0.25", mem_limit: "256m", memswap_limit: "256m", pids_limit: 64 });
  assert.ok(!argv.includes("--privileged") && !argv.includes("host"));
  assert.equal(codeOf(() => toContainerOptions(null)), "PROFILE_REQUIRED");
  assert.equal(codeOf(() => toContainerOptions({ profileId: "light", limits: { ...resolveRunnerProfile({ registry, profileId: "light" }).limits, memoryMiB: 0 } })), "PROFILE_LIMIT_INVALID");
  assert.equal(codeOf(() => toContainerOptions({ profileId: "light", limits: { ...resolveRunnerProfile({ registry, profileId: "light" }).limits, memoryMiB: 99_999 } })), "PROFILE_LIMIT_INVALID");
  assert.equal(codeOf(() => toContainerOptions({ profileId: "giant", limits: {} })), "PROFILE_REQUIRED");
});

test("admission refuses unknown capacity, unknown disk, and every kind of overrun", () => {
  const heavy = resolveRunnerProfile({ registry, profileId: "heavy" });
  assert.equal(admitProfileRun({ capacity: capacity(), resolved: heavy }).decision, "admit");
  assert.ok(admitProfileRun({ capacity: capacity({ cpuCores: 0.5 }), resolved: heavy }).errors.some(item => /CPU capacity is exhausted/.test(item)));
  assert.ok(admitProfileRun({ capacity: capacity({ memoryMiB: 512 }), resolved: heavy }).errors.some(item => /memory capacity is exhausted/.test(item)));
  assert.ok(admitProfileRun({ capacity: capacity({ pidsLimit: 100 }), resolved: heavy }).errors.some(item => /PID capacity is exhausted/.test(item)));
  assert.ok(admitProfileRun({ capacity: capacity({ diskMiB: 1000 }), resolved: heavy }).errors.some(item => /disk capacity is exhausted/.test(item)));
  assert.ok(admitProfileRun({ capacity: capacity(), reserved: [heavy, heavy, heavy, heavy], resolved: heavy }).errors.some(item => /concurrency capacity is exhausted/.test(item)));
  const unknownDisk = admitProfileRun({ capacity: capacity({ diskMiB: undefined }), resolved: heavy });
  assert.equal(unknownDisk.decision, "reject");
  assert.ok(unknownDisk.errors.some(item => /DISK_CAPACITY_UNKNOWN/.test(item)), "unknown disk is not enough room");
  assert.equal(admitProfileRun({ capacity: null, resolved: heavy }).decision, "reject");
  assert.equal(admitProfileRun({ capacity: capacity(), resolved: undefined }).decision, "reject");
  assert.equal(admitProfileRun({ capacity: capacity({ environment: "production" }), resolved: heavy }).decision, "reject");
});

test("floating point cannot hide a CPU overrun: sums are exact", () => {
  const tiny = resolveRunnerProfile({ registry, profileId: "light", overrides: { cpuCores: 0.1 } });
  const ten = Array.from({ length: 10 }, () => tiny);
  assert.equal(sumReservations(ten).cpuCores, 1, "ten reservations of 0.1 core are exactly one core");
  assert.equal(admitProfileRun({ capacity: capacity({ cpuCores: 1, maxConcurrentRuns: 11 }), reserved: ten, resolved: tiny }).decision, "reject");
  assert.equal(admitProfileRun({ capacity: capacity({ cpuCores: 1.1, maxConcurrentRuns: 11 }), reserved: ten, resolved: tiny }).decision, "admit");
});

test("property: whatever sequence of reserve and release arrives, the ledger never exceeds capacity", () => {
  for (const seed of [1, 7, 42, 2026, 20261021]) {
    const prng = createPrng(seed);
    const host = capacity({ cpuCores: 2.3, memoryMiB: 3000, pidsLimit: 700, maxConcurrentRuns: 6, diskMiB: 9000 });
    const ledger = createRunnerReservationLedger({ capacity: host });
    const live = [];
    let admitted = 0;
    let rejected = 0;
    for (let step = 0; step < 400; step += 1) {
      if (live.length > 0 && prng.next() < 0.3) {
        const [runId] = live.splice(prng.int(0, live.length - 1), 1);
        assert.equal(ledger.release(runId), true);
      } else {
        const profileId = prng.pick(RUNNER_PROFILE_IDS);
        const overrides = prng.next() < 0.3 ? { cpuCores: Number((prng.int(1, 9) / 20).toFixed(2)) } : {};
        let resolved;
        try { resolved = resolveRunnerProfile({ registry, profileId, overrides }); } catch (error) { assert.equal(error.code, "PROFILE_RAISE_REFUSED"); continue; }
        const runId = `run-${seed}-${step}`;
        const decision = ledger.reserve({ runId, resolved });
        if (decision.decision === "admit") { admitted += 1; live.push(runId); } else rejected += 1;
      }
      const totals = ledger.totals();
      assert.ok(Math.round(totals.cpuCores * 1e6) <= Math.round(host.cpuCores * 1e6), `seed ${seed} step ${step}: cpu ${totals.cpuCores}`);
      assert.ok(totals.memoryMiB <= host.memoryMiB && totals.pidsLimit <= host.pidsLimit && totals.diskMiB <= host.diskMiB && totals.concurrentRuns <= host.maxConcurrentRuns, `seed ${seed} step ${step}`);
      assert.equal(ledger.size(), live.length);
    }
    assert.ok(admitted > 20 && rejected > 20, `seed ${seed}: both outcomes occurred (${admitted}/${rejected})`);
  }
});

test("the ledger rejects a duplicate run id and a malformed one", () => {
  const ledger = createRunnerReservationLedger({ capacity: capacity() });
  const resolved = resolveRunnerProfile({ registry, profileId: "light" });
  assert.equal(ledger.reserve({ runId: "run-one-abc", resolved }).decision, "admit");
  assert.equal(ledger.reserve({ runId: "run-one-abc", resolved }).decision, "reject");
  assert.throws(() => ledger.reserve({ runId: "BAD ID", resolved }), error => error.code === "INVALID_RUN_ID");
  assert.equal(ledger.release("run-unknown-xyz"), false);
  assert.equal(ledger.size(), 1);
});
