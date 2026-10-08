const REQUIRED_SECRETS = Object.freeze([
  "HERO_OWNER_AUTH_SECRET",
  "HERO_IDENTITY_SESSION_SECRET",
  "HERO_OWNER_EMAIL",
  "HERO_OWNER_PASSWORD",
  "HERO_OWNER_MFA_SECRET",
  "HERO_BACKOFFICE_USER",
  "HERO_BACKOFFICE_PASSWORD",
  "HERO_POSTGRES_URL",
  "HERO_POSTGRES_PASSWORD"
]);

function isPlaceholder(value) {
  return typeof value !== "string" || value.trim() === "" || /^<[^>]+>$/.test(value.trim());
}

function hasMinimumLength(env, name, minimum, errors) {
  const value = env[name];
  if (isPlaceholder(value)) return;
  if (value.length < minimum) errors.push(`${name} باید حداقل ${minimum} نویسه باشد.`);
}

function validateOwnerEmail(env, errors) {
  const value = env.HERO_OWNER_EMAIL;
  if (isPlaceholder(value)) return;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("HERO_OWNER_EMAIL باید یک ایمیل معتبر باشد.");
  }
}

function validateOwnerIdentifier(env, errors) {
  const value = env.HERO_IDENTITY_OWNER_USER_ID ?? "hero-owner";
  if (!/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value)) {
    errors.push("HERO_IDENTITY_OWNER_USER_ID معتبر نیست.");
  }
}

function validateMfaEncryptionKey(env, errors) {
  for (const name of ["HERO_MFA_ENCRYPTION_KEY"]) {
    const value = env[name];
    if (isPlaceholder(value)) continue;
    const text = value.trim();
    const bytes = /^[a-f0-9]{64}$/i.test(text) ? 32 : Buffer.from(text, "base64url").length;
    if (bytes !== 32) errors.push(`${name} باید ۳۲ بایت (۶۴ نویسهٔ هگز یا base64url) باشد.`);
  }
}

function validateMfaSecret(env, errors) {
  const value = env.HERO_OWNER_MFA_SECRET;
  if (isPlaceholder(value)) return;
  const trimmed = value.trim();
  if (/^base32:/i.test(trimmed)) {
    const encoded = trimmed.slice(trimmed.indexOf(":") + 1).replace(/[\s-]/g, "").replace(/=+$/g, "");
    if (encoded.length < 16 || !/^[A-Z2-7]+$/i.test(encoded)) {
      errors.push("HERO_OWNER_MFA_SECRET با پیشوند base32: باید حداقل ۱۶ نویسهٔ Base32 معتبر داشته باشد.");
    }
    return;
  }
  if (/^(?:legacy|legacy-utf8|utf8):/i.test(trimmed)) {
    const legacy = trimmed.slice(trimmed.indexOf(":") + 1);
    if (legacy.length < 12) errors.push("HERO_OWNER_MFA_SECRET در حالت legacy باید حداقل ۱۲ نویسه باشد.");
    return;
  }
  if (trimmed.length < 12) errors.push("HERO_OWNER_MFA_SECRET legacy باید حداقل ۱۲ نویسه باشد.");
}

function validateSecretStore(env, errors) {
  if (env.HERO_SECRET_STORE_ENABLED !== "true") errors.push("HERO_SECRET_STORE_ENABLED باید true باشد.");
  if (env.HERO_SECRET_STORE_DIR !== "/var/lib/hero/secret-store") errors.push("HERO_SECRET_STORE_DIR باید /var/lib/hero/secret-store باشد.");
  const masterKey = env.HERO_SECRET_STORE_MASTER_KEY;
  if (!isPlaceholder(masterKey) && !/^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{43})$/i.test(masterKey.trim())) {
    errors.push("HERO_SECRET_STORE_MASTER_KEY باید ۳۲ بایت hex یا Base64URL باشد.");
  }
}

export function validateTestEnvironment(env = process.env) {
  const errors = [];
  const exact = [
    ["HERO_HTTP_HOST", "0.0.0.0"],
    ["HERO_HTTP_PORT", "3100"],
    ["HERO_BIND_ADDRESS", "127.0.0.1"],
    ["HERO_EXPOSE_PORT", "43101"],
    ["HERO_DATA_DIR", "/var/lib/hero"],
    ["HERO_REQUIRE_POSTGRES", "true"],
    ["HERO_ENABLE_REAL_PROVIDERS", "false"],
    ["HERO_SECRET_STORE_ENABLED", "true"],
    ["HERO_SECRET_STORE_DIR", "/var/lib/hero/secret-store"]
  ];

  for (const [name, expected] of exact) {
    if (env[name] !== expected) errors.push(`${name} باید ${expected} باشد.`);
  }
  for (const name of REQUIRED_SECRETS) {
    if (isPlaceholder(env[name])) errors.push(`${name} در Secret Store تنظیم نشده است.`);
  }
  hasMinimumLength(env, "HERO_OWNER_AUTH_SECRET", 32, errors);
  hasMinimumLength(env, "HERO_IDENTITY_SESSION_SECRET", 32, errors);
  hasMinimumLength(env, "HERO_OWNER_PASSWORD", 12, errors);
  hasMinimumLength(env, "HERO_BACKOFFICE_PASSWORD", 16, errors);
  hasMinimumLength(env, "HERO_POSTGRES_PASSWORD", 16, errors);
  validateOwnerEmail(env, errors);
  validateOwnerIdentifier(env, errors);
  validateMfaSecret(env, errors);
  validateMfaEncryptionKey(env, errors);
  validateSecretStore(env, errors);

  if (!isPlaceholder(env.HERO_POSTGRES_URL)) {
    try {
      const url = new URL(env.HERO_POSTGRES_URL);
      if (!(["postgres:", "postgresql:"].includes(url.protocol))) errors.push("HERO_POSTGRES_URL باید از نوع PostgreSQL باشد.");
      if (url.hostname !== "hero-postgres") errors.push("HERO_POSTGRES_URL باید به سرویس مستقل hero-postgres اشاره کند.");
      if (url.port !== "5432") errors.push("HERO_POSTGRES_URL باید از پورت 5432 سرویس Test استفاده کند.");
      if (url.username !== "hero" || url.pathname !== "/hero") errors.push("HERO_POSTGRES_URL باید database و user مستقل Test یعنی hero/hero را مشخص کند.");
      if (!url.password) errors.push("HERO_POSTGRES_URL باید password runtime داشته باشد.");
      else {
        try {
          if (decodeURIComponent(url.password) !== env.HERO_POSTGRES_PASSWORD) errors.push("password داخل HERO_POSTGRES_URL باید با HERO_POSTGRES_PASSWORD یکسان باشد.");
        } catch {
          errors.push("password داخل HERO_POSTGRES_URL encoding معتبر ندارد.");
        }
      }
    } catch {
      errors.push("HERO_POSTGRES_URL قابل parse نیست.");
    }
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateTestEnvironment();
  if (!result.ok) {
    console.error(`TEST CONFIG BLOCKED — ${result.errors.length} مورد نیاز به اصلاح دارد.`);
    for (const error of result.errors) console.error(`BLOCKED — ${error}`);
    process.exitCode = 1;
  } else {
    console.log("TEST CONFIG PASS — جداسازی Test معتبر است و Provider زنده خاموش است.");
  }
}
