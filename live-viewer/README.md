# Remodex Live Viewer

[简体中文](./README.zh-CN.md)

Remodex Live Viewer is a local-first macOS companion window for the Remodex/Codex workflow. It starts a lightweight, persistent Electron window that does not steal focus, reads local Codex session files, and shows the user-visible content from recent threads.

It is intentionally local-first: it does not connect to hosted services, depend on remote domains, modify Codex.app, inject into Codex pages, use CDP, or track the Codex window position. It only consumes local Codex/Remodex files and makes phone-originated local workflow activity easier to see on the desktop.

## Why This Exists

Remodex is built around a local Mac runtime, mobile entry points, QR/local bridge pairing, and Codex threads. A phone can trigger or recover a desktop thread, but when the user returns to the Mac they need a low-friction way to see which thread is active, whether new messages arrived, and whether work is still running.

Treating Codex.app as the object being controlled creates avoidable problems:

- The Codex window may be in another Space, behind a fullscreen app, or inconvenient to switch to.
- App bundle patches, page injection, and CDP automation are poor stability boundaries for an open-source local tool.
- Remote service-style state sync conflicts with the repository's local-first direction.
- Phone-driven thread recovery needs a lightweight state mirror, not another full Codex client.

Live Viewer therefore does one thing: it reads local state on the local machine and displays recent Codex thread content and status in a small independent window.

## Product Description

Live Viewer is a desktop status panel for the Remodex local collaboration path. It turns recent Codex threads, visible messages, task state, and phone-originated activity hints into a fixed-size window so the user can see local task progress without switching to the main Codex app.

The product experience is closer to a desktop side observer than a chat client: the window does not steal focus by default, stays available across macOS Spaces, and filters content down to the conversation and state a user actually needs to see. The background service can start at login, but it does not pop up for stale activity; by default, only fresh phone-originated activity shows the window.

## Product Positioning

Live Viewer is a local thread observer, not a replacement Codex client.

It is useful for:

- Quickly seeing the latest thread on the Mac after Remodex/Codex work is triggered from a phone.
- Observing whether a task is still running without switching to the Codex main window.
- Switching between recent local threads to review context.
- Keeping a low-distraction status window above other desktop Spaces or fullscreen apps.

It does not:

- Send new prompts or replace the Codex input box.
- Manage remote deployments, cloud sessions, or hosted relays.
- Modify Codex.app, browser pages, or app bundles.
- Display tool call details, tool output logs, or system/developer context.
- Serve as a security audit log or complete session archive.

## Product Features

- Recent thread tabs: shows recent local Codex threads and supports switching between them.
- Message display: shows user and assistant messages while hiding tool calls, tool outputs, and synthetic context messages.
- Status indicators: shows `live`, `stale`, `disconnected`, and task status per thread.
- Follow latest: follows the bottom of the current thread by default as new messages arrive.
- Per-thread UI state: preserves scroll position, expanded messages, and follow state for each thread.
- Long message expansion: long messages are collapsed by default and can be expanded per item; expanding stops auto-follow to avoid moving the reading position.
- Auto-show: shows the window by default only for fresh phone-originated activity.
- Manual show/hide: controlled through the CLI or window controls.
- Always-on-top control: supports persistent always-on-top behavior.
- Cross-Space availability: stays visible across macOS Spaces and fullscreen Spaces.
- Theme and language: prefers Codex preferences and falls back to system/default settings.
- File watching and polling: uses `fs.watch` for faster updates while keeping polling as the reliable fallback.

## Window Behavior

- Fixed size: `300 x 600`.
- Initial position: near the right edge of the primary display, then the last saved position.
- Dragging: only the header starts a manual drag.
- Window mode: frameless, transparent, non-resizable, non-maximizable, and non-fullscreenable.
- Focus behavior: `focusable: false`, shown with `showInactive()` to avoid stealing input focus.
- Dock behavior: hidden from the Dock.
- Close behavior: by default the close button hides the window and leaves the background process running.
- Zoom behavior: visual zoom and common zoom shortcuts are disabled.

## Quick Start

Run directly during development:

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm install
npm start
```

Install as an independent macOS LaunchAgent:

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm link
live-viewer install
live-viewer enable
```

`live-viewer install` installs dependencies and writes:

```text
~/Library/LaunchAgents/com.remodex.live-viewer.plist
```

`live-viewer enable` loads and starts that LaunchAgent. Login startup does not show the window by default; the background process only shows it when fresh phone-originated activity is detected.

## Product Commands

After `npm link`, use the `live-viewer` command:

```bash
live-viewer status
live-viewer install
live-viewer uninstall
live-viewer enable
live-viewer disable
live-viewer start
live-viewer stop
live-viewer show
live-viewer hide
```

Command reference:

- `status`: shows whether the LaunchAgent is installed and loaded, plus PID, project root, and log paths.
- `install`: installs npm dependencies, creates the log directory, and writes the LaunchAgent plist.
- `uninstall`: stops the LaunchAgent and removes the plist.
- `enable` / `start`: writes the plist, then runs `launchctl bootstrap` and `kickstart`.
- `disable` / `stop`: runs `launchctl bootout` to stop the background service.
- `show`: starts or notifies the existing instance to show the window.
- `hide`: starts or notifies the existing instance to hide the window.

JSON output is supported:

```bash
live-viewer status --json
live-viewer install --json
live-viewer enable --json
live-viewer stop --json
```

Equivalent npm scripts are available for local development:

```bash
npm run service:install
npm run service:uninstall
npm run service:enable
npm run service:disable
npm run service:start
npm run service:stop
npm run service:show
npm run service:hide
npm run service:status
npm test
```

Service management commands are macOS-only because they depend on `launchctl` and a user-level LaunchAgent.

## Configuration

The config file is created automatically:

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

Key fields:

- `pollMs`: fallback polling interval.
- `watch.enabled`: enables local file watching; polling remains available if watching fails.
- `watch.debounceMs`: debounce interval for file change events.
- `autoShow.mode`: `on-phone-request` auto-shows only for phone-originated activity; `manual` disables auto-show.
- `autoShow.showOnLogin`: whether to show the window immediately at login/startup.
- `autoShow.cooldownMs`: prevents repeated show calls for the same burst of changes.
- `autoShow.respectManualHideMs`: suppresses auto-show after manual hide; `0` means no suppression.
- `closeBehavior`: `hide` keeps the background process alive; `quit` exits the process.
- `positioning.lastPosition`: saved when a manual drag ends.
- `positioning.alwaysOnTop`: persisted by the window's always-on-top button.
- `paths.*`: local Remodex/Codex data source paths.

`positioning.width` and `positioning.height` are pinned to the built-in size; custom values are merged back to `300 x 600`. Config loading also removes legacy fields such as `codexBundleId`, `windowPollMs`, and `paths.remodexBin`.

## Local Data Sources

Live Viewer only reads local files:

- `~/.remodex/last-thread.json`
- `~/.codex/session_index.jsonl`
- `~/.codex/state_5.sqlite`
- `~/.codex/sessions/**/*.jsonl`
- `~/.remodex/logs/bridge.stdout.log`

Source responsibilities:

- `last-thread.json`: recent Remodex activity hint, including active thread, source, and updated time.
- `session_index.jsonl`: Codex session index, used for thread titles and ordering candidates.
- `state_5.sqlite`: Codex local state database, used for recent thread metadata and rollout paths.
- `sessions/**/*.jsonl`: Codex rollout files, used for actual message events.
- `bridge.stdout.log`: local bridge log path kept in config for related workflows.

Thread discovery strategy:

1. Prefer recent threads from the Codex local state database and filter out records without usable rollout files.
2. Use the session index to fill in titles and index source.
3. If the state database has no usable threads, scan `sessionsRoot` for recent `rollout-*.jsonl` files.
4. Use `last-thread.json` as an active-thread hint, not as the only source of truth.

## Data Flow

```text
Remodex/Codex local files
  -> recent thread discovery
  -> rollout path resolution
  -> incremental JSONL tailing
  -> Codex event parsing
  -> visible item filtering and dedupe
  -> thread status aggregation
  -> Electron IPC
  -> renderer tabs/messages/footer
```

Parsing rules:

- `event_msg` `user_message` and `agent_message` become visible messages.
- `response_item` `message` becomes visible when its role is `user` or `assistant`.
- `function_call` and `function_call_output` are hidden.
- User messages starting with `<environment_context>`, `<developer_instructions>`, `<skills_instructions>`, or `<plugins_instructions>` are hidden.
- `task_started` / `task_complete` update task status and are not rendered as normal messages.
- Token count events can be parsed as usage items, but the rollout read path filters lifecycle items.
- Messages are deduplicated by a key based on role, kind, turnId, and text.

Incremental read rules:

- Each thread tracks a byte offset for its rollout file.
- New reads only consume bytes after the previous offset.
- If a file is truncated, offset, partial line, items, and dedupe state are reset.
- Incomplete JSONL lines are kept in `partialLine` until the next read.

## Auto-Show Logic

The default is `autoShow.mode = "on-phone-request"`. The window auto-shows only when all of these are true:

- The current state has a valid `threadId`.
- The activity source is recognized as `phone`.
- The activity timestamp is newer than the current Live Viewer process start time.
- The same `threadId:updatedAtMs` activity key has not already been handled.
- The auto-show cooldown has not been hit.
- If `respectManualHideMs` is configured, the manual-hide suppression window has expired.

The app precreates the window but does not show it by default. Auto-show and CLI `show` both use `showInactive()` to avoid stealing focus.

## Architecture

The app has four layers:

- CLI/service layer: handles `live-viewer` commands, LaunchAgent install/start/stop/status.
- Electron main process: creates the window, loads config, registers IPC, reads Codex preferences, and starts the watcher.
- Session pipeline: discovers recent threads, resolves rollouts, incrementally reads JSONL, and aggregates thread state.
- Renderer: renders tabs, messages, buttons, scrolling, and per-thread UI state.

Main process startup order:

1. Acquire the Electron single-instance lock.
2. Load and merge config.
3. Hide the Dock icon.
4. Create theme and language controllers.
5. Create the window start controller and precreate the window.
6. Decide whether to show based on CLI flags or `showOnLogin`.
7. Register IPC handlers.
8. Start the session watcher.
9. Push theme changes to the renderer.

## Code Overview

### Root

- `package.json`: project metadata, CLI bin, npm scripts, and test command.
- `package-lock.json`: npm lockfile.
- `bin/live-viewer.js`: CLI entry point, command parsing, and `--json` handling.
- `src/`: Electron main process, service management, session reading, and business logic.
- `public/`: renderer HTML/CSS/JS.
- `test/`: Node test runner unit tests.

### CLI And Service Management

- `src/service-manager.js`: wraps the LaunchAgent lifecycle.
  - `installService()` installs dependencies, creates the log directory, and writes the plist.
  - `enableService()` writes the plist and starts it with `launchctl bootstrap` / `kickstart`.
  - `stopService()` runs `launchctl bootout`.
  - `uninstallService()` stops the service and removes the plist.
  - `getStatus()` reads installed, loaded, PID, and log path state.
  - `showWindow()` / `hideWindow()` notify the single instance through detached `npm start -- --show/--hide`.

### Electron Main Process

- `src/main.js`: app entry point and orchestration.
- `src/viewer-window.js`: creates the fixed-size BrowserWindow and configures frameless, always-on-top, cross-Space, preload, and zoom behavior.
- `src/window-position.js`: calculates initial window bounds, preferring `lastPosition`.
- `src/window-start-controller.js`: manages precreation, show/hide, auto-show, and renderer pushes.
- `src/auto-show-controller.js`: pure function for deciding whether the current session should auto-show.
- `src/ipc-handlers.js`: registers renderer IPC for initial state, close, always-on-top, dragging, and position persistence.
- `src/preload.js`: exposes a safe renderer API through `contextBridge`.

### Configuration And Preferences

- `src/config.js`: creates defaults, loads config, saves config, merges old config, and removes legacy fields.
- `src/codex-preferences-reader.js`: reads Codex preferences.
- `src/theme-controller.js`: resolves current theme and listens for system theme changes.
- `src/language-controller.js`: resolves current language, supporting `en-US` and `zh-CN`.

### Session Pipeline

- `src/session-watcher.js`: core coordinator. It ticks on an interval, reads the active thread, discovers recent threads, reads rollouts, updates file watches, and emits session state.
- `src/active-thread-reader.js`: reads `last-thread.json`.
- `src/recent-thread-source.js`: discovers recent threads from the Codex state database, session index, and rollout files.
- `src/thread-store-reader.js`: reads recent thread data from Codex `state_5.sqlite`.
- `src/session-index-reader.js`: reads `session_index.jsonl`.
- `src/rollout-resolver.js`: resolves rollout files by threadId and scans recent rollout files.
- `src/jsonl-tail-reader.js`: incrementally reads rollouts by byte offset and handles partial lines, truncation recovery, and dedupe.
- `src/jsonl-parser.js`: parses Codex JSONL events and filters user-visible messages.
- `src/thread-state.js`: maintains thread state, title derivation, status aggregation, task status, and mobile-origin detection.
- `src/file-change-watcher.js`: watches static paths and current rollout files, then triggers debounced watcher ticks.

### Renderer

- `public/index.html`: window HTML shell.
- `public/style.css`: styles for the window, tabs, messages, status dots, buttons, and themes.
- `public/i18n.js`: English and Chinese UI strings.
- `public/renderer.js`: renderer orchestrator, IPC subscriptions, session rendering, follow behavior, language, and theme changes.
- `public/renderer-state.js`: auto-selected thread state, tab signatures, empty session state, and per-thread UI state.
- `public/renderer-scroll.js`: scroll-to-bottom and scroll anchor capture/restore helpers.
- `public/message-list.js`: message list rendering, collapse/expand, and empty state.
- `public/thread-tabs.js`: thread tabs, status dots, and task indicators.
- `public/window-controls.js`: hide, always-on-top, and header drag interactions.

## Testing

Run all tests:

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm test
```

Run syntax checks:

```bash
cd /Users/dizzy/Project/remodex/live-viewer
node --check src/*.js
node --check public/*.js
```

Test coverage focuses on:

- Auto-show decisions.
- Config merging and legacy field cleanup.
- File watch debounce and rollout watcher updates.
- JSONL parsing and user-visible message filtering.
- CLI argument parsing and output.
- LaunchAgent plist generation and service status reads.
- Recent thread reads, session watcher, and rollout resolver.
- Renderer state selection, window positioning, and start control.

## Logs And Troubleshooting

LaunchAgent log paths:

```text
~/.remodex/logs/live-viewer.stdout.log
~/.remodex/logs/live-viewer.stderr.log
```

Useful checks:

```bash
live-viewer status
live-viewer status --json
npm run service:status
```

If the window does not auto-show, check:

- Whether `live-viewer status` reports the LaunchAgent as loaded.
- Whether `~/.remodex/last-thread.json` contains fresh phone-originated activity.
- Whether the activity timestamp is newer than the current Live Viewer process start time.
- Whether `autoShow.mode` is still `on-phone-request`.
- Whether `autoShow.showOnLogin` matches the expected startup behavior.
- Whether `~/.codex/state_5.sqlite` or `~/.codex/sessions` can resolve the rollout.
- Whether stderr logs contain Electron or launchctl errors.

If the thread list is empty, check:

- Whether `~/.codex/state_5.sqlite` exists and contains recent threads.
- Whether `~/.codex/session_index.jsonl` exists.
- Whether `~/.codex/sessions` contains `rollout-*.jsonl` files.
- Whether configured `paths.*` values point to the expected local files.

## Maintenance Boundaries

This project should stay local-first and single-purpose:

- Do not introduce hosted-service assumptions.
- Do not hardcode remote production domains.
- Do not turn Live Viewer into a Codex input client.
- Do not log live relay `sessionId` values or other bearer-like pairing identifiers in service logs.
- Do not mix reading, parsing, and UI rendering logic in one file; shared logic belongs in services/coordinators.
- Do not display tool call output or system context just to show more content.
- Do not restore the old assumption that content should be filtered by the selected repo in the sidebar.
- Do not break cross-repo open/create and local context switch workflows.

## Development Principles

- Prefer pure functions for complex logic and cover them with tests.
- Keep the main process responsible for windows and IPC, the session watcher responsible for aggregation, and the renderer responsible for UI state and rendering.
- File watching is an optimization; polling must remain usable.
- Auto-show must stay conservative so login or stale activity does not unexpectedly show the window.
- Config merging should tolerate older config but remove obsolete fields.
- When adding a data source, make clear whether it is a source of truth or a hint.

## Current Expectation

Current test command:

```bash
npm test
```

Current test scale:

```text
76 tests passing
```
