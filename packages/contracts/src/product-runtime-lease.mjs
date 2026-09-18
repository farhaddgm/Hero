export const PRODUCT_RUNTIME_LEASE_CONTRACT_VERSION = "1.0";
export const PRODUCT_RUNTIME_LEASE_DEFAULT_TTL_SECONDS = 1_800;
export const PRODUCT_RUNTIME_LEASE_MIN_TTL_SECONDS = 60;
export const PRODUCT_RUNTIME_LEASE_MAX_TTL_SECONDS = 86_400;

const ID = /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/;
const STATES = Object.freeze(["active", "released", "expired"]);

function copy(value) { return Object.freeze(structuredClone(value)); }

function date(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return value;
}

function ttl(value) {
  if (!Number.isInteger(value) || value < PRODUCT_RUNTIME_LEASE_MIN_TTL_SECONDS || value > PRODUCT_RUNTIME_LEASE_MAX_TTL_SECONDS) throw new Error("leaseTtlSeconds is invalid.");
  return value;
}

export function createProductRuntimeLease({ reservationId, reservedAt, leaseTtlSeconds = PRODUCT_RUNTIME_LEASE_DEFAULT_TTL_SECONDS } = {}) {
  if (typeof reservationId !== "string" || !ID.test(reservationId)) throw new Error("reservationId is invalid.");
  const safeReservedAt = date(reservedAt, "reservedAt");
  const safeTtl = ttl(leaseTtlSeconds);
  const expiresAt = new Date(Date.parse(safeReservedAt) + safeTtl * 1_000).toISOString();
  return copy({ reservationId, reservedAt: safeReservedAt, leaseTtlSeconds: safeTtl, lastHeartbeatAt: safeReservedAt, expiresAt });
}

export function normalizeProductRuntimeLease({ reservationId, state = "active", reservedAt, leaseTtlSeconds, lastHeartbeatAt, expiresAt, releasedAt = null, releaseReason = null } = {}) {
  if (typeof reservationId !== "string" || !ID.test(reservationId)) throw new Error("reservationId is invalid.");
  if (!STATES.includes(state)) throw new Error("lease state is invalid.");
  date(reservedAt, "reservedAt");
  const safeTtl = ttl(leaseTtlSeconds);
  date(lastHeartbeatAt, "lastHeartbeatAt");
  date(expiresAt, "expiresAt");
  if (releasedAt !== null) date(releasedAt, "releasedAt");
  if (releaseReason !== null && (typeof releaseReason !== "string" || releaseReason.length < 3 || releaseReason.length > 160)) throw new Error("releaseReason is invalid.");
  return copy({ reservationId, state, reservedAt, leaseTtlSeconds: safeTtl, lastHeartbeatAt, expiresAt, releasedAt, releaseReason });
}

export function evaluateProductRuntimeLease({ lease, now = new Date().toISOString() } = {}) {
  const errors = [];
  let safeLease;
  try { safeLease = normalizeProductRuntimeLease(lease); } catch (error) { errors.push(error.message); }
  let safeNow;
  try { safeNow = date(now, "now"); } catch (error) { errors.push(error.message); }
  if (errors.length) return copy({ decision: "reject", state: "invalid", expired: false, errors, sideEffects: "none" });
  if (safeLease.state !== "active") return copy({ decision: "ignore", state: safeLease.state, expired: false, errors: [], sideEffects: "none" });
  const expired = Date.parse(safeNow) >= Date.parse(safeLease.expiresAt);
  return copy({ decision: expired ? "expire" : "active", state: safeLease.state, expired, errors: [], sideEffects: "none" });
}

export function heartbeatProductRuntimeLease({ lease, now = new Date().toISOString() } = {}) {
  const safeLease = normalizeProductRuntimeLease(lease);
  const safeNow = date(now, "now");
  const current = evaluateProductRuntimeLease({ lease: safeLease, now: safeNow });
  if (current.decision !== "active") return copy({ status: "blocked", code: "PRODUCT_RUNTIME_LEASE_EXPIRED", lease: safeLease, decision: current });
  const renewed = { ...safeLease, lastHeartbeatAt: safeNow, expiresAt: new Date(Date.parse(safeNow) + safeLease.leaseTtlSeconds * 1_000).toISOString() };
  return copy({ status: "renewed", code: "PRODUCT_RUNTIME_LEASE_HEARTBEAT", lease: renewed, decision: current });
}

export function getProductRuntimeLeaseSummary() {
  return copy({ version: PRODUCT_RUNTIME_LEASE_CONTRACT_VERSION, states: STATES, defaultTtlSeconds: PRODUCT_RUNTIME_LEASE_DEFAULT_TTL_SECONDS, boundary: "lease expiry is reported or explicitly reconciled; it never authorizes Product Test execution" });
}

export function validateProductRuntimeLeaseContract() {
  const errors = [];
  if (PRODUCT_RUNTIME_LEASE_CONTRACT_VERSION !== "1.0") errors.push("Unexpected Product Runtime Lease contract version.");
  if (!STATES.includes("expired")) errors.push("Expired lease state is required.");
  if (PRODUCT_RUNTIME_LEASE_DEFAULT_TTL_SECONDS < PRODUCT_RUNTIME_LEASE_MIN_TTL_SECONDS) errors.push("Default lease TTL is below the safe minimum.");
  return errors;
}
