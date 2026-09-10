import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKOFFICE_CONTEXTS,
  BACKOFFICE_PLANES,
  getBackofficeFoundationContractSummary,
  validateBackofficeEventEnvelope,
  validateBackofficeFoundationContract
} from "../packages/contracts/src/index.mjs";
import {
  createBackofficeEntityVersion,
  createBackofficeEventEnvelope as createDomainEvent,
  createIdempotentEventConsumer,
  IdempotencyConflictError
} from "../packages/domain/src/backoffice-event-envelope.mjs";
import { rebuildPortfolioReadModel } from "../packages/domain/src/backoffice-read-models.mjs";

function event(overrides = {}) {
  const { sequence, ...inputOverrides } = overrides;
  const built = createDomainEvent({
    eventId: "evt_001",
    aggregateType: "project",
    aggregateId: "project-vpn",
    aggregateVersion: 1,
    type: "project.requested",
    occurredAt: "2026-09-10T10:00:00.000Z",
    actor: { kind: "project-owner", id: "owner-1" },
    projectId: "project-vpn",
    correlationId: "corr-001",
    idempotencyKey: "cmd-001",
    data: { name: "VPN", status: "intake" },
    ...inputOverrides
  });
  return sequence === undefined ? built : { ...built, sequence };
}

test("Back Office foundation contract fixes contexts, planes and entities", () => {
  assert.deepEqual(validateBackofficeFoundationContract(), []);
  assert.deepEqual(BACKOFFICE_CONTEXTS, ["portfolio", "project", "identity", "policy", "conversation", "workflow", "catalog", "evaluation", "infrastructure", "delivery"]);
  assert.deepEqual(BACKOFFICE_PLANES, ["control", "execution", "data"]);
  assert.equal(getBackofficeFoundationContractSummary().secretSafe, true);
});

test("entity versions and event envelopes are versioned and secret-safe", () => {
  const entity = createBackofficeEntityVersion({ entityType: "project", entityId: "project-vpn", projectId: "project-vpn", version: 1, data: { name: "VPN" } });
  assert.equal(entity.schemaVersion, "1.0");
  assert.equal(entity.lifecycle, "active");
  const envelope = event();
  assert.deepEqual(validateBackofficeEventEnvelope(envelope), []);
  assert.throws(() => event({ data: { apiKey: "sk-do-not-store-this" } }), /sensitive field/);
});

test("Inbox consumes each idempotency key once and replays exact results", async () => {
  const consumer = createIdempotentEventConsumer({ consumerId: "read-model-1" });
  let calls = 0;
  const first = await consumer.consume(event(), async received => {
    calls += 1;
    return { sequence: received.aggregateVersion };
  });
  const replay = await consumer.consume(event(), async () => {
    calls += 1;
    return { sequence: 999 };
  });
  assert.equal(calls, 1);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, { sequence: 1 });
  assert.equal(consumer.size(), 1);
  await assert.rejects(() => consumer.consume(event({ eventId: "evt_002", data: { name: "Different" } }), async () => null), IdempotencyConflictError);
});

test("Portfolio read model is rebuildable, sorted and digest-stable", () => {
  const first = event({ sequence: 1 });
  const task = event({ eventId: "evt_002", aggregateType: "task", aggregateId: "task-001", aggregateVersion: 1, type: "task.created", sequence: 2, idempotencyKey: "cmd-002", data: { taskId: "task-001", title: "Research", status: "queued" } });
  const left = rebuildPortfolioReadModel({ projects: [{ projectId: "project-vpn", name: "VPN" }], events: [task, first] });
  const right = rebuildPortfolioReadModel({ projects: [{ projectId: "project-vpn", name: "VPN" }], events: [first, task] });
  assert.equal(left.digest, right.digest);
  assert.equal(left.projectCount, 1);
  assert.equal(left.projects[0].nextTasks[0].taskId, "task-001");
  assert.equal(left.sourceSequence, 2);
});
