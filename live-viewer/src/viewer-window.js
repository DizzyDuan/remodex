const path = require("node:path");
const { BrowserWindow, screen } = require("electron");
const { calculateInitialWindowBounds } = require("./window-position");

function createViewerWindow(config) {
  const bounds = calculateInitialWindowBounds(config, screen.getPrimaryDisplay().workArea);
  const window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    maximizable: false,
    fullscreenable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: config.positioning.alwaysOnTop,
    focusable: false,
    acceptFirstMouse: true,
    title: "Remodex Live Viewer",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setMinimumSize(config.positioning.width, config.positioning.height);
  window.setMaximumSize(config.positioning.width, config.positioning.height);
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.webContents.setZoomFactor(1);
  window.webContents.setVisualZoomLevelLimits(1, 1);
  window.webContents.on("before-input-event", preventZoomShortcuts);
  window.loadFile(path.join(__dirname, "..", "public", "index.html"));

  return window;
}

function preventZoomShortcuts(event, input) {
  const isZoomShortcut = (input.meta || input.control)
    && ["+", "=", "-", "_", "0"].includes(input.key);
  if (isZoomShortcut) {
    event.preventDefault();
  }
}

module.exports = {
  createViewerWindow,
};
