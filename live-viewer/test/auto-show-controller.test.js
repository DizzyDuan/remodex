const assert = require("node:assert/strict");
const test = require("node:test");

const { shouldAutoShowForSession } = require("../src/auto-show-controller");

test("auto show triggers for fresh phone activity", () => {
  assert.equal(shouldAutoShowForSession({
    state: {
      activeSource: "phone",
      activeUpdatedAtMs: 2000,
      threadId: "thread-1",
    },
    config: {
      autoShow: {
        mode: "on-phone-request",
        cooldownMs: 1500,
        respectManualHideMs: 0,
      },
    },
    startedAtMs: 1000,
    lastAutoShowAtMs: 0,
    lastAutoShowActivityKey: "",
    lastManualHideAtMs: 0,
    nowMs: 2100,
  }), true);
});

test("auto show ignores codex activity, stale activity, and cooldown", () => {
  const base = {
    config: {
      autoShow: {
        mode: "on-phone-request",
        cooldownMs: 1500,
        respectManualHideMs: 0,
      },
    },
    startedAtMs: 1000,
    lastAutoShowAtMs: 0,
    lastAutoShowActivityKey: "",
    lastManualHideAtMs: 0,
    nowMs: 2100,
  };

  assert.equal(shouldAutoShowForSession({
    ...base,
    state: { activeSource: "codex", activeUpdatedAtMs: 2000, threadId: "thread-1" },
  }), false);
  assert.equal(shouldAutoShowForSession({
    ...base,
    state: { activeSource: "phone", activeUpdatedAtMs: 900, threadId: "thread-1" },
  }), false);
  assert.equal(shouldAutoShowForSession({
    ...base,
    state: { activeSource: "phone", activeUpdatedAtMs: 2000, threadId: "thread-1" },
    lastAutoShowAtMs: 1000,
    nowMs: 2000,
  }), false);
});

test("auto show ignores an already shown phone activity", () => {
  assert.equal(shouldAutoShowForSession({
    state: {
      activeSource: "phone",
      activeUpdatedAtMs: 2000,
      threadId: "thread-1",
    },
    config: {
      autoShow: {
        mode: "on-phone-request",
        cooldownMs: 1500,
        respectManualHideMs: 0,
      },
    },
    startedAtMs: 1000,
    lastAutoShowAtMs: 0,
    lastAutoShowActivityKey: "thread-1:2000",
    lastManualHideAtMs: 0,
    nowMs: 3000,
  }), false);
});

test("auto show can be disabled or delayed after manual hide", () => {
  const state = {
    activeSource: "phone",
    activeUpdatedAtMs: 2000,
    threadId: "thread-1",
  };

  assert.equal(shouldAutoShowForSession({
    state,
    config: {
      autoShow: {
        mode: "manual",
        cooldownMs: 1500,
        respectManualHideMs: 0,
      },
    },
    startedAtMs: 1000,
    lastAutoShowAtMs: 0,
    lastAutoShowActivityKey: "",
    lastManualHideAtMs: 0,
    nowMs: 2100,
  }), false);

  assert.equal(shouldAutoShowForSession({
    state,
    config: {
      autoShow: {
        mode: "on-phone-request",
        cooldownMs: 1500,
        respectManualHideMs: 60000,
      },
    },
    startedAtMs: 1000,
    lastAutoShowAtMs: 0,
    lastAutoShowActivityKey: "",
    lastManualHideAtMs: 2050,
    nowMs: 2100,
  }), false);
});
