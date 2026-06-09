const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SERVICE_LABEL = "com.remodex.live-viewer";

function installService({
  env = process.env,
  platform = process.platform,
  fsImpl = fs,
  execFileSyncImpl = execFileSync,
  osImpl = os,
  liveViewerRoot = resolveLiveViewerRoot(),
} = {}) {
  assertDarwinPlatform(platform);
  assertLiveViewerRoot(liveViewerRoot, fsImpl);
  ensureLogsDir({ env, fsImpl, osImpl });
  execFileSyncImpl("npm", ["install"], {
    cwd: liveViewerRoot,
    stdio: "inherit",
  });
  const plistPath = writeLaunchAgentPlist({
    env,
    fsImpl,
    osImpl,
    liveViewerRoot,
  });
  return { liveViewerRoot, plistPath };
}

function enableService({
  env = process.env,
  platform = process.platform,
  fsImpl = fs,
  execFileSyncImpl = execFileSync,
  osImpl = os,
  liveViewerRoot = resolveLiveViewerRoot(),
} = {}) {
  assertDarwinPlatform(platform);
  assertLiveViewerRoot(liveViewerRoot, fsImpl);
  const plistPath = writeLaunchAgentPlist({
    env,
    fsImpl,
    osImpl,
    liveViewerRoot,
  });
  restartLaunchAgent({ env, execFileSyncImpl, osImpl, plistPath });
  return { liveViewerRoot, plistPath };
}

function disableService(options = {}) {
  stopService(options);
  return true;
}

function startService(options = {}) {
  return enableService(options);
}

function stopService({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  osImpl = os,
} = {}) {
  assertDarwinPlatform(platform);
  bootoutLaunchAgent({
    env,
    execFileSyncImpl,
    osImpl,
    ignoreMissing: true,
  });
  return true;
}

function uninstallService({
  env = process.env,
  platform = process.platform,
  fsImpl = fs,
  execFileSyncImpl = execFileSync,
  osImpl = os,
} = {}) {
  stopService({ env, platform, execFileSyncImpl, osImpl });
  const plistPath = resolveLaunchAgentPlistPath({ env, osImpl });
  try {
    fsImpl.rmSync(plistPath, { force: true });
  } catch {
    // Best-effort cleanup only.
  }
  return { plistPath };
}

function getStatus({
  env = process.env,
  platform = process.platform,
  fsImpl = fs,
  execFileSyncImpl = execFileSync,
  osImpl = os,
  liveViewerRoot = resolveLiveViewerRoot(),
} = {}) {
  assertDarwinPlatform(platform);
  const launchd = readLaunchAgentState({ env, execFileSyncImpl });
  const plistPath = resolveLaunchAgentPlistPath({ env, osImpl });
  return {
    label: SERVICE_LABEL,
    platform: "darwin",
    installed: fsImpl.existsSync(plistPath),
    launchdLoaded: launchd.loaded,
    launchdPid: launchd.pid,
    liveViewerRoot,
    plistPath,
    stdoutLogPath: resolveStdoutLogPath({ env, osImpl }),
    stderrLogPath: resolveStderrLogPath({ env, osImpl }),
  };
}

function printStatus(options = {}) {
  const status = getStatus(options);
  console.log(`[live-viewer] Label: ${status.label}`);
  console.log(`[live-viewer] Installed: ${status.installed ? "yes" : "no"}`);
  console.log(`[live-viewer] Launchd loaded: ${status.launchdLoaded ? "yes" : "no"}`);
  console.log(`[live-viewer] PID: ${status.launchdPid || "unknown"}`);
  console.log(`[live-viewer] Root: ${status.liveViewerRoot}`);
  console.log(`[live-viewer] Plist: ${status.plistPath}`);
  console.log(`[live-viewer] Stdout log: ${status.stdoutLogPath}`);
  console.log(`[live-viewer] Stderr log: ${status.stderrLogPath}`);
}

function showWindow(options = {}) {
  return spawnWindowCommand("--show", options);
}

function hideWindow(options = {}) {
  return spawnWindowCommand("--hide", options);
}

function spawnWindowCommand(flag, {
  platform = process.platform,
  liveViewerRoot = resolveLiveViewerRoot(),
  spawnImpl = spawn,
} = {}) {
  assertDarwinPlatform(platform);
  const child = spawnImpl("npm", ["start", "--", flag], {
    cwd: liveViewerRoot,
    detached: true,
    stdio: "ignore",
  });
  child.unref?.();
  return true;
}

function writeLaunchAgentPlist({
  env = process.env,
  fsImpl = fs,
  osImpl = os,
  liveViewerRoot = resolveLiveViewerRoot(),
} = {}) {
  const plistPath = resolveLaunchAgentPlistPath({ env, osImpl });
  const homeDir = env.HOME || osImpl.homedir();
  const serialized = buildLaunchAgentPlist({
    homeDir,
    liveViewerRoot,
    pathEnv: env.PATH || "",
    stdoutLogPath: resolveStdoutLogPath({ env, osImpl }),
    stderrLogPath: resolveStderrLogPath({ env, osImpl }),
  });
  fsImpl.mkdirSync(path.dirname(plistPath), { recursive: true });
  fsImpl.writeFileSync(plistPath, serialized, "utf8");
  return plistPath;
}

function buildLaunchAgentPlist({
  homeDir,
  liveViewerRoot,
  pathEnv,
  stdoutLogPath,
  stderrLogPath,
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(SERVICE_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>npm start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>WorkingDirectory</key>
  <string>${escapeXml(liveViewerRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${escapeXml(homeDir)}</string>
    <key>PATH</key>
    <string>${escapeXml(pathEnv)}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${escapeXml(stdoutLogPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(stderrLogPath)}</string>
</dict>
</plist>
`;
}

function restartLaunchAgent({
  env = process.env,
  execFileSyncImpl = execFileSync,
  osImpl = os,
  plistPath,
} = {}) {
  bootoutLaunchAgent({
    env,
    execFileSyncImpl,
    osImpl,
    ignoreMissing: true,
  });
  execFileSyncImpl("launchctl", [
    "bootstrap",
    launchAgentDomain(env),
    plistPath,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  execFileSyncImpl("launchctl", [
    "kickstart",
    "-k",
    launchAgentLabelDomain(env),
  ], { stdio: ["ignore", "ignore", "pipe"] });
}

function bootoutLaunchAgent({
  env = process.env,
  execFileSyncImpl = execFileSync,
  osImpl = os,
  ignoreMissing = false,
} = {}) {
  const bootoutTargets = [
    [launchAgentDomain(env), resolveLaunchAgentPlistPath({ env, osImpl })],
    [launchAgentLabelDomain(env)],
  ];
  let lastError = null;

  for (const targetArgs of bootoutTargets) {
    try {
      execFileSyncImpl("launchctl", [
        "bootout",
        ...targetArgs,
      ], { stdio: ["ignore", "ignore", "pipe"] });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (ignoreMissing && isMissingLaunchAgentError(lastError)) {
    return;
  }
  throw lastError;
}

function readLaunchAgentState({
  env = process.env,
  execFileSyncImpl = execFileSync,
} = {}) {
  try {
    const output = execFileSyncImpl("launchctl", [
      "print",
      launchAgentLabelDomain(env),
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return {
      loaded: true,
      pid: parseLaunchdPid(output),
    };
  } catch (error) {
    if (isMissingLaunchAgentError(error)) {
      return {
        loaded: false,
        pid: null,
      };
    }
    throw error;
  }
}

function resolveLiveViewerRoot() {
  return path.resolve(__dirname, "..");
}

function resolveLaunchAgentPlistPath({ env = process.env, osImpl = os } = {}) {
  const homeDir = env.HOME || osImpl.homedir();
  return path.join(homeDir, "Library", "LaunchAgents", `${SERVICE_LABEL}.plist`);
}

function resolveStdoutLogPath({ env = process.env, osImpl = os } = {}) {
  return path.join(resolveLogsDir({ env, osImpl }), "live-viewer.stdout.log");
}

function resolveStderrLogPath({ env = process.env, osImpl = os } = {}) {
  return path.join(resolveLogsDir({ env, osImpl }), "live-viewer.stderr.log");
}

function ensureLogsDir({ env = process.env, fsImpl = fs, osImpl = os } = {}) {
  fsImpl.mkdirSync(resolveLogsDir({ env, osImpl }), { recursive: true });
}

function resolveLogsDir({ env = process.env, osImpl = os } = {}) {
  const homeDir = env.HOME || osImpl.homedir();
  return path.join(homeDir, ".remodex", "logs");
}

function assertLiveViewerRoot(liveViewerRoot, fsImpl = fs) {
  if (!fsImpl.existsSync(path.join(liveViewerRoot, "package.json"))) {
    throw new Error(`Live Viewer project was not found at ${liveViewerRoot}.`);
  }
}

function assertDarwinPlatform(platform = process.platform) {
  if (platform !== "darwin") {
    throw new Error("Live Viewer service management is only available on macOS.");
  }
}

function launchAgentDomain(env) {
  return `gui/${resolveUid(env)}`;
}

function launchAgentLabelDomain(env) {
  return `${launchAgentDomain(env)}/${SERVICE_LABEL}`;
}

function resolveUid(env) {
  if (typeof process.getuid === "function") {
    return process.getuid();
  }

  const uid = Number.parseInt(env.UID || "", 10);
  if (Number.isFinite(uid)) {
    return uid;
  }

  throw new Error("Could not determine the current macOS user id for launchctl.");
}

function parseLaunchdPid(output) {
  const match = typeof output === "string" ? output.match(/\bpid = (\d+)/) : null;
  return match ? Number.parseInt(match[1], 10) : null;
}

function isMissingLaunchAgentError(error) {
  const combined = [
    error?.message,
    error?.stderr?.toString?.("utf8"),
    error?.stdout?.toString?.("utf8"),
  ].filter(Boolean).join("\n").toLowerCase();
  return combined.includes("could not find service")
    || combined.includes("service could not be found")
    || combined.includes("no such process");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

module.exports = {
  buildLaunchAgentPlist,
  disableService,
  enableService,
  getStatus,
  hideWindow,
  installService,
  printStatus,
  resolveLaunchAgentPlistPath,
  showWindow,
  startService,
  stopService,
  uninstallService,
};
