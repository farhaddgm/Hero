import assert from "node:assert/strict";
import test from "node:test";
import { heroStatusLabel, normalizeHeroSearch } from "../apps/control-plane/src/ui-copy.mjs";
import { getHeroGlobalNavigation } from "../apps/control-plane/src/hero-shell.mjs";

test("Persian searches match Arabic letters, joining marks, diacritics and numeral variants", () => {
  assert.equal(normalizeHeroSearch("کارگاه کیفی ۱۲"), normalizeHeroSearch("كارگاه كِيفي 12"));
  assert.equal(normalizeHeroSearch("نرم‌افزار"), normalizeHeroSearch("نرم افزار"));
  assert.equal(normalizeHeroSearch("HERO-١٢"), normalizeHeroSearch("hero-12"));
  assert.equal(normalizeHeroSearch(null), "");
});

test("unknown states remain explicit and custom backend states remain visible", () => {
  assert.equal(heroStatusLabel(null), "نامشخص");
  assert.equal(heroStatusLabel("healthy"), "سالم");
  assert.equal(heroStatusLabel("blocked"), "مسدود");
  assert.equal(heroStatusLabel("new-backend-state"), "new-backend-state");
});

test("environment badges use explicit runtime configuration and never invent health", () => {
  const testPage = getHeroGlobalNavigation({ runtimeEnvironment: "test" });
  const productionPage = getHeroGlobalNavigation({ runtimeEnvironment: "production" });
  assert.match(testPage, /data-environment="test"[^>]*>محیط تست/);
  assert.match(productionPage, /data-environment="production"[^>]*>پروداکشن/);
  assert.match(getHeroGlobalNavigation({ runtimeEnvironment: "unexpected" }), /data-environment="private"/);
  assert.doesNotMatch(testPage, /data-environment="test"[^>]*>سالم/);
});
