const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  extractPreferences,
  readCodexPreferences,
} = require("../src/codex-preferences-reader");

test("extractPreferences reads desktop appearanceTheme from Codex TOML config", () => {
  const preferences = extractPreferences({
    desktop: {
      appearanceTheme: "dark",
    },
  });

  assert.equal(preferences.theme, "dark");
});

test("readCodexPreferences reads ~/.codex/config.toml desktop appearanceTheme", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-"));
  fs.mkdirSync(path.join(homeDir, ".codex"), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, ".codex", "config.toml"),
    '[desktop]\nappearanceTheme = "light"\n',
    "utf8"
  );

  const preferences = readCodexPreferences(homeDir);

  assert.equal(preferences.theme, "light");
});

test("readCodexPreferences skips existing files without preference values", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-"));
  fs.mkdirSync(path.join(homeDir, "Library", "Application Support", "Codex"), { recursive: true });
  fs.mkdirSync(path.join(homeDir, ".codex"), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, "Library", "Application Support", "Codex", "Preferences.json"),
    JSON.stringify({ profile: { name: "Codex" } }),
    "utf8"
  );
  fs.writeFileSync(
    path.join(homeDir, ".codex", "config.toml"),
    '[desktop]\nappearanceTheme = "dark"\n',
    "utf8"
  );

  const preferences = readCodexPreferences(homeDir);

  assert.equal(preferences.theme, "dark");
});
