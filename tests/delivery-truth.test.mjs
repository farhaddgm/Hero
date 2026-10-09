import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { computeDeliveryTruth, toPersianDigits } from "../packages/domain/src/delivery-truth.mjs";
import { createOwnerAuth } from "../packages/domain/src/owner-auth.mjs";

const readJson = relative => JSON.parse(fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"));
const audit = readJson("config/backoffice/delivery-audit-v1.0.json");
const trace = readJson("config/backoffice/requirement-trace-v1.0.json");
const now = () => "2026-10-09T10:00:00.000Z";

test("the shipped registries add up and yield an honest, consistent headline", () => {
  const truth = computeDeliveryTruth({ audit, trace, now });
  assert.equal(truth.integrity.consistent, true, truth.integrity.issues.join("; "));
  assert.equal(truth.steps.total, 170);
  assert.equal(truth.steps.byStatus.verified + truth.steps.remainingToVerified, 170);
  assert.equal(truth.requirements.total, 81);
  assert.equal(truth.requirements.byStatus.implemented + truth.requirementGaps.length, 81);
  assert.ok(truth.honestyGap > 0, "steps are verified far more often than requirements are implemented");
  assert.match(truth.headlineFa, /تأیید یک گام به معنی تکمیل قابلیت برای کاربر نیست/);
  assert.ok(truth.headlineFa.includes(toPersianDigits(truth.steps.byStatus.verified)));
  assert.equal(truth.workPackages.reduce((sum, wp) => sum + wp.total, 0), 170);
  assert.ok(truth.openGates.every(gate => gate.status !== "verified" && gate.openGate !== "none"));
  assert.equal(truth.generatedAt, now());
});

test("the model refuses to launder inflated claims: mismatched summaries, overlaps and gaps are reported", () => {
  const inflated = structuredClone(audit);
  inflated.summary.verified += 5;
  inflated.requirement_current.implemented += 3;
  const truth = computeDeliveryTruth({ audit: inflated, trace, now });
  assert.equal(truth.integrity.consistent, false);
  assert.ok(truth.integrity.issues.some(issue => /says verified=/.test(issue)));
  assert.ok(truth.integrity.issues.some(issue => /implemented requirements=/.test(issue)));

  const overlapping = structuredClone(audit);
  overlapping.ranges.push({ ...overlapping.ranges[0] });
  assert.ok(computeDeliveryTruth({ audit: overlapping, trace, now }).integrity.issues.some(issue => /more than one range/.test(issue)));

  const gap = structuredClone(audit);
  gap.ranges = gap.ranges.slice(1);
  assert.ok(computeDeliveryTruth({ audit: gap, trace, now }).integrity.issues.some(issue => /not covered/.test(issue)));

  const unknown = structuredClone(trace);
  unknown.requirements[0].status = "done";
  assert.ok(computeDeliveryTruth({ audit, trace: unknown, now }).integrity.issues.some(issue => /unknown status/.test(issue)));
  assert.throws(() => computeDeliveryTruth({ audit: {}, trace }), TypeError);
});

test("extra signals are carried through as data and next actions name the real blockers", () => {
  const truth = computeDeliveryTruth({ audit, trace, now, signals: [{ id: "golden-path-live", label: "اجرای زندهٔ ایده تا محصول", status: "not-run" }] });
  assert.equal(truth.signals[0].status, "not-run");
  assert.deepEqual(truth.nextActions.map(item => item.kind), ["authorization", "owner-decision", "engineering"]);
});

test("GET /api/delivery-truth is owner-only and serves the computed model", async t => {
  const ownerAuth = createOwnerAuth({ secret: "test-only-delivery-truth-owner-secret-1234567890", now });
  const token = ownerAuth.issueSession({ subject: "hero-owner", sessionId: "delivery-truth-session", expiresAt: 2_000_000_000 });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, ownerAuth, deliveryTruthSignals: [{ id: "golden-path-live", label: "اجرای زنده", status: "not-run" }] });
  const address = await app.start();
  t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/api/delivery-truth`)).status, 401);
  const response = await fetch(`${base}/api/delivery-truth`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.deliveryTruth.schema, "hero.delivery-truth/v1");
  assert.equal(body.deliveryTruth.steps.total, 170);
  assert.equal(body.deliveryTruth.integrity.consistent, true);
  assert.equal(body.deliveryTruth.signals[0].id, "golden-path-live");
  assert.equal(JSON.stringify(body).includes(token), false);
});
