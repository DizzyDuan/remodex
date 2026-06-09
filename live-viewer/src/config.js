const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CONFIG_DIR_NAME = ".remodex-live-viewer";
const CONFIG_FILE_NAME = "config.json";

function createDefaultConfig(homeDir = os.homedir()) {
  return {
    pollMs: 2000,
    watch: {
      enabled: true,
      debounceMs: 100,
    },
    autoShow: {
      mode: "on-phone-request",
      showOnLogin: false,
      cooldownMs: 1500,
      respectManualHideMs: 0,
    },
    closeBehavior: "hide",
    positioning: {
      width: 300,
      height: 600,
      screenRightInset: 15,
      lastPosition: null,
      alwaysOnTop: true,
    },
    appearance: {
      themeSource: "codex",
      fallbackTheme: "system",
      languageSource: "codex",
      fallbackLanguage: "system",
    },
    i18n: {
      supportedLocales: ["en-US", "zh-CN"],
      defaultLocale: "en-US",
    },
    paths: {
      lastThread: path.join(homeDir, ".remodex", "last-thread.json"),
      sessionIndex: path.join(homeDir, ".codex", "session_index.jsonl"),
      stateDb: path.join(homeDir, ".codex", "state_5.sqlite"),
      sessionsRoot: path.join(homeDir, ".codex", "sessions"),
      bridgeLog: path.join(homeDir, ".remodex", "logs", "bridge.stdout.log"),
    },
  };
}

function defaultConfigPath(homeDir = os.homedir()) {
  return path.join(homeDir, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
}

function loadConfig(options = {}) {
  const configPath = options.configPath || defaultConfigPath(options.homeDir);
  const defaults = createDefaultConfig(options.homeDir);

  if (!fs.existsSync(configPath)) {
    ensureParentDir(configPath);
    fs.writeFileSync(configPath, `${JSON.stringify(defaults, null, 2)}\n`);
    return defaults;
  }

  let current = {};
  try {
    current = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    current = {};
  }

  const merged = mergeConfig(defaults, current);
  fs.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

function saveConfig(config, options = {}) {
  const configPath = options.configPath || defaultConfigPath(options.homeDir);
  const defaults = createDefaultConfig(options.homeDir);
  const merged = mergeConfig(defaults, config);
  ensureParentDir(configPath);
  fs.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

function mergeConfig(defaults, current) {
  if (!isPlainObject(current)) {
    return defaults;
  }

  const currentPositioning = isPlainObject(current.positioning) ? current.positioning : {};
  const merged = { ...defaults, ...current };
  delete merged.codexBundleId;
  delete merged.windowPollMs;
  merged.positioning = {
    ...defaults.positioning,
    ...currentPositioning,
    width: defaults.positioning.width,
    height: defaults.positioning.height,
    screenRightInset: normalizeNumber(
      currentPositioning.screenRightInset,
      defaults.positioning.screenRightInset,
    ),
    lastPosition: normalizePosition(currentPositioning.lastPosition),
    alwaysOnTop: typeof currentPositioning.alwaysOnTop === "boolean"
      ? currentPositioning.alwaysOnTop
      : defaults.positioning.alwaysOnTop,
  };
  merged.watch = {
    ...defaults.watch,
    ...(isPlainObject(current.watch) ? current.watch : {}),
  };
  merged.watch.enabled = typeof merged.watch.enabled === "boolean"
    ? merged.watch.enabled
    : defaults.watch.enabled;
  merged.watch.debounceMs = normalizeNumber(
    merged.watch.debounceMs,
    defaults.watch.debounceMs,
  );
  merged.autoShow = {
    ...defaults.autoShow,
    ...(isPlainObject(current.autoShow) ? current.autoShow : {}),
  };
  merged.autoShow.mode = ["on-phone-request", "manual"].includes(merged.autoShow.mode)
    ? merged.autoShow.mode
    : defaults.autoShow.mode;
  merged.autoShow.showOnLogin = typeof merged.autoShow.showOnLogin === "boolean"
    ? merged.autoShow.showOnLogin
    : defaults.autoShow.showOnLogin;
  merged.autoShow.cooldownMs = normalizeNumber(
    merged.autoShow.cooldownMs,
    defaults.autoShow.cooldownMs,
  );
  merged.autoShow.respectManualHideMs = normalizeNumber(
    merged.autoShow.respectManualHideMs,
    defaults.autoShow.respectManualHideMs,
  );
  merged.closeBehavior = ["hide", "quit"].includes(merged.closeBehavior)
    ? merged.closeBehavior
    : defaults.closeBehavior;
  delete merged.positioning.defaultOffset;
  delete merged.positioning.rightInset;
  delete merged.positioning.userOffset;
  merged.appearance = {
    ...defaults.appearance,
    ...(isPlainObject(current.appearance) ? current.appearance : {}),
  };
  merged.i18n = {
    ...defaults.i18n,
    ...(isPlainObject(current.i18n) ? current.i18n : {}),
  };
  merged.paths = {
    ...defaults.paths,
    ...(isPlainObject(current.paths) ? current.paths : {}),
  };
  delete merged.paths.remodexBin;
  return merged;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizePosition(position) {
  if (!isPlainObject(position)
    || !Number.isFinite(position.x)
    || !Number.isFinite(position.y)) {
    return null;
  }

  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
}

module.exports = {
  createDefaultConfig,
  defaultConfigPath,
  loadConfig,
  saveConfig,
};
