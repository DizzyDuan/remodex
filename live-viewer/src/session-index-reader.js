const fs = require("node:fs");

function readRecentSessionIndex(filePath, { limit = 10 } = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  const latestByThread = new Map();
  for (const line of readLines(filePath)) {
    const entry = parseSessionIndexLine(line);
    if (!entry) {
      continue;
    }

    const existing = latestByThread.get(entry.threadId);
    if (!existing || compareSessions(entry, existing) < 0) {
      latestByThread.set(entry.threadId, entry);
    }
  }

  return Array.from(latestByThread.values())
    .sort(compareSessions)
    .slice(0, Math.max(0, limit));
}

function parseSessionIndexLine(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  const threadId = typeof parsed.id === "string" ? parsed.id.trim() : "";
  const title = typeof parsed.thread_name === "string" ? parsed.thread_name.trim() : "";
  const updatedAt = typeof parsed.updated_at === "string" ? parsed.updated_at.trim() : "";
  const updatedAtMs = Date.parse(updatedAt);
  if (!threadId || !Number.isFinite(updatedAtMs)) {
    return null;
  }

  return {
    threadId,
    title,
    updatedAt,
    updatedAtMs,
  };
}

function compareSessions(a, b) {
  return b.updatedAtMs - a.updatedAtMs || a.threadId.localeCompare(b.threadId);
}

function readLines(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").split("\n");
  } catch {
    return [];
  }
}

module.exports = {
  parseSessionIndexLine,
  readRecentSessionIndex,
};
