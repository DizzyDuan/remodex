const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("remodexLiveViewer", {
  getInitialState: () => ipcRenderer.invoke("viewer:get-initial-state"),
  closeWindow: () => ipcRenderer.invoke("viewer:close-window"),
  toggleAlwaysOnTop: () => ipcRenderer.invoke("viewer:toggle-always-on-top"),
  beginDrag: (point) => ipcRenderer.invoke("viewer:begin-drag", point),
  dragWindow: (point) => ipcRenderer.invoke("viewer:drag-window", point),
  endDrag: () => ipcRenderer.invoke("viewer:end-drag"),
  onSession(callback) {
    return subscribe("viewer:session", callback);
  },
  onTheme(callback) {
    return subscribe("viewer:theme", callback);
  },
  onLanguage(callback) {
    return subscribe("viewer:language", callback);
  },
});

function subscribe(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
