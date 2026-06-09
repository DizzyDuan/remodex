#!/usr/bin/env node

const {
  disableService,
  enableService,
  getStatus,
  hideWindow,
  installService,
  printStatus,
  showWindow,
  startService,
  stopService,
  uninstallService,
} = require("../src/service-manager");

const defaultDeps = {
  disableService,
  enableService,
  getStatus,
  hideWindow,
  installService,
  printStatus,
  showWindow,
  startService,
  stopService,
  uninstallService,
};

if (require.main === module) {
  runCli().catch((error) => {
    const message = error?.message || String(error || "Command failed");
    console.error(message.startsWith("[live-viewer]") ? message : `[live-viewer] ${message}`);
    process.exit(1);
  });
}

async function runCli({
  argv = process.argv,
  consoleImpl = console,
  deps = defaultDeps,
} = {}) {
  const { command, jsonOutput } = parseArgs(argv.slice(2));

  if (command === "install") {
    emitResult({
      payload: { ok: true, ...deps.installService() },
      message: "[live-viewer] Installed.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "uninstall") {
    emitResult({
      payload: { ok: true, ...deps.uninstallService() },
      message: "[live-viewer] Uninstalled.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "enable" || command === "start") {
    emitResult({
      payload: { ok: true, ...deps.startService() },
      message: "[live-viewer] Service is running.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "disable" || command === "stop") {
    deps.stopService();
    emitResult({
      payload: { ok: true },
      message: "[live-viewer] Service stopped.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "show") {
    deps.showWindow();
    emitResult({
      payload: { ok: true },
      message: "[live-viewer] Window shown.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "hide") {
    deps.hideWindow();
    emitResult({
      payload: { ok: true },
      message: "[live-viewer] Window hidden.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "status") {
    if (jsonOutput) {
      writeJson(deps.getStatus());
      return;
    }
    deps.printStatus();
    return;
  }

  throw new Error(`Unknown command: ${command}\n${usage()}`);
}

function parseArgs(rawArgs) {
  const positionals = [];
  let jsonOutput = false;

  for (const arg of rawArgs) {
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }
    positionals.push(arg);
  }

  return {
    command: positionals[0] || "status",
    jsonOutput,
  };
}

function emitResult({
  payload,
  message,
  jsonOutput = false,
  consoleImpl = console,
}) {
  if (jsonOutput) {
    writeJson(payload);
    return;
  }
  consoleImpl.log(message);
}

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function usage() {
  return "Usage: live-viewer <install|uninstall|enable|disable|start|stop|show|hide|status> [--json]";
}

module.exports = {
  parseArgs,
  runCli,
};
