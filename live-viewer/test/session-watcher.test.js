const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createSessionWatcher,
  readActiveThread,
  titleFromCwd,
  titleFromItems,
  itemKey,
  updateMetadataFromEvent,
} = require("../src/session-watcher");

test("readActiveThread returns thread id, explicit local title, source, and updatedAt", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-thread-"));
  const filePath = path.join(dir, "last-thread.json");
  fs.writeFileSync(filePath, JSON.stringify({
    threadId: "thread-1",
    title: "Fix live viewer",
    source: "phone",
    updatedAt: "2026-06-09T09:00:00.000Z",
  }));

  assert.deepEqual(readActiveThread(filePath), {
    threadId: "thread-1",
    title: "Fix live viewer",
    source: "phone",
    updatedAt: "2026-06-09T09:00:00.000Z",
    updatedAtMs: Date.parse("2026-06-09T09:00:00.000Z"),
  });
});

test("session watcher treats codex activity from a mobile-originated rollout as phone activity", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-mobile-origin-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "09");
  const threadId = "thread-mobile-origin";
  fs.mkdirSync(dayDir, { recursive: true });
  fs.writeFileSync(lastThread, JSON.stringify({
    threadId,
    source: "codex",
    updatedAt: "2026-06-09T09:00:00.000Z",
  }));
  fs.writeFileSync(path.join(dayDir, `rollout-2026-06-09T09-00-00-${threadId}.jsonl`), [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
        originator: "codexmobile_ios",
        source: "vscode",
      },
    }),
    JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "From phone" } }),
  ].join("\n") + "\n");

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionsRoot },
    },
    now: () => Date.parse("2026-06-09T09:00:01.000Z"),
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.threadId, threadId);
  assert.equal(state.activeSource, "phone");
  assert.equal(state.activeUpdatedAt, "2026-06-09T09:00:00.000Z");
});

test("metadata helpers derive fallback title and task status", () => {
  assert.equal(titleFromCwd("/Users/dizzy/Project/remodex/live-viewer"), "live viewer");
  assert.equal(titleFromItems([
    { role: "assistant", text: "ignored" },
    { role: "user", text: "  当前窗口无法拖动\n请修复  " },
  ]), "当前窗口无法拖动 请修复");

  assert.deepEqual(updateMetadataFromEvent({
    type: "session_meta",
    payload: { cwd: "/Users/dizzy/Project/remodex/live-viewer" },
  }), {
    title: "",
    fallbackTitle: "live viewer",
    taskStatus: null,
  });

  assert.deepEqual(updateMetadataFromEvent({
    type: "event_msg",
    payload: { type: "task_started" },
  }), {
    title: "",
    fallbackTitle: "",
    taskStatus: "running",
  });

  assert.deepEqual(updateMetadataFromEvent({
    type: "response_item",
    payload: { type: "function_call", name: "exec_command" },
  }), {
    title: "",
    fallbackTitle: "",
    taskStatus: null,
  });
});

test("itemKey deduplicates mirrored event and response messages", () => {
  assert.equal(
    itemKey({ role: "assistant", kind: "message", text: "done" }),
    itemKey({ role: "assistant", kind: "message", text: "done" })
  );
});

test("session watcher ignores historical lifecycle status from initial snapshot", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-session-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  const threadId = "thread-2";
  fs.mkdirSync(dayDir, { recursive: true });
  fs.writeFileSync(lastThread, JSON.stringify({ threadId }));
  fs.writeFileSync(path.join(dayDir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`), [
    JSON.stringify({ type: "session_meta", payload: { cwd: "/Users/dizzy/Project/remodex/live-viewer" } }),
    JSON.stringify({ type: "event_msg", payload: { type: "task_started" } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>\n</environment_context>" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "窗口无法拖动" }] } }),
    JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "窗口无法拖动" } }),
    JSON.stringify({ type: "response_item", payload: { type: "function_call", name: "exec_command", arguments: "{}" } }),
  ].join("\n") + "\n");

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionsRoot },
    },
    now: () => 1000,
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.status, "live");
  assert.equal(state.threadId, threadId);
  assert.equal(state.title, "窗口无法拖动");
  assert.equal(state.taskStatus, "idle");
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].role, "user");
  assert.equal(state.items.some((item) => item.role === "tool"), false);
});

test("session watcher updates task status only from newly appended lifecycle events", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-live-lifecycle-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  const threadId = "thread-live";
  fs.mkdirSync(dayDir, { recursive: true });
  fs.writeFileSync(lastThread, JSON.stringify({ threadId }));
  const rolloutPath = path.join(dayDir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: "event_msg", payload: { type: "task_started" } }),
    JSON.stringify({ type: "event_msg", payload: { type: "task_complete" } }),
    JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "Initial" } }),
  ].join("\n") + "\n");

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionsRoot },
    },
    now: () => 1000,
    onState: (state) => states.push(state),
  });

  watcher.tick();
  assert.equal(states.at(-1).taskStatus, "idle");

  fs.appendFileSync(rolloutPath, `${JSON.stringify({ type: "event_msg", payload: { type: "task_started" } })}\n`);
  watcher.tick();
  assert.equal(states.at(-1).taskStatus, "running");

  fs.appendFileSync(rolloutPath, `${JSON.stringify({ type: "event_msg", payload: { type: "task_complete" } })}\n`);
  watcher.tick();
  assert.equal(states.at(-1).taskStatus, "complete");
});

test("session watcher keeps multiple active threads and reports the latest thread hint", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-multi-session-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  const threadA = "thread-a";
  const threadB = "thread-b";
  const rolloutA = path.join(dayDir, `rollout-2026-06-04T10-00-00-${threadA}.jsonl`);
  const rolloutB = path.join(dayDir, `rollout-2026-06-04T10-01-00-${threadB}.jsonl`);
  fs.writeFileSync(rolloutA, `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "A first" } })}\n`);
  fs.writeFileSync(rolloutB, `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "B first" } })}\n`);

  let clock = 1000;
  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionsRoot },
    },
    now: () => clock,
    onState: (state) => states.push(state),
  });

  fs.writeFileSync(lastThread, JSON.stringify({ threadId: threadA, title: "Thread A" }));
  watcher.tick();
  clock += 500;
  fs.writeFileSync(lastThread, JSON.stringify({ threadId: threadB, title: "Thread B" }));
  watcher.tick();
  clock += 500;
  fs.appendFileSync(rolloutA, `${JSON.stringify({ type: "event_msg", payload: { type: "agent_message", message: "A second" } })}\n`);
  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.latestThreadId, threadA);
  assert.equal(state.threads.length, 2);
  assert.deepEqual(
    state.threads.map((thread) => thread.threadId).sort(),
    [threadA, threadB]
  );
  assert.equal(state.threads.find((thread) => thread.threadId === threadA).items.length, 2);
  assert.equal(state.threads.find((thread) => thread.threadId === threadB).items.length, 1);
});

test("session watcher syncs recent threads without last-thread.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-recent-session-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  const threadA = "thread-a";
  const threadB = "thread-b";
  const rolloutA = writeRollout(dayDir, "2026-06-04T10-00-00", threadA, "A first");
  const rolloutB = writeRollout(dayDir, "2026-06-04T10-01-00", threadB, "B first");
  setMtime(rolloutA, "2026-06-04T10:00:00Z");
  setMtime(rolloutB, "2026-06-04T10:01:00Z");

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionsRoot },
    },
    now: () => Date.parse("2026-06-04T10:01:03Z"),
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.status, "live");
  assert.equal(state.latestThreadId, threadB);
  assert.equal(state.threadId, threadB);
  assert.deepEqual(state.threads.map((thread) => thread.threadId), [threadB, threadA]);
  assert.equal(state.threads.find((thread) => thread.threadId === threadA).items[0].text, "A first");
  assert.equal(state.threads.find((thread) => thread.threadId === threadB).items[0].text, "B first");
});

test("session watcher prefers Codex session index for thread order and titles", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-index-session-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionIndex = path.join(dir, "session_index.jsonl");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  const threadA = "thread-a";
  const threadB = "thread-b";
  const rolloutA = writeRollout(dayDir, "2026-06-04T10-00-00", threadA, "A first");
  const rolloutB = writeRollout(dayDir, "2026-06-04T10-01-00", threadB, "B first");
  setMtime(rolloutA, "2026-06-04T10:10:00Z");
  setMtime(rolloutB, "2026-06-04T10:01:00Z");
  fs.writeFileSync(sessionIndex, [
    JSON.stringify({ id: threadA, thread_name: "Old Codex A", updated_at: "2026-06-04T10:00:00Z" }),
    JSON.stringify({ id: threadB, thread_name: "Codex B", updated_at: "2026-06-04T10:02:00Z" }),
    JSON.stringify({ id: threadA, thread_name: "Codex A", updated_at: "2026-06-04T10:03:00Z" }),
  ].join("\n") + "\n");

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionIndex, sessionsRoot },
    },
    readThreadStore: () => [
      {
        threadId: threadA,
        title: "State A",
        preview: "A first",
        firstUserMessage: "A first",
        rolloutPath: rolloutA,
        updatedAtMs: Date.parse("2026-06-04T10:03:00Z"),
      },
      {
        threadId: threadB,
        title: "State B",
        preview: "B first",
        firstUserMessage: "B first",
        rolloutPath: rolloutB,
        updatedAtMs: Date.parse("2026-06-04T10:02:00Z"),
      },
    ],
    now: () => Date.parse("2026-06-04T10:03:03Z"),
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.latestThreadId, threadA);
  assert.equal(state.threadId, threadA);
  assert.deepEqual(state.threads.map((thread) => [thread.threadId, thread.title]), [
    [threadA, "Codex A"],
    [threadB, "Codex B"],
  ]);
  assert.equal(state.threads.find((thread) => thread.threadId === threadA).items[0].text, "A first");
  assert.equal(state.threads.find((thread) => thread.threadId === threadB).items[0].text, "B first");
});

test("session index order is not changed by newer rollout mtime", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-index-sort-authority-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionIndex = path.join(dir, "session_index.jsonl");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  const threadA = "thread-a";
  const threadB = "thread-b";
  const rolloutA = writeRollout(dayDir, "2026-06-04T10-00-00", threadA, "A first");
  const rolloutB = writeRollout(dayDir, "2026-06-04T10-01-00", threadB, "B first");
  setMtime(rolloutA, "2026-06-04T10:10:00Z");
  setMtime(rolloutB, "2026-06-04T10:01:00Z");
  fs.writeFileSync(sessionIndex, [
    JSON.stringify({ id: threadA, thread_name: "Codex A", updated_at: "2026-06-04T10:00:00Z" }),
    JSON.stringify({ id: threadB, thread_name: "Codex B", updated_at: "2026-06-04T10:03:00Z" }),
  ].join("\n") + "\n");

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionIndex, sessionsRoot },
    },
    readThreadStore: () => [
      {
        threadId: threadB,
        title: "State B",
        preview: "B first",
        firstUserMessage: "B first",
        rolloutPath: rolloutB,
        updatedAtMs: Date.parse("2026-06-04T10:03:00Z"),
      },
      {
        threadId: threadA,
        title: "State A",
        preview: "A first",
        firstUserMessage: "A first",
        rolloutPath: rolloutA,
        updatedAtMs: Date.parse("2026-06-04T10:00:00Z"),
      },
    ],
    now: () => Date.parse("2026-06-04T10:03:03Z"),
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.latestThreadId, threadB);
  assert.equal(state.threadId, threadB);
  assert.deepEqual(state.threads.map((thread) => thread.threadId), [threadB, threadA]);
});

test("session index title is not overwritten by last-thread or rollout metadata", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-index-title-authority-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionIndex = path.join(dir, "session_index.jsonl");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  const threadId = "thread-a";
  const rolloutPath = path.join(dayDir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: "thread_meta", payload: { title: "Rollout title" } }),
    JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "A first" } }),
  ].join("\n") + "\n");
  setMtime(rolloutPath, "2026-06-04T10:00:00Z");
  fs.writeFileSync(sessionIndex, `${JSON.stringify({
    id: threadId,
    thread_name: "Codex title",
    updated_at: "2026-06-04T10:03:00Z",
  })}\n`);
  fs.writeFileSync(lastThread, JSON.stringify({ threadId, title: "Last thread title" }));

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionIndex, sessionsRoot },
    },
    readThreadStore: () => [
      {
        threadId,
        title: "State title",
        preview: "A first",
        firstUserMessage: "A first",
        rolloutPath,
        updatedAtMs: Date.parse("2026-06-04T10:03:00Z"),
      },
    ],
    now: () => Date.parse("2026-06-04T10:03:03Z"),
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.title, "Codex title");
  assert.equal(state.threads[0].title, "Codex title");
});

test("session watcher does not show index-only threads without thread store or rollout", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-index-empty-rollout-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionIndex = path.join(dir, "session_index.jsonl");
  const sessionsRoot = path.join(dir, "sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.writeFileSync(sessionIndex, `${JSON.stringify({
    id: "thread-a",
    thread_name: "Codex A",
    updated_at: "2026-06-04T10:03:00Z",
  })}\n`);

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionIndex, sessionsRoot },
    },
    readThreadStore: () => [],
    now: () => Date.parse("2026-06-04T10:03:03Z"),
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.latestThreadId, "");
  assert.equal(state.threadId, "");
  assert.deepEqual(state.threads, []);
});

test("session watcher filters thread-store rows whose rollout file is missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-missing-store-rollout-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionIndex = path.join(dir, "session_index.jsonl");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  const validRollout = writeRollout(dayDir, "2026-06-04T10-00-00", "thread-valid", "Valid first");
  const missingRollout = path.join(dayDir, "rollout-2026-06-04T10-01-00-thread-missing.jsonl");
  fs.writeFileSync(sessionIndex, [
    JSON.stringify({ id: "thread-missing", thread_name: "Missing", updated_at: "2026-06-04T10:03:00Z" }),
    JSON.stringify({ id: "thread-valid", thread_name: "Valid", updated_at: "2026-06-04T10:02:00Z" }),
  ].join("\n") + "\n");

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionIndex, sessionsRoot },
    },
    readThreadStore: () => [
      {
        threadId: "thread-missing",
        title: "Missing",
        preview: "Missing",
        firstUserMessage: "Missing",
        rolloutPath: missingRollout,
        updatedAtMs: Date.parse("2026-06-04T10:03:00Z"),
      },
      {
        threadId: "thread-valid",
        title: "Valid",
        preview: "Valid first",
        firstUserMessage: "Valid first",
        rolloutPath: validRollout,
        updatedAtMs: Date.parse("2026-06-04T10:02:00Z"),
      },
    ],
    now: () => Date.parse("2026-06-04T10:03:03Z"),
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.latestThreadId, "thread-valid");
  assert.deepEqual(state.threads.map((thread) => thread.threadId), ["thread-valid"]);
  assert.equal(state.threads[0].items[0].text, "Valid first");
});

test("session watcher emits an empty thread list when there are no rollouts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-empty-session-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionsRoot },
    },
    now: () => 1000,
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.status, "disconnected");
  assert.equal(state.latestThreadId, "");
  assert.equal(state.threadId, "");
  assert.deepEqual(state.threads, []);
});

test("last-thread updates a known thread title without clearing discovered threads", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-last-thread-hint-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  const threadA = "thread-a";
  const threadB = "thread-b";
  const rolloutA = writeRollout(dayDir, "2026-06-04T10-00-00", threadA, "A first");
  const rolloutB = writeRollout(dayDir, "2026-06-04T10-01-00", threadB, "B first");
  setMtime(rolloutA, "2026-06-04T10:00:00Z");
  setMtime(rolloutB, "2026-06-04T10:01:00Z");

  fs.writeFileSync(lastThread, JSON.stringify({ threadId: threadA, title: "Pinned A title" }));

  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionsRoot },
    },
    now: () => Date.parse("2026-06-04T10:01:30Z"),
    onState: (state) => states.push(state),
  });

  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.latestThreadId, threadB);
  assert.equal(state.threadId, threadB);
  assert.deepEqual(state.threads.map((thread) => thread.threadId), [threadB, threadA]);
  assert.equal(state.threads.find((thread) => thread.threadId === threadA).title, "Pinned A title");
});

test("switching tabs does not change thread follow state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-tab-follow-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });

  const threadA = "thread-a";
  const threadB = "thread-b";
  fs.writeFileSync(path.join(dayDir, `rollout-2026-06-04T10-00-00-${threadA}.jsonl`), `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "A first" } })}\n`);
  fs.writeFileSync(path.join(dayDir, `rollout-2026-06-04T10-01-00-${threadB}.jsonl`), `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "B first" } })}\n`);

  let clock = 1000;
  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 500,
      paths: { lastThread, sessionsRoot },
    },
    now: () => clock,
    onState: (state) => states.push(state),
  });

  fs.writeFileSync(lastThread, JSON.stringify({ threadId: threadA }));
  watcher.tick();
  clock += 500;
  fs.writeFileSync(lastThread, JSON.stringify({ threadId: threadB }));
  watcher.tick();
  clock += 500;
  fs.writeFileSync(lastThread, JSON.stringify({ threadId: threadA }));
  watcher.tick();

  const state = states.at(-1);
  assert.equal(state.threads.find((thread) => thread.threadId === threadA).items.length, 1);
  assert.equal(state.threads.find((thread) => thread.threadId === threadB).items.length, 1);
  assert.equal(state.latestThreadId, threadB);
});

test("session watcher starts file watcher and ticks on file changes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-watch-tick-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });

  let onChange = null;
  let startCount = 0;
  const states = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 2000,
      watch: { enabled: true, debounceMs: 100 },
      paths: { lastThread, sessionsRoot },
    },
    fileChangeWatcherFactory: ({ onChange: nextOnChange }) => {
      onChange = nextOnChange;
      return {
        start() {
          startCount += 1;
        },
        stop() {},
        updateRolloutPaths() {},
      };
    },
    now: () => 1000,
    onState: (state) => states.push(state),
  });

  watcher.start();
  const initialStateCount = states.length;
  onChange();

  assert.equal(startCount, 1);
  assert.equal(states.length, initialStateCount + 1);
  watcher.stop();
});

test("session watcher refreshes watched rollout paths after sync", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-watch-rollouts-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  const dayDir = path.join(sessionsRoot, "2026", "06", "04");
  fs.mkdirSync(dayDir, { recursive: true });
  const rolloutA = writeRollout(dayDir, "2026-06-04T10-00-00", "thread-a", "A");
  const rolloutB = writeRollout(dayDir, "2026-06-04T10-01-00", "thread-b", "B");

  const watched = [];
  const watcher = createSessionWatcher({
    config: {
      pollMs: 2000,
      watch: { enabled: true, debounceMs: 100 },
      paths: { lastThread, sessionsRoot },
    },
    fileChangeWatcherFactory: () => ({
      start() {},
      stop() {},
      updateRolloutPaths(paths) {
        watched.push(paths);
      },
    }),
    now: () => 1000,
    onState: () => {},
  });

  watcher.start();

  assert.deepEqual(watched.at(-1).sort(), [rolloutA, rolloutB].sort());
  watcher.stop();
});

test("session watcher does not create file watcher when disabled", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-watch-disabled-"));
  const lastThread = path.join(dir, "last-thread.json");
  const sessionsRoot = path.join(dir, "sessions");
  let factoryCalled = false;

  const watcher = createSessionWatcher({
    config: {
      pollMs: 2000,
      watch: { enabled: false, debounceMs: 100 },
      paths: { lastThread, sessionsRoot },
    },
    fileChangeWatcherFactory: () => {
      factoryCalled = true;
      return {
        start() {},
        stop() {},
        updateRolloutPaths() {},
      };
    },
    now: () => 1000,
    onState: () => {},
  });

  watcher.start();

  assert.equal(factoryCalled, false);
  watcher.stop();
});

function writeRollout(dayDir, timestamp, threadId, message) {
  const filePath = path.join(dayDir, `rollout-${timestamp}-${threadId}.jsonl`);
  fs.writeFileSync(filePath, `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message } })}\n`);
  return filePath;
}

function setMtime(filePath, isoTime) {
  const time = new Date(isoTime);
  fs.utimesSync(filePath, time, time);
}
