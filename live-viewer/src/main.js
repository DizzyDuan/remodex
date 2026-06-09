const { app, ipcMain, nativeTheme } = require("electron");
const { readCodexPreferences } = require("./codex-preferences-reader");
const { loadConfig, saveConfig } = require("./config");
const { registerIpcHandlers } = require("./ipc-handlers");
const { createLanguageController } = require("./language-controller");
const { createSessionWatcher } = require("./session-watcher");
const { createThemeController } = require("./theme-controller");
const { createViewerWindow } = require("./viewer-window");
const { createWindowStartController } = require("./window-start-controller");

let config = null;
let mainWindow = null;
let latestSessionState = emptySessionState();
let sessionWatcher = null;
let themeController = null;
let languageController = null;
let windowStartController = null;
let latestLocale = "en-US";
let latestTheme = "dark";
let startedAtMs = Date.now();

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

  windowStartController = createWindowStartController({
    config,
    startedAtMs,
    precreateWindow: true,
    createWindow: () => {
      mainWindow = createViewerWindow(config);
      return mainWindow;
    },
  });

  if (hasArg(process.argv, "--show") || config.autoShow?.showOnLogin === true) {
    windowStartController.showExistingWindow();
  }
  if (hasArg(process.argv, "--hide")) {
    windowStartController.hideExistingWindow();
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
    getWindow: () => windowStartController?.getWindow() || null,
    getConfig: () => config,
    getInitialSession: () => latestSessionState,
    getTheme: () => themeController.getTheme(),
    getLocale: () => latestLocale,
    saveWindowPosition,
    saveAlwaysOnTop,
    onManualHide: () => windowStartController?.onManualHide(),
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
      windowStartController.handleSessionState(state);
    },
  });
  sessionWatcher.start();
}

function handleWindowCommand(commandLine = []) {
  if (!windowStartController) {
    return;
  }
  if (hasArg(commandLine, "--hide")) {
    windowStartController.hideExistingWindow();
    return;
  }
  windowStartController.showExistingWindow();
}

function hasArg(argv, flag) {
  return Array.isArray(argv) && argv.includes(flag);
}

function sendToRenderer(channel, payload) {
  windowStartController?.sendToRenderer(channel, payload);
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
