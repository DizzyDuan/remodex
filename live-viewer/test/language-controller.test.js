const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeLocale,
  resolveLocale,
} = require("../src/language-controller");

test("normalizes supported Chinese and English locale variants", () => {
  assert.equal(normalizeLocale("zh"), "zh-CN");
  assert.equal(normalizeLocale("zh-Hans"), "zh-CN");
  assert.equal(normalizeLocale("zh-CN"), "zh-CN");
  assert.equal(normalizeLocale("en"), "en-US");
  assert.equal(normalizeLocale("en-US"), "en-US");
});

test("unsupported locales fall back to en-US", () => {
  assert.equal(normalizeLocale("fr-FR"), "en-US");
  assert.equal(normalizeLocale(""), "en-US");
  assert.equal(normalizeLocale(null), "en-US");
});

test("Codex locale wins over system locale when supported", () => {
  assert.equal(
    resolveLocale({
      codexLocale: "zh-CN",
      systemLocale: "en-US",
      supportedLocales: ["en-US", "zh-CN"],
      defaultLocale: "en-US",
    }),
    "zh-CN"
  );
});

test("Codex English locale wins over Chinese system locale", () => {
  assert.equal(
    resolveLocale({
      codexLocale: "en",
      systemLocale: "zh-CN",
      supportedLocales: ["en-US", "zh-CN"],
      defaultLocale: "en-US",
    }),
    "en-US"
  );
});

test("system locale is used when Codex locale is unavailable", () => {
  assert.equal(
    resolveLocale({
      codexLocale: null,
      systemLocale: "zh-Hans",
      supportedLocales: ["en-US", "zh-CN"],
      defaultLocale: "en-US",
    }),
    "zh-CN"
  );
});
