function copy(value) {
  return Object.freeze(structuredClone(value));
}

function normalizePositiveInteger(label, value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new OutboxWorkerError("INVALID_OPTIONS", `${label} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

function safeError(error) {
  const message = String(error?.message ?? error ?? "outbox delivery failed").trim();
  return message.length > 500 ? message.slice(0, 500) : message || "outbox delivery failed";
}

export class OutboxWorkerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OutboxWorkerError";
    this.code = code;
  }
}

/**
 * Delivers claimed records through explicitly injected handlers.
 * The worker is inert until drain() is called, so startup cannot create
 * external messages or spend without an independently authorized caller.
 */
export function createPostgresOutboxWorker({ store, handlers = {}, defaultHandler, maxAttempts = 5 } = {}) {
  if (!store || typeof store.claimOutbox !== "function" || typeof store.acknowledgeOutbox !== "function" || typeof store.failOutbox !== "function") {
    throw new OutboxWorkerError("STORE_INVALID", "An outbox store with claim, acknowledge and fail operations is required.");
  }
  if (!handlers || typeof handlers !== "object" || Array.isArray(handlers)) throw new OutboxWorkerError("HANDLERS_INVALID", "handlers must be an object.");
  const normalizedMaxAttempts = normalizePositiveInteger("maxAttempts", maxAttempts, 1, 100);

  async function drain({ limit = 10, leaseSeconds = 300 } = {}) {
    const normalizedLimit = normalizePositiveInteger("limit", limit, 1, 100);
    const normalizedLease = normalizePositiveInteger("leaseSeconds", leaseSeconds, 1, 86_400);
    const claimed = await store.claimOutbox({ limit: normalizedLimit, leaseSeconds: normalizedLease });
    const deliveries = [];
    for (const item of claimed) {
      const handler = handlers[item.topic] ?? defaultHandler;
      try {
        if (typeof handler !== "function") throw new OutboxWorkerError("HANDLER_NOT_CONFIGURED", `No handler is configured for topic ${item.topic}.`);
        const result = await handler(copy(item));
        const published = await store.acknowledgeOutbox(item.outboxId);
        if (!published || published.status !== "published") throw new OutboxWorkerError("ACKNOWLEDGE_FAILED", "Outbox acknowledgement was not confirmed.");
        deliveries.push(copy({ outboxId: item.outboxId, topic: item.topic, status: "published", result: result ?? null }));
      } catch (error) {
        const failed = await store.failOutbox(item.outboxId, safeError(error), { maxAttempts: normalizedMaxAttempts });
        deliveries.push(copy({ outboxId: item.outboxId, topic: item.topic, status: failed?.status ?? "pending", error: safeError(error) }));
      }
    }
    return copy({
      claimed: claimed.length,
      published: deliveries.filter(item => item.status === "published").length,
      retried: deliveries.filter(item => item.status === "pending").length,
      failed: deliveries.filter(item => item.status === "failed").length,
      deliveries
    });
  }

  return Object.freeze({ drain });
}
