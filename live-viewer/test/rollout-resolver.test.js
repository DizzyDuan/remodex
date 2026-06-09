const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  extractThreadIdFromRolloutName,
  findRecentRolloutFiles,
  findRolloutFileForThread,
} = require("../src/rollout-resolver");

test("finds the newest matching rollout file recursively", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-rollout-"));
  const threadId = "019e91d6-a69b-76d1-b91e-3a75ffd41d75";
  const olderDir = path.join(root, "2026", "06", "03");
  const newerDir = path.join(root, "2026", "06", "04");
  fs.mkdirSync(olderDir, { recursive: true });
  fs.mkdirSync(newerDir, { recursive: true });

  const older = path.join(olderDir, `rollout-2026-06-03T10-00-00-${threadId}.jsonl`);
  const newer = path.join(newerDir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  fs.writeFileSync(older, "{}\n");
  fs.writeFileSync(newer, "{}\n");
  fs.utimesSync(older, new Date("2026-06-03T10:00:00Z"), new Date("2026-06-03T10:00:00Z"));
  fs.utimesSync(newer, new Date("2026-06-04T10:00:00Z"), new Date("2026-06-04T10:00:00Z"));

  assert.equal(findRolloutFileForThread(root, threadId), newer);
});

test("returns null when no rollout file matches the thread", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-rollout-empty-"));
  fs.mkdirSync(path.join(root, "2026", "06", "04"), { recursive: true });
  fs.writeFileSync(path.join(root, "2026", "06", "04", "rollout-other.jsonl"), "{}\n");

  assert.equal(findRolloutFileForThread(root, "missing-thread"), null);
});

test("extracts thread id from rollout file names", () => {
  assert.equal(
    extractThreadIdFromRolloutName("rollout-2026-06-04T10-00-00-thread-a.jsonl"),
    "thread-a"
  );
  assert.equal(extractThreadIdFromRolloutName("rollout-other.jsonl"), "");
  assert.equal(extractThreadIdFromRolloutName("session-2026-06-04T10-00-00-thread-a.jsonl"), "");
});

test("finds the latest 10 unique rollout files by mtime", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-rollout-recent-"));
  const dayDir = path.join(root, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  fs.writeFileSync(path.join(dayDir, "not-rollout.jsonl"), "{}\n");
  fs.writeFileSync(path.join(dayDir, "rollout-other.jsonl"), "{}\n");

  for (let index = 0; index < 12; index += 1) {
    const threadId = `thread-${index}`;
    const filePath = path.join(dayDir, `rollout-2026-06-04T10-${String(index).padStart(2, "0")}-00-${threadId}.jsonl`);
    const time = new Date(Date.UTC(2026, 5, 4, 10, index));
    fs.writeFileSync(filePath, "{}\n");
    fs.utimesSync(filePath, time, time);
  }

  const olderDuplicate = path.join(dayDir, "rollout-2026-06-04T09-00-00-thread-11.jsonl");
  fs.writeFileSync(olderDuplicate, "{}\n");
  fs.utimesSync(olderDuplicate, new Date("2026-06-04T09:00:00Z"), new Date("2026-06-04T09:00:00Z"));

  const recent = findRecentRolloutFiles(root, { limit: 10 });

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
  assert.match(recent[0].filePath, /10-11-00-thread-11\.jsonl$/);
});
