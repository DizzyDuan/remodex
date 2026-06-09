const { readActiveThread } = require("./active-thread-reader");
const { findRolloutFileForThread } = require("./rollout-resolver");
const { readRecentThreadStore } = require("./thread-store-reader");
const { readRecentThreads } = require("./recent-thread-source");
const { readThreadRollout } = require("./jsonl-tail-reader");
const { createFileChangeWatcher } = require("./file-change-watcher");
const {
  aggregateStatus,
  ensureThreadState,
  itemKey,
  serializeThread,
  titleFromCwd,
  titleFromItems,
  updateMetadataFromEvent,
} = require("./thread-state");

function createSessionWatcher({
  config,
  onState = () => {},
  now = () => Date.now(),
  readThreadStore = readRecentThreadStore,
  fileChangeWatcherFactory = createFileChangeWatcher,
} = {}) {
  let intervalId = null;
  let fileChangeWatcher = null;
  let latestThreadId = "";
  let activeSource = "";
  let activeUpdatedAt = "";
  let activeUpdatedAtMs = 0;
  const threadStates = new Map();

  function start() {
    if (intervalId) {
      return;
    }
    tick();
    intervalId = setInterval(tick, config.pollMs || 2000);
    intervalId.unref?.();
    startFileChangeWatcher();
  }

  function stop() {
    stopFileChangeWatcher();
    if (!intervalId) {
      return;
    }
    clearInterval(intervalId);
    intervalId = null;
  }

  function tick() {
    const activeThread = readActiveThread(config.paths.lastThread);
    syncRecentThreads(activeThread);
    readKnownThreads();
    updateWatchedRollouts();
    emit();
  }

  function startFileChangeWatcher() {
    if (fileChangeWatcher || config.watch?.enabled === false) {
      return;
    }
    fileChangeWatcher = fileChangeWatcherFactory({
      paths: config.paths,
      enabled: true,
      debounceMs: config.watch?.debounceMs ?? 100,
      onChange: tick,
    });
    fileChangeWatcher.start();
    updateWatchedRollouts();
  }

  function stopFileChangeWatcher() {
    if (!fileChangeWatcher) {
      return;
    }
    fileChangeWatcher.stop();
    fileChangeWatcher = null;
  }

  function syncRecentThreads(activeThread) {
    const recentSessions = readRecentSessions();
    const recentThreadIds = new Set(recentSessions.map((session) => session.threadId));
    activeSource = activeThread.source || "";
    activeUpdatedAt = activeThread.updatedAt || "";
    activeUpdatedAtMs = activeThread.updatedAtMs || 0;

    for (const threadId of threadStates.keys()) {
      if (!recentThreadIds.has(threadId)) {
        threadStates.delete(threadId);
      }
    }

    for (const [index, session] of recentSessions.entries()) {
      const thread = ensureThreadState(threadStates, session.threadId, session.updatedAtMs || now());
      thread.lastActivityAt = session.updatedAtMs || thread.lastActivityAt;
      thread.sortRank = index;
      thread.indexUpdatedAtMs = session.updatedAtMs || 0;
      thread.indexTitle = session.source === "index" && session.title ? session.title : "";
      if (thread.indexTitle) {
        thread.title = thread.indexTitle;
      } else if (session.title) {
        thread.title = session.title;
      }
      if (session.rolloutPath) {
        thread.rolloutPath = session.rolloutPath;
        thread.rolloutMtimeMs = session.rolloutMtimeMs || 0;
      }
    }

    latestThreadId = recentSessions[0]?.threadId || "";

    if (activeThread.threadId && threadStates.has(activeThread.threadId)) {
      applyActiveThreadHint(activeThread);
    }
  }

  function readRecentSessions() {
    return readRecentThreads({
      paths: config.paths,
      readThreadStore,
    });
  }

  function applyActiveThreadHint(activeThread) {
    const thread = threadStates.get(activeThread.threadId);
    if (!thread) {
      return;
    }
    if (activeThread.title && !thread.indexTitle) {
      thread.title = activeThread.title;
    }
    if (!thread.rolloutPath) {
      thread.rolloutPath = findRolloutFileForThread(config.paths.sessionsRoot, activeThread.threadId) || "";
    }
  }

  function readKnownThreads() {
    for (const thread of threadStates.values()) {
      readThreadRollout({
        thread,
        sessionsRoot: config.paths.sessionsRoot,
        now,
      });
    }
  }

  function updateWatchedRollouts() {
    if (!fileChangeWatcher) {
      return;
    }
    fileChangeWatcher.updateRolloutPaths(
      Array.from(threadStates.values()).map((thread) => thread.rolloutPath)
    );
  }

  function emit() {
    const threads = Array.from(threadStates.values())
      .map((thread) => serializeThread(thread, now()))
      .sort((a, b) => a.sortRank - b.sortRank || b.lastActivityAt - a.lastActivityAt);
    const activeThread = threadStates.get(latestThreadId);
    const active = activeThread ? serializeThread(activeThread, now()) : null;

    onState({
      status: aggregateStatus(threads),
      latestThreadId,
      threads,
      threadId: active?.threadId || "",
      title: active?.title || "",
      activeSource,
      activeUpdatedAt,
      activeUpdatedAtMs,
      taskStatus: active?.taskStatus || "idle",
      rolloutPath: active?.rolloutPath || "",
      items: active?.items || [],
    });
  }

  return {
    start,
    stop,
    tick,
  };
}

module.exports = {
  createSessionWatcher,
  itemKey,
  readActiveThread,
  titleFromCwd,
  titleFromItems,
  updateMetadataFromEvent,
};
