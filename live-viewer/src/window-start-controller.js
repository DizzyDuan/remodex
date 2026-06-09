const {
  sessionActivityKey,
  shouldAutoShowForSession,
} = require("./auto-show-controller");

function createWindowStartController({
  config,
  startedAtMs = Date.now(),
  now = Date.now,
  createWindow,
  precreateWindow = false,
} = {}) {
  let window = null;
  let lastAutoShowAtMs = 0;
  let lastAutoShowActivityKey = "";
  let lastManualHideAtMs = 0;

  if (precreateWindow) {
    ensureWindow();
  }

  function getWindow() {
    return isUsableWindow(window) ? window : null;
  }

  function ensureWindow() {
    const existingWindow = getWindow();
    if (existingWindow) {
      return existingWindow;
    }
    window = createWindow();
    return window;
  }

  function handleSessionState(state) {
    const nowMs = now();
    if (!shouldAutoShowForSession({
      state,
      config,
      startedAtMs,
      lastAutoShowAtMs,
      lastAutoShowActivityKey,
      lastManualHideAtMs,
      nowMs,
    })) {
      sendToRenderer("session", state);
      return false;
    }

    const nextWindow = ensureWindow();
    sendToRenderer("session", state);
    lastAutoShowAtMs = nowMs;
    lastAutoShowActivityKey = sessionActivityKey(state);
    nextWindow.showInactive();
    return true;
  }

  function showExistingWindow() {
    const nextWindow = ensureWindow();
    nextWindow.showInactive();
    return true;
  }

  function hideExistingWindow() {
    const existingWindow = getWindow();
    if (!existingWindow) {
      onManualHide();
      return false;
    }
    existingWindow.hide();
    onManualHide();
    return true;
  }

  function sendToRenderer(channel, payload) {
    const existingWindow = getWindow();
    if (!existingWindow) {
      return false;
    }
    existingWindow.webContents.send(`viewer:${channel}`, payload);
    return true;
  }

  function onManualHide() {
    lastManualHideAtMs = now();
  }

  return {
    getWindow,
    ensureWindow,
    handleSessionState,
    hideExistingWindow,
    onManualHide,
    sendToRenderer,
    showExistingWindow,
  };
}

function isUsableWindow(window) {
  return window && !window.isDestroyed();
}

module.exports = {
  createWindowStartController,
};
