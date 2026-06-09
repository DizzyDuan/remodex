const assert = require("node:assert/strict");
const test = require("node:test");

const { parseArgs, runCli } = require("../bin/live-viewer");

test("parseArgs defaults to status and supports json output", () => {
  assert.deepEqual(parseArgs([]), {
    command: "status",
    jsonOutput: false,
  });
  assert.deepEqual(parseArgs(["install", "--json"]), {
    command: "install",
    jsonOutput: true,
  });
});

test("runCli dispatches install and show commands", async () => {
  const calls = [];
  const messages = [];

  await runCli({
    argv: ["node", "live-viewer", "install"],
    consoleImpl: {
      log(message) {
        messages.push(message);
      },
    },
    deps: {
      installService() {
        calls.push("install");
        return { plistPath: "/tmp/live-viewer.plist" };
      },
    },
  });

  await runCli({
    argv: ["node", "live-viewer", "show"],
    consoleImpl: {
      log(message) {
        messages.push(message);
      },
    },
    deps: {
      showWindow() {
        calls.push("show");
      },
    },
  });

  assert.deepEqual(calls, ["install", "show"]);
  assert.deepEqual(messages, [
    "[live-viewer] Installed.",
    "[live-viewer] Window shown.",
  ]);
});

test("runCli dispatches status printer by default", async () => {
  const calls = [];

  await runCli({
    argv: ["node", "live-viewer"],
    consoleImpl: {
      log() {},
    },
    deps: {
      printStatus() {
        calls.push("status");
      },
    },
  });

  assert.deepEqual(calls, ["status"]);
});
