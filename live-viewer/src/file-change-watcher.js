const fs = require("node:fs");

const DEFAULT_DEBOUNCE_MS = 100;

function createFileChangeWatcher({
  paths = {},
  rolloutPaths = [],
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  fsImpl = fs,
  onChange = () => {},
} = {}) {
  const watchers = new Map();
  let stopped = true;
  let timer = null;

  function start() {
    if (!enabled || !stopped) {
      return;
    }
    stopped = false;
    watchStaticPaths();
    updateRolloutPaths(rolloutPaths);
  }

  function stop() {
    stopped = true;
    clearPendingChange();
    closeAllWatchers();
  }

  function updateRolloutPaths(nextRolloutPaths = []) {
    if (stopped || !enabled) {
      return;
    }

    const nextPaths = new Set(normalizePaths(nextRolloutPaths));
    for (const watchPath of Array.from(watchers.keys())) {
      if (!watchPath.startsWith("rollout:")) {
        continue;
      }
      const filePath = watchPath.slice("rollout:".length);
      if (!nextPaths.has(filePath)) {
        closeWatcher(watchPath);
      }
    }

    for (const filePath of nextPaths) {
      watchPath(`rollout:${filePath}`, filePath);
    }
  }

  function watchStaticPaths() {
    for (const filePath of normalizePaths([
      paths.lastThread,
      paths.sessionIndex,
      paths.sessionsRoot,
    ])) {
      watchPath(`static:${filePath}`, filePath);
    }
  }

  function watchPath(key, filePath) {
    if (!filePath || watchers.has(key)) {
      return;
    }

    try {
      const watcher = fsImpl.watch(filePath, scheduleChange);
      watchers.set(key, watcher);
    } catch {
      // fs.watch is an optimization. Polling remains the reliable fallback.
    }
  }

  function scheduleChange() {
    if (stopped) {
      return;
    }
    clearPendingChange();
    timer = setTimeout(() => {
      timer = null;
      if (!stopped) {
        onChange();
      }
    }, debounceMs);
    timer.unref?.();
  }

  function clearPendingChange() {
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    timer = null;
  }

  function closeAllWatchers() {
    for (const key of Array.from(watchers.keys())) {
      closeWatcher(key);
    }
  }

  function closeWatcher(key) {
    const watcher = watchers.get(key);
    watchers.delete(key);
    try {
      watcher?.close?.();
    } catch {
      // Best-effort cleanup only.
    }
  }

  function status() {
    return {
      enabled: Boolean(enabled),
      debounceMs,
      watcherCount: watchers.size,
    };
  }

  return {
    start,
    stop,
    updateRolloutPaths,
    status,
  };
}

function normalizePaths(paths) {
  return Array.from(new Set(
    paths
      .filter((filePath) => typeof filePath === "string")
      .map((filePath) => filePath.trim())
      .filter(Boolean)
  ));
}

module.exports = {
  createFileChangeWatcher,
};
