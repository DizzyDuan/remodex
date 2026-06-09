const fs = require("node:fs");
const { findRecentRolloutFiles } = require("./rollout-resolver");
const { readRecentSessionIndex } = require("./session-index-reader");
const { readRecentThreadStore: defaultReadRecentThreadStore } = require("./thread-store-reader");

const RECENT_THREAD_LIMIT = 10;
const THREAD_STORE_CANDIDATE_LIMIT = 50;

function readRecentThreads({
  paths,
  readThreadStore = defaultReadRecentThreadStore,
  limit = RECENT_THREAD_LIMIT,
  candidateLimit = THREAD_STORE_CANDIDATE_LIMIT,
} = {}) {
  const indexSessions = readRecentSessionIndex(paths.sessionIndex, { limit: candidateLimit });
  const indexTitleByThread = new Map(indexSessions.map((session) => [session.threadId, session.title]));
  const storeSessions = readThreadStore(paths.stateDb, { limit: candidateLimit })
    .filter((session) => rolloutExists(session.rolloutPath))
    .slice(0, limit);

  if (storeSessions.length) {
    return storeSessions.map((session) => ({
      threadId: session.threadId,
      title: indexTitleByThread.get(session.threadId) || session.title || session.preview || session.firstUserMessage || "",
      source: indexTitleByThread.has(session.threadId) ? "index" : "store",
      updatedAt: "",
      updatedAtMs: session.updatedAtMs || 0,
      rolloutPath: session.rolloutPath,
      rolloutMtimeMs: 0,
    }));
  }

  return findRecentRolloutFiles(paths.sessionsRoot, { limit })
    .map((rollout) => ({
      threadId: rollout.threadId,
      title: "",
      source: "rollout",
      updatedAt: "",
      updatedAtMs: rollout.mtimeMs || 0,
      rolloutPath: rollout.filePath,
      rolloutMtimeMs: rollout.mtimeMs || 0,
    }));
}

function rolloutExists(filePath) {
  try {
    return Boolean(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

module.exports = {
  readRecentThreads,
  rolloutExists,
};
