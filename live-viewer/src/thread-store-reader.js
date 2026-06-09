const { execFileSync: defaultExecFileSync } = require("node:child_process");

function readRecentThreadStore(filePath, {
  limit = 10,
  execFileSync = defaultExecFileSync,
} = {}) {
  if (!filePath) {
    return [];
  }

  const safeLimit = Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : 10);
  const sql = `
    SELECT id, title, preview, first_user_message, rollout_path, updated_at_ms
    FROM threads
    WHERE archived = 0 AND rollout_path != ''
    ORDER BY updated_at_ms DESC, id DESC
    LIMIT ${safeLimit}
  `;

  let output;
  try {
    output = execFileSync("sqlite3", ["-json", filePath, sql], { encoding: "utf8" });
  } catch {
    return [];
  }

  let rows;
  try {
    rows = JSON.parse(String(output || "[]"));
  } catch {
    return [];
  }

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map(normalizeThreadRow).filter(Boolean);
}

function normalizeThreadRow(row) {
  const threadId = typeof row?.id === "string" ? row.id.trim() : "";
  const rolloutPath = typeof row?.rollout_path === "string" ? row.rollout_path.trim() : "";
  const updatedAtMs = Number(row?.updated_at_ms);
  if (!threadId || !rolloutPath || !Number.isFinite(updatedAtMs)) {
    return null;
  }

  return {
    threadId,
    title: stringField(row.title),
    preview: stringField(row.preview),
    firstUserMessage: stringField(row.first_user_message),
    rolloutPath,
    updatedAtMs,
  };
}

function stringField(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = {
  normalizeThreadRow,
  readRecentThreadStore,
};
