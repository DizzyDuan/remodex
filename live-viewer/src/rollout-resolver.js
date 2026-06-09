const fs = require("node:fs");
const path = require("node:path");

function findRolloutFileForThread(sessionsRoot, threadId) {
  if (!sessionsRoot || !threadId || !fs.existsSync(sessionsRoot)) {
    return null;
  }

  const matches = [];
  walk(sessionsRoot, (filePath, dirent) => {
    if (
      dirent.isFile()
      && dirent.name.startsWith("rollout-")
      && dirent.name.endsWith(".jsonl")
      && dirent.name.includes(threadId)
    ) {
      const stat = fs.statSync(filePath);
      matches.push({ filePath, mtimeMs: stat.mtimeMs });
    }
  });

  matches.sort((a, b) => b.mtimeMs - a.mtimeMs || b.filePath.localeCompare(a.filePath));
  return matches[0]?.filePath || null;
}

function findRecentRolloutFiles(sessionsRoot, { limit = 10 } = {}) {
  if (!sessionsRoot || !fs.existsSync(sessionsRoot)) {
    return [];
  }

  const latestByThread = new Map();
  walk(sessionsRoot, (filePath, dirent) => {
    if (!isRolloutFileName(dirent.name)) {
      return;
    }

    const threadId = extractThreadIdFromRolloutName(dirent.name);
    if (!threadId) {
      return;
    }

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return;
    }

    const candidate = { threadId, filePath, mtimeMs: stat.mtimeMs };
    const existing = latestByThread.get(threadId);
    if (!existing || compareRollouts(candidate, existing) < 0) {
      latestByThread.set(threadId, candidate);
    }
  });

  return Array.from(latestByThread.values())
    .sort(compareRollouts)
    .slice(0, Math.max(0, limit));
}

function extractThreadIdFromRolloutName(fileName) {
  const match = /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.jsonl$/.exec(fileName || "");
  return match?.[1] || "";
}

function isRolloutFileName(fileName) {
  return fileName.startsWith("rollout-") && fileName.endsWith(".jsonl");
}

function compareRollouts(a, b) {
  return b.mtimeMs - a.mtimeMs || a.filePath.localeCompare(b.filePath);
}

function walk(root, visit) {
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visit);
    } else {
      visit(fullPath, entry);
    }
  }
}

module.exports = {
  extractThreadIdFromRolloutName,
  findRecentRolloutFiles,
  findRolloutFileForThread,
};
