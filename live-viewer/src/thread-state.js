const path = require("node:path");

const STALE_AFTER_MS = 5_000;

function ensureThreadState(threadStates, threadId, timestamp = Date.now()) {
  if (!threadStates.has(threadId)) {
    threadStates.set(threadId, createThreadState(threadId, timestamp));
  }
  return threadStates.get(threadId);
}

function createThreadState(threadId, timestamp = Date.now()) {
  return {
    threadId,
    rolloutPath: "",
    offset: 0,
    partialLine: "",
    lastActivityAt: timestamp,
    items: [],
    seenItemKeys: new Set(),
    title: "",
    fallbackTitle: "",
    taskStatus: "idle",
    rolloutMtimeMs: 0,
    indexUpdatedAtMs: 0,
    indexTitle: "",
    sortRank: Number.MAX_SAFE_INTEGER,
    hasReadSnapshot: false,
  };
}

function serializeThread(thread, timestamp = Date.now()) {
  const status = thread.rolloutPath
    ? timestamp - thread.lastActivityAt > STALE_AFTER_MS ? "stale" : "live"
    : "stale";
  return {
    status,
    threadId: thread.threadId,
    title: thread.title || titleFromItems(thread.items) || thread.fallbackTitle,
    taskStatus: thread.taskStatus,
    rolloutPath: thread.rolloutPath,
    lastActivityAt: thread.lastActivityAt,
    sortRank: thread.sortRank,
    items: thread.items,
  };
}

function aggregateStatus(threads) {
  if (!threads.length) {
    return "disconnected";
  }
  return threads.some((thread) => thread.status === "live") ? "live" : "stale";
}

function updateMetadataFromEvent(event) {
  const payload = event?.payload || {};
  const canCarryTitle = event?.type === "session_meta"
    || event?.type === "thread_meta"
    || event?.type === "turn_context";
  const title = firstString(
    ...(canCarryTitle ? [
      payload.title,
      payload.threadTitle,
      payload.conversationTitle,
      event.title,
      event.threadTitle,
      event.conversationTitle,
    ] : [])
  );

  return {
    title,
    fallbackTitle: canCarryTitle ? titleFromCwd(payload.cwd) : "",
    taskStatus: taskStatusFromEventType(payload.type || payload.event_type || event?.type),
  };
}

function taskStatusFromEventType(type) {
  if (type === "task_started") {
    return "running";
  }
  if (type === "task_complete") {
    return "complete";
  }
  return null;
}

function itemKey(item) {
  return JSON.stringify({
    role: item.role,
    kind: item.kind,
    turnId: item.turnId || "",
    text: item.text,
  });
}

function titleFromCwd(cwd) {
  if (typeof cwd !== "string" || !cwd.trim()) {
    return "";
  }
  return humanizeTitle(path.basename(cwd));
}

function titleFromItems(items) {
  const firstUserMessage = items.find((item) => item.role === "user" && item.text);
  if (!firstUserMessage) {
    return "";
  }
  return compactTitle(firstUserMessage.text);
}

function compactTitle(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function humanizeTitle(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstString(...values) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return value ? value.trim() : "";
}

module.exports = {
  aggregateStatus,
  ensureThreadState,
  itemKey,
  serializeThread,
  titleFromCwd,
  titleFromItems,
  updateMetadataFromEvent,
};
