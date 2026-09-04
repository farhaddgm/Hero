import assert from "node:assert/strict";
import test from "node:test";

import { createPlanner } from "../packages/domain/src/planner.mjs";

const actor = { kind: "orchestrator", id: "hero-control-plane" };

function base(planningId, capacity) {
  return {
    planningId,
    requestId: `REQ-${planningId}`,
    projectId: "hero",
    documentVersion: "v1.0",
    requestText: "یک پنل وب برای مدیریت درخواست‌ها طراحی کن.",
    assumptions: ["معیار پذیرش توسط مالک تکمیل می‌شود."],
    acceptanceCriteria: ["گراف بدون تعارض ظرفیت ساخته شود."],
    ...(capacity === undefined ? {} : { capacity }),
    actor,
    idempotencyKey: `plan-${planningId}`
  };
}

test("planner reports capacity and resource conflicts before dispatch", () => {
  const planner = createPlanner();
  const result = planner.plan(base("PLAN-CAPACITY-001", {
    teamLimits: [{ teamId: "tahlilgoro", maxConcurrent: 0, active: 0 }],
    resourceClaims: [
      { claimId: "claim-a", resourceId: "gpu-1", teamId: "dadeo", startsAt: "2026-09-04T10:00:00.000Z", endsAt: "2026-09-04T12:00:00.000Z" },
      { claimId: "claim-b", resourceId: "gpu-1", teamId: "developero", startsAt: "2026-09-04T11:00:00.000Z", endsAt: "2026-09-04T13:00:00.000Z" }
    ]
  }));
  assert.equal(result.teamReadiness.capacityCheck.ready, false);
  assert.equal(result.teamReadiness.capacityCheck.status, "conflict");
  assert.equal(result.teamReadiness.capacityCheck.conflicts.some(item => item.type === "team-capacity"), true);
  assert.equal(result.teamReadiness.capacityCheck.conflicts.some(item => item.type === "resource-overlap"), true);

  const noCapacity = planner.plan(base("PLAN-CAPACITY-002"));
  assert.equal(noCapacity.teamReadiness.capacityCheck.status, "not-provided");
  assert.equal(noCapacity.teamReadiness.capacityCheck.ready, true);
});
