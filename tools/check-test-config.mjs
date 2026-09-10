const REQUIRED_SECRETS = Object.freeze([
  "HERO_OWNER_AUTH_SECRET",
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

export function validateTestEnvironment(env = process.env) {
  const errors = [];
  const exact = [
    ["HERO_HTTP_HOST", "0.0.0.0"],
    ["HERO_HTTP_PORT", "3100"],
    ["HERO_BIND_ADDRESS", "127.0.0.1"],
    ["HERO_EXPOSE_PORT", "43101"],
    ["HERO_DATA_DIR", "/var/lib/hero"],
    ["HERO_REQUIRE_POSTGRES", "true"],
    ["HERO_ENABLE_REAL_PROVIDERS", "false"]
  ];

  for (const [name, expected] of exact) {
    if (env[name] !== expected) errors.push(`${name} باید ${expected} باشد.`);
  }
  for (const name of REQUIRED_SECRETS) {
    if (isPlaceholder(env[name])) errors.push(`${name} در Secret Store تنظیم نشده است.`);
  }
  hasMinimumLength(env, "HERO_OWNER_AUTH_SECRET", 32, errors);
  hasMinimumLength(env, "HERO_BACKOFFICE_PASSWORD", 16, errors);
  hasMinimumLength(env, "HERO_POSTGRES_PASSWORD", 16, errors);

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
