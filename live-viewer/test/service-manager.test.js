const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildLaunchAgentPlist,
  enableService,
  installService,
  resolveLaunchAgentPlistPath,
  showWindow,
  uninstallService,
} = require("../src/service-manager");

const TEST_UID = typeof process.getuid === "function" ? process.getuid() : 501;

test("buildLaunchAgentPlist starts npm in the live-viewer directory", () => {
  const plist = buildLaunchAgentPlist({
    homeDir: "/Users/tester",
    liveViewerRoot: "/Users/tester/remodex/live-viewer",
    pathEnv: "/usr/local/bin:/usr/bin",
    stdoutLogPath: "/Users/tester/.remodex/logs/live-viewer.stdout.log",
    stderrLogPath: "/Users/tester/.remodex/logs/live-viewer.stderr.log",
  });

  assert.match(plist, /<string>com\.remodex\.live-viewer<\/string>/);
  assert.match(plist, /<string>npm start<\/string>/);
  assert.match(plist, /<key>WorkingDirectory<\/key>\s*<string>\/Users\/tester\/remodex\/live-viewer<\/string>/);
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
});

test("resolveLaunchAgentPlistPath writes into the user's LaunchAgents folder", () => {
  assert.equal(
    resolveLaunchAgentPlistPath({
      env: { HOME: "/Users/tester" },
      osImpl: { homedir: () => "/Users/fallback" },
    }),
    path.join("/Users/tester", "Library", "LaunchAgents", "com.remodex.live-viewer.plist")
  );
});

test("installService installs dependencies and writes the LaunchAgent plist", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-install-"));
  const liveViewerRoot = path.join(root, "live-viewer");
  fs.mkdirSync(liveViewerRoot);
  fs.writeFileSync(path.join(liveViewerRoot, "package.json"), "{}");

  const calls = [];
  const result = installService({
    env: { HOME: root, PATH: "/usr/bin", UID: String(TEST_UID) },
    liveViewerRoot,
    execFileSyncImpl(command, args, options) {
      calls.push([command, args, options.cwd]);
    },
  });

  assert.deepEqual(calls, [["npm", ["install"], liveViewerRoot]]);
  assert.equal(result.liveViewerRoot, liveViewerRoot);
  assert.equal(fs.existsSync(result.plistPath), true);
});

test("enableService bootstraps and kickstarts the installed plist", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-enable-"));
  const liveViewerRoot = path.join(root, "live-viewer");
  fs.mkdirSync(liveViewerRoot);
  fs.writeFileSync(path.join(liveViewerRoot, "package.json"), "{}");

  const calls = [];
  const result = enableService({
    env: { HOME: root, PATH: "/usr/bin", UID: String(TEST_UID) },
    liveViewerRoot,
    execFileSyncImpl(command, args) {
      calls.push([command, args]);
      if (args[0] === "bootout") {
        const error = new Error("Could not find service");
        error.stderr = Buffer.from("Could not find service");
        throw error;
      }
    },
  });

  assert.equal(result.plistPath.endsWith("com.remodex.live-viewer.plist"), true);
  assert.deepEqual(calls.map(([command, args]) => [command, args[0]]), [
    ["launchctl", "bootout"],
    ["launchctl", "bootout"],
    ["launchctl", "bootstrap"],
    ["launchctl", "kickstart"],
  ]);
});

test("showWindow launches npm start with --show", () => {
  const spawned = [];
  showWindow({
    liveViewerRoot: "/tmp/live-viewer",
    spawnImpl(command, args, options) {
      spawned.push([command, args, options.cwd, options.detached]);
      return { unref() {} };
    },
  });

  assert.deepEqual(spawned, [[
    "npm",
    ["start", "--", "--show"],
    "/tmp/live-viewer",
    true,
  ]]);
});

test("uninstallService stops launchd and removes plist", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "remodex-live-viewer-uninstall-"));
  const plistPath = path.join(root, "Library", "LaunchAgents", "com.remodex.live-viewer.plist");
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, "plist");

  uninstallService({
    env: { HOME: root, PATH: "/usr/bin", UID: String(TEST_UID) },
    execFileSyncImpl(_command, args) {
      if (args[0] === "bootout") {
        const error = new Error("Could not find service");
        error.stderr = Buffer.from("Could not find service");
        throw error;
      }
    },
  });

  assert.equal(fs.existsSync(plistPath), false);
});
