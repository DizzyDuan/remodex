const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createDefaultConfig,
  loadConfig,
  saveConfig,
} = require("../src/config");

test("default config uses a fixed 300 by 600 viewer and local-only paths", () => {
  const config = createDefaultConfig("/Users/dizzy");

  assert.equal(config.pollMs, 2000);
  assert.deepEqual(config.watch, {
    enabled: true,
    debounceMs: 100,
  });
  assert.deepEqual(config.autoShow, {
    mode: "on-phone-request",
    showOnLogin: false,
    cooldownMs: 1500,
    respectManualHideMs: 0,
  });
  assert.equal(config.closeBehavior, "hide");
  assert.equal(config.positioning.width, 300);
  assert.equal(config.positioning.height, 600);
  assert.equal(config.positioning.screenRightInset, 15);
  assert.equal(config.positioning.lastPosition, null);
  assert.equal(config.positioning.alwaysOnTop, true);
  assert.equal(config.paths.lastThread, "/Users/dizzy/.remodex/last-thread.json");
  assert.equal(config.paths.sessionIndex, "/Users/dizzy/.codex/session_index.jsonl");
  assert.equal(config.paths.stateDb, "/Users/dizzy/.codex/state_5.sqlite");
  assert.equal(config.paths.sessionsRoot, "/Users/dizzy/.codex/sessions");
  assert.equal(config.paths.bridgeLog, "/Users/dizzy/.remodex/logs/bridge.stdout.log");
  assert.equal(config.paths.remodexBin, undefined);
});

test("loadConfig creates missing config and merges new default sections", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-config-"));
  const configPath = path.join(dir, "config.json");

  const first = loadConfig({ configPath, homeDir: "/Users/dizzy" });
  assert.equal(first.positioning.width, 300);
  assert.ok(fs.existsSync(configPath));

  fs.writeFileSync(configPath, JSON.stringify({ pollMs: 250, positioning: { width: 280 } }));
  const merged = loadConfig({ configPath, homeDir: "/Users/dizzy" });

  assert.equal(merged.pollMs, 250);
  assert.equal(merged.positioning.width, 300);
  assert.equal(merged.positioning.height, 600);
  assert.equal(merged.positioning.screenRightInset, 15);
  assert.equal(merged.positioning.lastPosition, null);
  assert.equal(merged.positioning.alwaysOnTop, true);
  assert.deepEqual(merged.watch, {
    enabled: true,
    debounceMs: 100,
  });
  assert.deepEqual(merged.autoShow, {
    mode: "on-phone-request",
    showOnLogin: false,
    cooldownMs: 1500,
    respectManualHideMs: 0,
  });
  assert.equal(merged.closeBehavior, "hide");
  assert.deepEqual(merged.i18n.supportedLocales, ["en-US", "zh-CN"]);
});

test("loadConfig preserves explicit auto show settings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-auto-show-"));
  const configPath = path.join(dir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    autoShow: {
      mode: "manual",
      showOnLogin: true,
      cooldownMs: 2500,
      respectManualHideMs: 60000,
    },
    closeBehavior: "quit",
  }));

  const loaded = loadConfig({ configPath, homeDir: "/Users/dizzy" });

  assert.deepEqual(loaded.autoShow, {
    mode: "manual",
    showOnLogin: true,
    cooldownMs: 2500,
    respectManualHideMs: 60000,
  });
  assert.equal(loaded.closeBehavior, "quit");
});

test("loadConfig preserves explicit watch settings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-watch-"));
  const configPath = path.join(dir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    watch: {
      enabled: false,
      debounceMs: 250,
    },
  }));

  const loaded = loadConfig({ configPath, homeDir: "/Users/dizzy" });

  assert.deepEqual(loaded.watch, {
    enabled: false,
    debounceMs: 250,
  });
});

test("legacy attached positioning is removed while keeping fixed dimensions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-legacy-"));
  const configPath = path.join(dir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    codexBundleId: "com.openai.codex",
    windowPollMs: 800,
    positioning: {
      width: 290,
      height: 500,
      rightInset: 15,
      defaultOffset: { dxFromRight: -340, dyFromTop: 420 },
      userOffset: { dx: 10, dy: 20 },
    },
  }));

  const migrated = loadConfig({ configPath, homeDir: "/Users/dizzy" });

  assert.equal(migrated.positioning.width, 300);
  assert.equal(migrated.positioning.height, 600);
  assert.equal(migrated.positioning.screenRightInset, 15);
  assert.equal(migrated.positioning.lastPosition, null);
  assert.equal(migrated.positioning.alwaysOnTop, true);
  assert.equal(migrated.positioning.rightInset, undefined);
  assert.equal(migrated.positioning.userOffset, undefined);
  assert.equal(migrated.positioning.defaultOffset, undefined);
  assert.equal(migrated.codexBundleId, undefined);
  assert.equal(migrated.windowPollMs, undefined);
});

test("loadConfig preserves valid saved window position", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-position-"));
  const configPath = path.join(dir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    positioning: {
      lastPosition: { x: 120.4, y: 240.6 },
    },
  }));

  const loaded = loadConfig({ configPath, homeDir: "/Users/dizzy" });

  assert.deepEqual(loaded.positioning.lastPosition, { x: 120, y: 241 });
});

test("saveConfig writes saved window position while keeping fixed dimensions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-save-"));
  const configPath = path.join(dir, "config.json");

  const saved = saveConfig({
    pollMs: 250,
    positioning: {
      width: 999,
      height: 999,
      screenRightInset: 30,
      lastPosition: { x: 320, y: 180 },
      alwaysOnTop: false,
    },
  }, { configPath, homeDir: "/Users/dizzy" });

  assert.equal(saved.pollMs, 250);
  assert.equal(saved.positioning.width, 300);
  assert.equal(saved.positioning.height, 600);
  assert.equal(saved.positioning.screenRightInset, 30);
  assert.deepEqual(saved.positioning.lastPosition, { x: 320, y: 180 });
  assert.equal(saved.positioning.alwaysOnTop, false);

  const stored = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.deepEqual(stored.positioning.lastPosition, { x: 320, y: 180 });
  assert.equal(stored.positioning.alwaysOnTop, false);
});
