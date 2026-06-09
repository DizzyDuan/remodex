const assert = require("node:assert/strict");
const test = require("node:test");

const { createFileChangeWatcher } = require("../src/file-change-watcher");

test("file watcher debounces rapid changes", async () => {
  const fsImpl = createFakeWatchFs();
  let calls = 0;
  const watcher = createFileChangeWatcher({
    paths: {
      lastThread: "/tmp/last-thread.json",
      sessionIndex: "/tmp/session_index.jsonl",
      sessionsRoot: "/tmp/sessions",
    },
    debounceMs: 20,
    fsImpl,
    onChange: () => {
      calls += 1;
    },
  });

  watcher.start();
  fsImpl.emit("/tmp/last-thread.json");
  fsImpl.emit("/tmp/last-thread.json");
  fsImpl.emit("/tmp/session_index.jsonl");

  await delay(35);
  assert.equal(calls, 1);
  watcher.stop();
});

test("file watcher stops callbacks after stop", async () => {
  const fsImpl = createFakeWatchFs();
  let calls = 0;
  const watcher = createFileChangeWatcher({
    paths: { lastThread: "/tmp/last-thread.json" },
    debounceMs: 10,
    fsImpl,
    onChange: () => {
      calls += 1;
    },
  });

  watcher.start();
  watcher.stop();
  fsImpl.emit("/tmp/last-thread.json");

  await delay(20);
  assert.equal(calls, 0);
});

test("file watcher does not throw when fs.watch fails", () => {
  const watcher = createFileChangeWatcher({
    paths: { lastThread: "/tmp/missing.json" },
    fsImpl: {
      watch() {
        throw new Error("watch failed");
      },
    },
    onChange: () => {},
  });

  assert.doesNotThrow(() => watcher.start());
  assert.equal(watcher.status().watcherCount, 0);
  watcher.stop();
});

test("file watcher replaces watched rollout paths", () => {
  const fsImpl = createFakeWatchFs();
  const watcher = createFileChangeWatcher({
    paths: { lastThread: "/tmp/last-thread.json" },
    fsImpl,
    onChange: () => {},
  });

  watcher.start();
  watcher.updateRolloutPaths(["/tmp/a.jsonl", "/tmp/b.jsonl"]);
  assert.equal(fsImpl.activeWatchCount(), 3);
  assert.equal(fsImpl.isWatching("/tmp/a.jsonl"), true);
  assert.equal(fsImpl.isWatching("/tmp/b.jsonl"), true);

  watcher.updateRolloutPaths(["/tmp/b.jsonl", "/tmp/c.jsonl"]);
  assert.equal(fsImpl.activeWatchCount(), 3);
  assert.equal(fsImpl.isWatching("/tmp/a.jsonl"), false);
  assert.equal(fsImpl.isWatching("/tmp/b.jsonl"), true);
  assert.equal(fsImpl.isWatching("/tmp/c.jsonl"), true);
  watcher.stop();
});

test("file watcher uses 100ms default debounce", () => {
  const watcher = createFileChangeWatcher({
    paths: {},
    fsImpl: createFakeWatchFs(),
    onChange: () => {},
  });

  assert.equal(watcher.status().debounceMs, 100);
});

function createFakeWatchFs() {
  const watchers = new Map();

  return {
    watch(filePath, callback) {
      const entries = watchers.get(filePath) || [];
      const handle = {
        closed: false,
        close() {
          this.closed = true;
        },
      };
      entries.push({ callback, handle });
      watchers.set(filePath, entries);
      return handle;
    },
    emit(filePath) {
      for (const entry of watchers.get(filePath) || []) {
        if (!entry.handle.closed) {
          entry.callback("change", filePath);
        }
      }
    },
    activeWatchCount() {
      let count = 0;
      for (const entries of watchers.values()) {
        count += entries.filter((entry) => !entry.handle.closed).length;
      }
      return count;
    },
    isWatching(filePath) {
      return (watchers.get(filePath) || []).some((entry) => !entry.handle.closed);
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
