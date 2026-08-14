import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  EVENT_TYPES,
  createOperationalEvent,
  getOperationalDataSummary,
  validateOperationalEvent
} from "../packages/contracts/src/operational-data.mjs";
import {
  AggregateVersionConflictError,
  DuplicateEventError,
  createInMemoryEventLog
} from "../packages/domain/src/event-log.mjs";
import { REPO_ROOT } from "../tools/fs-policy.mjs";

function event(overrides = {}) {
  return createOperationalEvent({
    eventId: "evt_work_item_requested_001",
    aggregateType: "work-item",
    aggregateId: "WORK-001",
    type: "work-item.planned",
    occurredAt: "2026-08-14T12:00:00.000Z",
    actor: { kind: "orchestrator", id: "hero-control-plane" },
    correlationId: "RUN-001",
    data: { title: "اپلیکیشن رزرو نوبت", acceptanceCriteria: ["قابل تحویل"] },
    ...overrides
  });
}

test("operational event contract is versioned, explicit and safe for logs", () => {
  assert.deepEqual(validateOperationalEvent(event()), []);
  assert.ok(EVENT_TYPES.includes("outbox.dispatch-requested"));
  assert.equal(getOperationalDataSummary().appendOnly, true);

  assert.throws(
    () => event({ data: { apiKey: "not-allowed" } }),
    /sensitive field name/
  );
  assert.throws(
    () => event({ data: { note: "Bearer token_should_never_be_logged_123" } }),
    /sensitive value/
  );
});

test("in-memory event log is append-only, duplicate-safe and version-aware", () => {
  const log = createInMemoryEventLog();
  const requested = log.append(event(), { expectedVersion: 0 });
  const planned = log.append(
    event({
      eventId: "evt_work_item_task_created_002",
      type: "task.created",
      causationId: "evt_work_item_requested_001"
    }),
    { expectedVersion: 1 }
  );

  assert.equal(requested.sequence, 1);
  assert.equal(planned.sequence, 2);
  assert.equal(planned.aggregateVersion, 2);
  assert.equal(log.readAggregate("work-item", "WORK-001").length, 2);
  assert.equal(log.currentVersion("work-item", "WORK-001"), 2);
  assert.throws(() => log.append(event(), { expectedVersion: 2 }), DuplicateEventError);
  assert.throws(
    () => log.append(event({ eventId: "evt_work_item_conflict_003" }), { expectedVersion: 0 }),
    AggregateVersionConflictError
  );
});

test("approved data model and ADR stay aligned with the machine contract", () => {
  const specification = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "specs", "HERO-005-v1.0.md"),
    "utf8"
  );
  const decision = fs.readFileSync(
    path.join(REPO_ROOT, "docs", "decisions", "ADR-0003-append-only-event-log-and-postgresql.md"),
    "utf8"
  );

  assert.match(specification, /append-only/);
  assert.match(specification, /PostgreSQL/);
  assert.match(specification, /Outbox/);
  assert.match(decision, /optimistic concurrency/);
  assert.equal(getOperationalDataSummary().durableDispatch, "postgresql-outbox");
});
