const assert = require("node:assert/strict");
const test = require("node:test");

const { createWindowStartController } = require("../src/window-start-controller");

function createHarness() {
  const windows = [];
  const rendererEvents = [];
  const controller = createWindowStartController({
    config: {
      autoShow: {
        mode: "on-phone-request",
        cooldownMs: 1500,
        respectManualHideMs: 0,
      },
    },
    startedAtMs: 1000,
    now: () => 2100,
    createWindow: () => {
      const window = {
        shown: 0,
        hidden: 0,
        destroyed: false,
        webContents: {
          send(channel, payload) {
            rendererEvents.push({ channel, payload });
          },
        },
        isDestroyed() {
          return this.destroyed;
        },
        showInactive() {
          this.shown += 1;
        },
        hide() {
          this.hidden += 1;
        },
      };
      windows.push(window);
      return window;
    },
  });

  return { controller, windows, rendererEvents };
}

test("precreateWindow creates a hidden window immediately", () => {
  const windows = [];

  createWindowStartController({
    config: {
      autoShow: {
        mode: "on-phone-request",
        cooldownMs: 1500,
        respectManualHideMs: 0,
      },
    },
    startedAtMs: 1000,
    precreateWindow: true,
    createWindow: () => {
      const window = {
        shown: 0,
        hidden: 0,
        destroyed: false,
        webContents: { send() {} },
        isDestroyed() {
          return this.destroyed;
        },
        showInactive() {
          this.shown += 1;
        },
        hide() {
          this.hidden += 1;
        },
      };
      windows.push(window);
      return window;
    },
  });

  assert.equal(windows.length, 1);
  assert.equal(windows[0].shown, 0);
});

test("phone session state shows the precreated window", () => {
  const { controller, windows, rendererEvents } = createHarness();

  controller.ensureWindow();
  controller.handleSessionState({
    threadId: "thread-phone",
    activeSource: "phone",
    activeUpdatedAtMs: 2000,
  });

  assert.equal(windows.length, 1);
  assert.equal(windows[0].shown, 1);
  assert.deepEqual(rendererEvents, [{
    channel: "viewer:session",
    payload: {
      threadId: "thread-phone",
      activeSource: "phone",
      activeUpdatedAtMs: 2000,
    },
  }]);
});

test("phone session state reuses an existing window", () => {
  const { controller, windows } = createHarness();
  const firstState = {
    threadId: "thread-phone",
    activeSource: "phone",
    activeUpdatedAtMs: 2000,
  };

  controller.handleSessionState(firstState);
  controller.showExistingWindow();

  assert.equal(windows.length, 1);
  assert.equal(windows[0].shown, 2);
});

test("new phone activity does not create a duplicate window", () => {
  const { controller, windows } = createHarness();

  controller.ensureWindow();
  controller.handleSessionState({
    threadId: "thread-phone",
    activeSource: "phone",
    activeUpdatedAtMs: 2000,
  });
  controller.handleSessionState({
    threadId: "thread-phone",
    activeSource: "phone",
    activeUpdatedAtMs: 2100,
  });

  assert.equal(windows.length, 1);
});

test("codex app and cli session states do not show the precreated window", () => {
  for (const activeSource of ["codex", "cli"]) {
    const { controller, windows, rendererEvents } = createHarness();
    controller.ensureWindow();

    controller.handleSessionState({
      threadId: `thread-${activeSource}`,
      activeSource,
      activeUpdatedAtMs: 2000,
    });

    assert.equal(windows.length, 1);
    assert.equal(windows[0].shown, 0);
    assert.deepEqual(rendererEvents, [{
      channel: "viewer:session",
      payload: {
        threadId: `thread-${activeSource}`,
        activeSource,
        activeUpdatedAtMs: 2000,
      },
    }]);
  }
});
