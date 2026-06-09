const assert = require("node:assert/strict");
const test = require("node:test");

const { readRecentThreadStore } = require("../src/thread-store-reader");

test("reads recent non-archived threads from Codex state database output", () => {
  const calls = [];
  const rows = [
    {
      id: "thread-b",
      title: "State B",
      preview: "Preview B",
      first_user_message: "First B",
      rollout_path: "/tmp/thread-b.jsonl",
      updated_at_ms: 2000,
    },
    {
      id: "thread-a",
      title: "State A",
      preview: "Preview A",
      first_user_message: "First A",
      rollout_path: "/tmp/thread-a.jsonl",
      updated_at_ms: 1000,
    },
  ];

  const threads = readRecentThreadStore("/tmp/state.sqlite", {
    limit: 2,
    execFileSync: (command, args) => {
      calls.push([command, args]);
      return Buffer.from(JSON.stringify(rows));
    },
  });

  assert.equal(calls[0][0], "sqlite3");
  assert.equal(calls[0][1][0], "-json");
  assert.equal(calls[0][1][1], "/tmp/state.sqlite");
  assert.deepEqual(threads, [
    {
      threadId: "thread-b",
      title: "State B",
      preview: "Preview B",
      firstUserMessage: "First B",
      rolloutPath: "/tmp/thread-b.jsonl",
      updatedAtMs: 2000,
    },
    {
      threadId: "thread-a",
      title: "State A",
      preview: "Preview A",
      firstUserMessage: "First A",
      rolloutPath: "/tmp/thread-a.jsonl",
      updatedAtMs: 1000,
    },
  ]);
});

test("ignores malformed rows and returns empty on sqlite failure", () => {
  const rows = [
    { id: "", title: "missing id", rollout_path: "/tmp/a.jsonl", updated_at_ms: 1000 },
    { id: "missing-rollout", title: "missing rollout", rollout_path: "", updated_at_ms: 1000 },
    { id: "bad-time", title: "bad time", rollout_path: "/tmp/b.jsonl", updated_at_ms: "nope" },
    { id: "ok", title: "", preview: "Preview", rollout_path: "/tmp/ok.jsonl", updated_at_ms: 500 },
  ];

  assert.deepEqual(readRecentThreadStore("/tmp/state.sqlite", {
    execFileSync: () => Buffer.from(JSON.stringify(rows)),
  }), [
    {
      threadId: "ok",
      title: "",
      preview: "Preview",
      firstUserMessage: "",
      rolloutPath: "/tmp/ok.jsonl",
      updatedAtMs: 500,
    },
  ]);

  assert.deepEqual(readRecentThreadStore("/tmp/state.sqlite", {
    execFileSync: () => {
      throw new Error("sqlite unavailable");
    },
  }), []);
});
