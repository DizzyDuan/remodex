const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readRecentSessionIndex } = require("../src/session-index-reader");

test("reads recent unique sessions by Codex index updated_at", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-session-index-"));
  const indexPath = path.join(dir, "session_index.jsonl");
  fs.writeFileSync(indexPath, [
    JSON.stringify({ id: "thread-a", thread_name: "Old A", updated_at: "2026-06-04T10:00:00Z" }),
    JSON.stringify({ id: "thread-b", thread_name: "Thread B", updated_at: "2026-06-04T10:02:00Z" }),
    "{bad json",
    JSON.stringify({ id: "thread-a", thread_name: "New A", updated_at: "2026-06-04T10:03:00Z" }),
    JSON.stringify({ id: "", thread_name: "Missing", updated_at: "2026-06-04T10:04:00Z" }),
  ].join("\n") + "\n");

  assert.deepEqual(readRecentSessionIndex(indexPath, { limit: 10 }), [
    {
      threadId: "thread-a",
      title: "New A",
      updatedAt: "2026-06-04T10:03:00Z",
      updatedAtMs: Date.parse("2026-06-04T10:03:00Z"),
    },
    {
      threadId: "thread-b",
      title: "Thread B",
      updatedAt: "2026-06-04T10:02:00Z",
      updatedAtMs: Date.parse("2026-06-04T10:02:00Z"),
    },
  ]);
});

test("limits recent sessions to the requested count", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-session-index-limit-"));
  const indexPath = path.join(dir, "session_index.jsonl");
  const lines = [];
  for (let index = 0; index < 12; index += 1) {
    lines.push(JSON.stringify({
      id: `thread-${index}`,
      thread_name: `Thread ${index}`,
      updated_at: new Date(Date.UTC(2026, 5, 4, 10, index)).toISOString(),
    }));
  }
  fs.writeFileSync(indexPath, `${lines.join("\n")}\n`);

  const recent = readRecentSessionIndex(indexPath, { limit: 10 });

  assert.equal(recent.length, 10);
  assert.deepEqual(recent.map((item) => item.threadId), [
    "thread-11",
    "thread-10",
    "thread-9",
    "thread-8",
    "thread-7",
    "thread-6",
    "thread-5",
    "thread-4",
    "thread-3",
    "thread-2",
  ]);
});

test("returns an empty list when session index is missing", () => {
  assert.deepEqual(readRecentSessionIndex("/missing/session_index.jsonl"), []);
});
