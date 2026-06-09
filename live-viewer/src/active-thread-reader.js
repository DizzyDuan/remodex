const fs = require("node:fs");

function readActiveThread(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      threadId: typeof parsed.threadId === "string" ? parsed.threadId : "",
      title: firstString(parsed.title, parsed.threadTitle, parsed.conversationTitle, parsed.name),
      source: firstString(parsed.source),
      updatedAt: firstString(parsed.updatedAt),
      updatedAtMs: parseTime(parsed.updatedAt),
    };
  } catch {
    return { threadId: "", title: "", source: "", updatedAt: "", updatedAtMs: 0 };
  }
}

function firstString(...values) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return value ? value.trim() : "";
}

function parseTime(value) {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

module.exports = {
  readActiveThread,
};
