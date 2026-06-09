# Remodex Live Viewer

[简体中文](./README.zh-CN.md)

Remodex Live Viewer is a local-first Electron companion window for Remodex and Codex. It reads local Codex session files and shows recent conversations in a compact always-available viewer.

It is intentionally independent from Codex.app. It does not modify app bundles, inject into Codex pages, track Codex window bounds, use CDP, or require any hosted service.

## What It Does

- Shows recent local Codex conversations as tabs.
- Displays user and assistant messages while hiding tool calls, tool output, and synthetic context messages.
- Follows the latest message per thread, with per-thread scroll and expansion state.
- Shows lightweight lifecycle/activity indicators for each thread.
- Stays available across macOS workspaces and fullscreen spaces.
- Follows Codex theme and language preferences when available, with system fallbacks.
- Auto-shows only for fresh phone-originated Remodex activity by default.

## Window Behavior

- Fixed size: `300 x 600`.
- Starts near the right edge of the primary display, then restores the last saved position.
- Draggable from the header only.
- Non-resizable, non-maximizable, and non-fullscreenable.
- Hidden from the Dock.
- Close button hides the window by default so the background process can show it again later.

## Quick Start

Run the viewer directly while developing:

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm install
npm start
```

Install and run it as an independent macOS LaunchAgent:

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm link
live-viewer install
live-viewer enable
```

`live-viewer install` installs dependencies and writes `~/Library/LaunchAgents/com.remodex.live-viewer.plist`. `live-viewer enable` loads and starts that LaunchAgent.

Login startup does not show the window by default. The background process opens the window only when `~/.remodex/last-thread.json` reports fresh phone-originated activity.

## CLI

After `npm link`, use:

```bash
live-viewer status
live-viewer show
live-viewer hide
live-viewer stop
live-viewer enable
live-viewer disable
live-viewer uninstall
```

All commands also support JSON output where applicable:

```bash
live-viewer status --json
```

Equivalent npm scripts are available for local development:

```bash
npm run service:status
npm run service:show
npm run service:hide
npm run service:stop
```

## Configuration

The config file is created automatically at:

```text
~/.remodex-live-viewer/config.json
```

Default shape:

```json
{
  "pollMs": 2000,
  "watch": {
    "enabled": true,
    "debounceMs": 100
  },
  "autoShow": {
    "mode": "on-phone-request",
    "showOnLogin": false,
    "cooldownMs": 1500,
    "respectManualHideMs": 0
  },
  "closeBehavior": "hide",
  "positioning": {
    "width": 300,
    "height": 600,
    "screenRightInset": 15,
    "lastPosition": null,
    "alwaysOnTop": true
  },
  "appearance": {
    "themeSource": "codex",
    "fallbackTheme": "system",
    "languageSource": "codex",
    "fallbackLanguage": "system"
  },
  "i18n": {
    "supportedLocales": ["en-US", "zh-CN"],
    "defaultLocale": "en-US"
  },
  "paths": {
    "lastThread": "~/.remodex/last-thread.json",
    "sessionIndex": "~/.codex/session_index.jsonl",
    "stateDb": "~/.codex/state_5.sqlite",
    "sessionsRoot": "~/.codex/sessions",
    "bridgeLog": "~/.remodex/logs/bridge.stdout.log"
  }
}
```

Notes:

- `positioning.width` and `positioning.height` are pinned to the built-in fixed size.
- `watch.enabled` enables local file watching for faster updates. `pollMs` remains a fallback.
- `autoShow.mode = "on-phone-request"` shows the window only for fresh `source: "phone"` activity newer than the current Live Viewer process start time.
- `autoShow.mode = "manual"` disables automatic showing.
- `closeBehavior = "hide"` keeps the app process alive after the window close button is clicked.

## Local Data Sources

The viewer only reads local files:

- `~/.remodex/last-thread.json`
- `~/.codex/session_index.jsonl`
- `~/.codex/state_5.sqlite`
- `~/.codex/sessions/**/*.jsonl`
- `~/.remodex/logs/bridge.stdout.log`

Startup sync combines several sources:

- Codex session index for thread ordering and titles.
- Codex local state database for recent thread metadata.
- Rollout JSONL files for message content.
- `last-thread.json` as a recent activity hint, not as the only source of truth.

If no conversation is available, the tab bar and follow button are hidden and the message area shows the empty state.

## Architecture

The app is split into three main areas:

- Main process: creates the Electron window, loads config, registers IPC, reads Codex preferences, starts session watching, and handles explicit show/hide commands.
- Session pipeline: discovers recent threads, resolves rollout files, tails JSONL by byte offset, parses visible messages, deduplicates mirrored events, and aggregates lifecycle/activity status.
- Renderer: renders tabs, message bubbles, footer controls, window controls, follow-latest behavior, expansion state, scroll anchoring, theme, and locale.

Important files:

- `src/main.js`: Electron entry point and process orchestration.
- `src/viewer-window.js`: BrowserWindow creation and fixed-window behavior.
- `src/service-manager.js`: LaunchAgent install/start/stop/status commands.
- `src/config.js`: Config defaults, merging, persistence, and legacy cleanup.
- `src/session-watcher.js`: Session update coordinator.
- `src/recent-thread-source.js`: Recent thread discovery from local Codex sources.
- `src/jsonl-tail-reader.js`: Incremental JSONL tailing.
- `src/jsonl-parser.js`: Codex event parsing and user-visible message filtering.
- `public/renderer.js`: Renderer orchestration.
- `public/message-list.js`: Message rendering and expand/collapse behavior.
- `public/thread-tabs.js`: Thread tab rendering and indicators.

## Development

Run syntax checks and tests:

```bash
node --check src/*.js
node --check public/*.js
npm test
```

Current expected test result:

```text
76 tests passing
```
