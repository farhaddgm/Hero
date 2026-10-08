import crypto from "node:crypto";

/**
 * BO-025: user MFA secrets must survive a restart without ever being stored in clear.
 * A secret is sealed with AES-256-GCM. The key comes only from the environment, the
 * user id is bound as associated data (a sealed value cannot be moved to another
 * account), and a key id lets the key be rotated: the current key seals, the
 * previous keys can still open. Without a key nothing is sealed and nothing is
 * stored; the account then refuses MFA login with a clear code instead of passing.
 */
const PREFIX = "mfa1";
export class MfaVaultError extends Error { constructor(code, message) { super(message); this.name = "MfaVaultError"; this.code = code; } }

function parseKey(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const bytes = /^[a-f0-9]{64}$/i.test(text) ? Buffer.from(text, "hex") : Buffer.from(text, "base64url");
  return bytes.length === 32 ? bytes : "invalid";
}
const keyId = key => crypto.createHash("sha256").update(key).digest("hex").slice(0, 8);

export function createMfaVault({ key = process.env.HERO_MFA_ENCRYPTION_KEY, previousKeys = process.env.HERO_MFA_ENCRYPTION_KEY_PREVIOUS } = {}) {
  const current = parseKey(key);
  if (current === "invalid") throw new MfaVaultError("MFA_KEY_INVALID", "HERO_MFA_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64url).");
  const previous = String(previousKeys ?? "").split(",").map(parseKey).filter(Boolean);
  if (previous.includes("invalid")) throw new MfaVaultError("MFA_KEY_INVALID", "A previous MFA key is not 32 bytes.");
  const keys = new Map([...(current ? [current] : []), ...previous].map(item => [keyId(item), item]));
  const aad = userId => Buffer.from(`hero-mfa:${userId}`, "utf8");

  return Object.freeze({
    enabled: Boolean(current),
    status: current ? "encrypted" : "unavailable-no-key",
    keyId: current ? keyId(current) : null,
    seal(userId, secret) {
      if (!current) throw new MfaVaultError("MFA_KEY_MISSING", "No MFA encryption key is configured.");
      if (typeof secret !== "string" || secret.length < 12) throw new MfaVaultError("MFA_SECRET_INVALID", "The MFA secret is invalid.");
      const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", current, iv); cipher.setAAD(aad(userId));
      const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
      return [PREFIX, keyId(current), iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
    },
    open(userId, sealed) {
      const [prefix, id, iv, tag, body] = String(sealed ?? "").split(".");
      if (prefix !== PREFIX || !id || !iv || !tag || !body) throw new MfaVaultError("MFA_SEAL_INVALID", "The sealed MFA secret is malformed.");
      const secretKey = keys.get(id); if (!secretKey) throw new MfaVaultError("MFA_KEY_UNKNOWN", "The key that sealed this MFA secret is not available.");
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey, Buffer.from(iv, "base64url")); decipher.setAAD(aad(userId)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
        return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
      } catch { throw new MfaVaultError("MFA_SEAL_TAMPERED", "The sealed MFA secret failed authentication."); }
    },
    /** True when the value was sealed with an older key and should be sealed again. */
    needsRotation(sealed) { return current ? String(sealed ?? "").split(".")[1] !== keyId(current) : false; }
  });
}
