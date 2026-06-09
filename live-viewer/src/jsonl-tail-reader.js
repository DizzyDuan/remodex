const fs = require("node:fs");
const { parseJsonlLine } = require("./jsonl-parser");
const { findRolloutFileForThread } = require("./rollout-resolver");
const { itemKey, updateMetadataFromEvent } = require("./thread-state");

function readThreadRollout({
  thread,
  sessionsRoot,
  now = () => Date.now(),
} = {}) {
  if (!ensureRolloutPath(thread, sessionsRoot)) {
    return;
  }

  const stat = statRollout(thread);
  if (!stat) {
    return;
  }

  resetIfTruncated(thread, stat.size);
  const isInitialSnapshot = !thread.hasReadSnapshot;
  if (stat.size === thread.offset) {
    thread.hasReadSnapshot = true;
    return;
  }

  const chunk = readRange(thread.rolloutPath, thread.offset, stat.size);
  thread.offset = stat.size;
  thread.lastActivityAt = Math.max(thread.lastActivityAt, stat.mtimeMs || now());
  thread.rolloutMtimeMs = stat.mtimeMs || thread.rolloutMtimeMs;
  readJsonlChunk(thread, chunk, { updateTaskStatus: !isInitialSnapshot });
  thread.hasReadSnapshot = true;
}

function ensureRolloutPath(thread, sessionsRoot) {
  if (thread.rolloutPath) {
    return true;
  }
  thread.rolloutPath = findRolloutFileForThread(sessionsRoot, thread.threadId) || "";
  return Boolean(thread.rolloutPath);
}

function statRollout(thread) {
  try {
    return fs.statSync(thread.rolloutPath);
  } catch {
    thread.rolloutPath = "";
    return null;
  }
}

function resetIfTruncated(thread, size) {
  if (size >= thread.offset) {
    return;
  }
  thread.offset = 0;
  thread.partialLine = "";
  thread.items = [];
  thread.seenItemKeys = new Set();
  thread.hasReadSnapshot = false;
}

function readJsonlChunk(thread, chunk, { updateTaskStatus = true } = {}) {
  const combined = thread.partialLine + chunk;
  const lines = combined.split("\n");
  thread.partialLine = lines.pop() || "";

  for (const line of lines) {
    updateThreadMetadata(thread, line, { updateTaskStatus });
    appendItems(thread, parseJsonlLine(line).filter((item) => item.kind !== "lifecycle"));
  }
}

function updateThreadMetadata(thread, line, { updateTaskStatus = true } = {}) {
  const metadata = updateMetadataFromEvent(parseEvent(line));
  if (metadata.title && !thread.indexTitle) {
    thread.title = metadata.title;
  }
  if (metadata.fallbackTitle) {
    thread.fallbackTitle = metadata.fallbackTitle;
  }
  if (metadata.taskStatus && updateTaskStatus) {
    thread.taskStatus = metadata.taskStatus;
  }
}

function appendItems(thread, nextItems) {
  for (const item of nextItems) {
    const key = itemKey(item);
    if (thread.seenItemKeys.has(key)) {
      continue;
    }
    thread.seenItemKeys.add(key);
    thread.items.push(item);
  }
}

function parseEvent(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function readRange(filePath, start, endExclusive) {
  const length = Math.max(0, endExclusive - start);
  if (!length) {
    return "";
  }

  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  readThreadRollout,
};
