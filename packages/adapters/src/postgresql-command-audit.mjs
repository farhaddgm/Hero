import { randomUUID } from "node:crypto";

import { createOperationalEvent } from "../../contracts/src/operational-data.mjs";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const COMMAND = /^[a-z][a-z0-9._:-]{2,127}$/;

function copy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function assertCommand(value) {
  if (typeof value !== "string" || !COMMAND.test(value)) throw new Error("command is invalid.");
  return value;
}

export function createPostgresCommandAudit({ store, now = () => new Date().toISOString(), eventIdFactory } = {}) {
  if (!store || typeof store.appendEvent !== "function" || typeof store.readAfter !== "function") {
    throw new Error("PostgreSQL command audit requires an operational store.");
  }
  const makeEventId = eventIdFactory ?? (() => `evt_control_${randomUUID().replaceAll("-", "")}`);

  async function record({ command, projectId = "hero", actor = { kind: "system", id: "hero-control-plane" }, outcome = "accepted" } = {}) {
    const normalizedCommand = assertCommand(command);
    const normalizedProjectId = assertIdentifier("projectId", projectId);
    if (!['accepted', 'rejected'].includes(outcome)) throw new Error("audit outcome is invalid.");
    const event = createOperationalEvent({
      eventId: makeEventId(),
      aggregateType: "decision",
      aggregateId: `command-${randomUUID().replaceAll("-", "")}`,
      type: "control.command-recorded",
      occurredAt: now(),
      actor,
      correlationId: normalizedProjectId,
      data: {
        command: normalizedCommand,
        projectId: normalizedProjectId,
        outcome
      }
    });
    return copy(await store.appendEvent(event, { expectedVersion: 0 }));
  }

  return Object.freeze({ record });
}
