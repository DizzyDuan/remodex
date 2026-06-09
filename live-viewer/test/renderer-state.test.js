const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "renderer-state.js"), "utf8");

function loadStateHelpers() {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.RemodexLiveViewerState;
}

test("thread controls are hidden when there are no discovered threads", () => {
  const helpers = loadStateHelpers();

  assert.equal(helpers.shouldShowThreadControls(helpers.emptySession()), false);
  assert.equal(helpers.shouldShowThreadControls({ threads: [] }), false);
});

test("thread controls are shown when discovered threads exist", () => {
  const helpers = loadStateHelpers();

  assert.equal(helpers.shouldShowThreadControls({
    threads: [{ threadId: "thread-a", items: [] }],
  }), true);
});

test("tabsSignature changes only when tab-visible state changes", () => {
  const helpers = loadStateHelpers();
  const threads = [
    { threadId: "thread-a", title: "A", status: "live", taskStatus: "idle" },
    { threadId: "thread-b", title: "B", status: "stale", taskStatus: "running" },
  ];

  const first = helpers.tabsSignature(threads, "thread-a", "thread-b");

  assert.equal(helpers.tabsSignature(threads, "thread-a", "thread-b"), first);
  assert.notEqual(helpers.tabsSignature(threads, "thread-b", "thread-b"), first);
  assert.notEqual(helpers.tabsSignature([
    { threadId: "thread-a", title: "Renamed", status: "live", taskStatus: "idle" },
    threads[1],
  ], "thread-a", "thread-b"), first);
});

test("auto selection uses latest thread immediately on first sync", () => {
  const helpers = loadStateHelpers();
  const state = {
    ...helpers.emptyRendererState(),
    session: {
      ...helpers.emptySession(),
      latestThreadId: "thread-b",
      threads: [{ threadId: "thread-a" }, { threadId: "thread-b" }],
    },
  };
  const threadById = threadFinder(state);

  helpers.syncAutoSelection(state, { now: 1000, threadById });

  assert.equal(helpers.activeThreadId(state, threadById), "thread-b");
});

test("auto selection debounces latest thread changes", () => {
  const helpers = loadStateHelpers();
  const state = {
    ...helpers.emptyRendererState(),
    autoSelectedThreadId: "thread-a",
    session: {
      ...helpers.emptySession(),
      latestThreadId: "thread-b",
      threads: [{ threadId: "thread-a" }, { threadId: "thread-b" }],
    },
  };
  const threadById = threadFinder(state);

  helpers.syncAutoSelection(state, { now: 1000, threadById });
  assert.equal(helpers.activeThreadId(state, threadById), "thread-a");

  helpers.syncAutoSelection(state, { now: 2100, threadById });
  assert.equal(helpers.activeThreadId(state, threadById), "thread-a");

  helpers.syncAutoSelection(state, { now: 2200, threadById });
  assert.equal(helpers.activeThreadId(state, threadById), "thread-b");
});

test("locked selection does not auto switch to latest thread", () => {
  const helpers = loadStateHelpers();
  const state = {
    ...helpers.emptyRendererState(),
    selectionMode: "locked",
    selectedThreadId: "thread-a",
    autoSelectedThreadId: "thread-a",
    session: {
      ...helpers.emptySession(),
      latestThreadId: "thread-b",
      threads: [{ threadId: "thread-a" }, { threadId: "thread-b" }],
    },
  };
  const threadById = threadFinder(state);

  helpers.syncAutoSelection(state, { now: 5000, threadById });

  assert.equal(helpers.activeThreadId(state, threadById), "thread-a");
  assert.equal(state.selectionMode, "locked");
});

test("locked selection falls back to latest when selected thread disappears", () => {
  const helpers = loadStateHelpers();
  const state = {
    ...helpers.emptyRendererState(),
    selectionMode: "locked",
    selectedThreadId: "thread-a",
    autoSelectedThreadId: "thread-a",
    session: {
      ...helpers.emptySession(),
      latestThreadId: "thread-b",
      threads: [{ threadId: "thread-b" }],
    },
  };
  const threadById = threadFinder(state);

  helpers.syncAutoSelection(state, { now: 5000, threadById });

  assert.equal(helpers.activeThreadId(state, threadById), "thread-b");
  assert.equal(state.selectionMode, "auto");
});

function threadFinder(state) {
  return (threadId) => state.session.threads.find((thread) => thread.threadId === threadId);
}
