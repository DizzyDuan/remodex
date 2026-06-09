const { app, ipcMain, nativeTheme } = require("electron");
const {
  sessionActivityKey,
  shouldAutoShowForSession,
} = require("./auto-show-controller");
const { readCodexPreferences } = require("./codex-preferences-reader");
const { loadConfig, saveConfig } = require("./config");
const { registerIpcHandlers } = require("./ipc-handlers");
const { createLanguageController } = require("./language-controller");
const { createSessionWatcher } = require("./session-watcher");
const { createThemeController } = require("./theme-controller");
const { createViewerWindow } = require("./viewer-window");

let config = null;
let mainWindow = null;
let latestSessionState = emptySessionState();
let sessionWatcher = null;
let themeController = null;
let languageController = null;
let latestLocale = "en-US";
let latestTheme = "dark";
let startedAtMs = Date.now();
let lastAutoShowAtMs = 0;
let lastAutoShowActivityKey = "";
let lastManualHideAtMs = 0;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    handleWindowCommand(commandLine);
  });
  app.whenReady().then(startApp);
}

app.on("window-all-closed", () => {
  cleanup();
  app.quit();
});

app.on("before-quit", cleanup);

function startApp() {
  startedAtMs = Date.now();
  config = loadConfig();
  if (app.dock) {
    app.dock.hide();
  }

  themeController = createThemeController({
    nativeTheme,
    preferencesReader: { readCodexPreferences },
  });
  languageController = createLanguageController({
    app,
    preferencesReader: { readCodexPreferences },
    config,
  });
  latestLocale = languageController.getLocale();
  latestTheme = themeController.getTheme();

  mainWindow = createViewerWindow(config);
  if (hasArg(process.argv, "--show") || config.autoShow?.showOnLogin === true) {
    mainWindow.showInactive();
  }
  if (hasArg(process.argv, "--hide")) {
    mainWindow.hide();
  }
  registerHandlers();
  startSessionWatcher();

  themeController.onChange((theme) => {
    latestTheme = theme;
    sendToRenderer("theme", theme);
  });
}

function registerHandlers() {
  registerIpcHandlers({
    app,
    ipcMain,
    getWindow: () => mainWindow,
    getConfig: () => config,
    getInitialSession: () => latestSessionState,
    getTheme: () => themeController.getTheme(),
    getLocale: () => latestLocale,
    saveWindowPosition,
    saveAlwaysOnTop,
    onManualHide,
  });
}

function saveWindowPosition(position) {
  config = saveConfig({
    ...config,
    positioning: {
      ...config.positioning,
      lastPosition: position,
    },
  });
}

function saveAlwaysOnTop(alwaysOnTop) {
  config = saveConfig({
    ...config,
    positioning: {
      ...config.positioning,
      alwaysOnTop,
    },
  });
}

function startSessionWatcher() {
  sessionWatcher = createSessionWatcher({
    config,
    onState(state) {
      latestSessionState = state;
      sendToRenderer("session", state);
      maybeAutoShowForSession(state);
    },
  });
  sessionWatcher.start();
}

function maybeAutoShowForSession(state) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const nowMs = Date.now();
  if (!shouldAutoShowForSession({
    state,
    config,
    startedAtMs,
    lastAutoShowAtMs,
    lastAutoShowActivityKey,
    lastManualHideAtMs,
    nowMs,
  })) {
    return;
  }

  lastAutoShowAtMs = nowMs;
  lastAutoShowActivityKey = sessionActivityKey(state);
  mainWindow.showInactive();
}

function onManualHide() {
  lastManualHideAtMs = Date.now();
}

function showExistingWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.showInactive();
}

function handleWindowCommand(commandLine = []) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (hasArg(commandLine, "--hide")) {
    mainWindow.hide();
    onManualHide();
    return;
  }
  showExistingWindow();
}

function hasArg(argv, flag) {
  return Array.isArray(argv) && argv.includes(flag);
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(`viewer:${channel}`, payload);
}

function cleanup() {
  if (sessionWatcher) {
    sessionWatcher.stop();
    sessionWatcher = null;
  }
}

function emptySessionState() {
  return {
    status: "disconnected",
    threadId: "",
    title: "",
    taskStatus: "idle",
    activeSource: "",
    activeUpdatedAt: "",
    activeUpdatedAtMs: 0,
    rolloutPath: "",
    items: [],
  };
}
