function registerIpcHandlers({
  app,
  ipcMain,
  getWindow,
  getConfig,
  getInitialSession,
  getTheme,
  getLocale,
  saveWindowPosition,
  saveAlwaysOnTop,
  onManualHide,
}) {
  let manualDrag = null;

  ipcMain.handle("viewer:get-initial-state", () => ({
    config: getConfig(),
    session: getInitialSession(),
    theme: getTheme(),
    locale: getLocale(),
  }));

  ipcMain.handle("viewer:close-window", () => {
    const window = getWindow();
    if (getConfig().closeBehavior === "quit") {
      app.quit();
      return true;
    }
    if (window && !window.isDestroyed()) {
      window.hide();
    }
    if (typeof onManualHide === "function") {
      onManualHide();
    }
    return true;
  });

  ipcMain.handle("viewer:toggle-always-on-top", () => {
    const window = getWindow();
    if (!window || window.isDestroyed()) {
      return Boolean(getConfig().positioning.alwaysOnTop);
    }

    const nextAlwaysOnTop = !window.isAlwaysOnTop();
    window.setAlwaysOnTop(nextAlwaysOnTop);
    if (typeof saveAlwaysOnTop === "function") {
      saveAlwaysOnTop(nextAlwaysOnTop);
    }
    return nextAlwaysOnTop;
  });

  ipcMain.handle("viewer:begin-drag", (_event, point) => {
    const window = getWindow();
    if (!window || window.isDestroyed() || !isPoint(point)) {
      return false;
    }

    manualDrag = {
      startPoint: point,
      startBounds: window.getBounds(),
    };
    return true;
  });

  ipcMain.handle("viewer:drag-window", (_event, point) => {
    const window = getWindow();
    if (!manualDrag || !window || window.isDestroyed() || !isPoint(point)) {
      return false;
    }

    const nextBounds = {
      ...manualDrag.startBounds,
      x: Math.round(manualDrag.startBounds.x + point.screenX - manualDrag.startPoint.screenX),
      y: Math.round(manualDrag.startBounds.y + point.screenY - manualDrag.startPoint.screenY),
    };
    window.setBounds(nextBounds, false);
    return true;
  });

  ipcMain.handle("viewer:end-drag", () => {
    const window = getWindow();
    if (window && !window.isDestroyed() && typeof saveWindowPosition === "function") {
      const bounds = window.getBounds();
      saveWindowPosition({ x: bounds.x, y: bounds.y });
    }
    manualDrag = null;
    return true;
  });
}

function isPoint(point) {
  return point
    && Number.isFinite(point.screenX)
    && Number.isFinite(point.screenY);
}

module.exports = {
  registerIpcHandlers,
};
