# Remodex Live Viewer

[English](./README.md)

Remodex Live Viewer 是 Remodex/Codex 本地工作流里的 macOS 伴随窗口。它用 Electron 启动一个轻量、常驻、不可抢焦点的小窗口，读取本机 Codex 会话文件，把最近线程的可见对话实时展示出来。

它是一个本地优先工具：不连接托管服务，不依赖远程域名，不修改 Codex.app，不注入 Codex 页面，不使用 CDP，也不跟踪 Codex 主窗口的位置。它只消费本机已有的 Codex/Remodex 文件，把手机端触发的本地工作流状态更及时地呈现给桌面用户。

## 为什么做这个

Remodex 的核心使用场景是本地 Mac、移动端入口、QR/本地桥接和 Codex 线程之间的协同。手机端可以触发或恢复桌面线程，但用户回到 Mac 上时，需要一个不打断当前操作的方式看到“现在是哪条线程在跑、有没有新消息、是否还在工作”。

直接把 Codex.app 当作被控制对象会带来几个问题：

- Codex 窗口可能在其他 Space、全屏窗口后面，或者当前不方便切换过去。
- 修改 app bundle、页面注入、CDP 自动化都不适合作为开源本地工具的稳定路径。
- 远程服务式状态同步会违背当前仓库的 local-first 方向。
- 手机端恢复线程时，需要的是轻量状态镜像，不是另一个完整 Codex 客户端。

Live Viewer 因此只做一件事：在本机读取本机状态，用一个独立小窗展示最近 Codex 线程的用户可见内容和运行状态。

## 产品描述

Live Viewer 是一个面向 Remodex 本地协作链路的桌面状态面板。它把 Codex 的最近线程、可见消息、运行状态和手机端触发信号整理成一个固定尺寸的小窗口，让用户不用切换到 Codex 主应用，也能知道当前本地任务是否有新进展。

产品体验上，它更接近“桌面侧边观察窗”而不是“聊天客户端”：窗口默认不抢焦点，出现在所有 macOS 工作区中，显示内容经过过滤，只保留用户真正需要看的对话和状态。后台服务可以随登录启动，但不会因为旧活动主动弹出，只有新的手机来源活动才会默认唤起窗口。

## 产品定位

Live Viewer 是一个“本地线程观察器”，不是 Codex 的替代客户端。

它适合：

- 从手机端触发 Remodex/Codex 工作后，在 Mac 上快速看到最新线程。
- 在不切换 Codex 主窗口的情况下观察任务是否还在运行。
- 在多个最近线程之间快速切换查看上下文。
- 在桌面其他工作区或全屏应用上方保留一个低打扰状态窗口。

它不负责：

- 发送新 prompt 或替代 Codex 输入框。
- 管理远程部署、云端会话或 hosted relay。
- 修改 Codex.app、浏览器页面或 app bundle。
- 解析和展示工具调用细节、工具输出日志、系统/开发者上下文。
- 作为安全审计日志或完整会话归档。

## 产品功能

- 最近线程 tabs：展示最近本地 Codex 线程，支持点击切换。
- 消息展示：显示用户和助手消息，隐藏工具调用、工具输出和合成上下文消息。
- 状态指示：为线程展示 `live`、`stale`、`disconnected` 以及任务状态。
- 跟随最新：默认跟随当前线程底部，新消息到来时自动滚动。
- 每线程 UI 状态：保留每个线程的滚动位置、展开/收起状态和跟随状态。
- 展开长消息：长消息默认折叠，可按条展开，展开时会停止自动跟随以避免阅读位置跳动。
- 自动显示：默认只在新的手机来源活动出现时显示窗口。
- 手动显示/隐藏：通过 CLI 或窗口按钮控制。
- 置顶控制：窗口可保持 always-on-top，并持久化设置。
- 跨 Space 可见：窗口设置为在所有 macOS 工作区和全屏空间可见。
- 主题与语言：优先读取 Codex 偏好，失败时回退到系统/默认设置。
- 文件监听和轮询：用 `fs.watch` 加速更新，保留定时轮询作为兜底。

## 窗口行为

- 固定尺寸：`300 x 600`。
- 默认位置：主屏幕右侧附近，之后恢复上次保存的位置。
- 拖动区域：只通过 header 发起拖动。
- 窗口模式：无系统边框、透明背景、不可缩放、不可最大化、不可全屏。
- 焦点行为：`focusable: false`，显示时使用 `showInactive()`，尽量不抢当前输入焦点。
- Dock 行为：隐藏 Dock 图标。
- 关闭行为：默认点击关闭按钮只是隐藏窗口，后台进程继续运行。
- 缩放限制：禁用页面视觉缩放和常见缩放快捷键。

## 快速开始

开发时直接运行：

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm install
npm start
```

安装为独立 macOS LaunchAgent：

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm link
live-viewer install
live-viewer enable
```

`live-viewer install` 会安装依赖并写入：

```text
~/Library/LaunchAgents/com.remodex.live-viewer.plist
```

`live-viewer enable` 会加载并启动这个 LaunchAgent。登录自启默认不会立即展示窗口，后台进程只会在检测到新的手机来源活动时自动显示。

## 产品命令

安装 `npm link` 后可以直接使用 `live-viewer`：

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

命令说明：

- `status`：查看 LaunchAgent 是否安装、是否加载、PID、项目目录和日志路径。
- `install`：安装 npm 依赖，创建日志目录，写入 LaunchAgent plist。
- `uninstall`：停止 LaunchAgent，并删除 plist。
- `enable` / `start`：写入 plist，执行 `launchctl bootstrap` 和 `kickstart`。
- `disable` / `stop`：执行 `launchctl bootout`，停止后台服务。
- `show`：启动或通知已有实例显示窗口。
- `hide`：启动或通知已有实例隐藏窗口。

支持 JSON 输出：

```bash
live-viewer status --json
live-viewer install --json
live-viewer enable --json
live-viewer stop --json
```

本地开发也可以使用 npm scripts：

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

服务管理命令只支持 macOS，因为实现依赖 `launchctl` 和用户级 LaunchAgent。

## 配置

配置文件会自动创建：

```text
~/.remodex-live-viewer/config.json
```

默认结构：

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

关键字段：

- `pollMs`：兜底轮询间隔。
- `watch.enabled`：启用本地文件监听；监听失败时不影响轮询。
- `watch.debounceMs`：文件变化事件防抖时间。
- `autoShow.mode`：`on-phone-request` 只为手机来源活动自动显示；`manual` 关闭自动显示。
- `autoShow.showOnLogin`：登录启动时是否直接显示窗口。
- `autoShow.cooldownMs`：自动显示冷却时间，避免同一批变化反复唤起窗口。
- `autoShow.respectManualHideMs`：手动隐藏后的自动显示抑制窗口，`0` 表示不抑制。
- `closeBehavior`：`hide` 表示关闭按钮隐藏窗口，`quit` 表示退出进程。
- `positioning.lastPosition`：窗口拖动结束后保存的位置。
- `positioning.alwaysOnTop`：是否置顶，并由窗口按钮持久化。
- `paths.*`：本地 Remodex/Codex 数据源路径。

`positioning.width` 和 `positioning.height` 会被固定为内置尺寸；配置里写其他值也会被合并逻辑恢复为 `300 x 600`。配置加载时会清理旧字段，例如 `codexBundleId`、`windowPollMs`、`paths.remodexBin` 等。

## 本地数据来源

Live Viewer 只读取本地文件：

- `~/.remodex/last-thread.json`
- `~/.codex/session_index.jsonl`
- `~/.codex/state_5.sqlite`
- `~/.codex/sessions/**/*.jsonl`
- `~/.remodex/logs/bridge.stdout.log`

数据来源分工：

- `last-thread.json`：Remodex 最近活动提示，包含当前活动线程、来源和更新时间。
- `session_index.jsonl`：Codex 会话索引，用于线程标题和排序候选。
- `state_5.sqlite`：Codex 本地状态库，用于读取最近线程元数据和 rollout 路径。
- `sessions/**/*.jsonl`：Codex rollout 文件，用于读取实际消息事件。
- `bridge.stdout.log`：本地桥接日志路径保留在配置中，供相关流程引用。

线程发现策略：

1. 优先读取 Codex 本地状态库中的最近线程，并过滤掉没有可用 rollout 文件的记录。
2. 用 session index 补充标题和索引来源。
3. 如果状态库没有可用线程，则扫描 `sessionsRoot` 下最近的 `rollout-*.jsonl`。
4. `last-thread.json` 只作为活跃线程提示，不作为唯一事实来源。

## 数据流

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

解析规则：

- `event_msg` 的 `user_message` 和 `agent_message` 会转成可见消息。
- `response_item` 的 `message` 会在 role 为 `user` 或 `assistant` 时转成可见消息。
- `function_call` 和 `function_call_output` 不展示。
- 以 `<environment_context>`、`<developer_instructions>`、`<skills_instructions>`、`<plugins_instructions>` 开头的用户消息不展示。
- `task_started` / `task_complete` 用于更新线程任务状态，不作为普通消息展示。
- token count 可被解析为 usage item，但 rollout 读取路径会过滤 lifecycle 项。
- 消息用 role、kind、turnId 和 text 生成去重 key，避免镜像事件重复显示。

增量读取规则：

- 每个线程记录 rollout 文件的 byte offset。
- 新内容只读取 offset 之后的范围。
- 如果文件被截断，重置 offset、partial line、items 和去重集合。
- 不完整 JSONL 行会缓存在 `partialLine`，等下一次读取再解析。

## 自动显示逻辑

默认 `autoShow.mode = "on-phone-request"`。窗口只会在满足以下条件时自动显示：

- 当前 state 有有效 `threadId`。
- 活动来源被识别为 `phone`。
- 活动更新时间晚于当前 Live Viewer 进程启动时间。
- 当前活动没有被同一个 `threadId:updatedAtMs` key 处理过。
- 没有命中自动显示冷却时间。
- 如果配置了 `respectManualHideMs`，没有处于手动隐藏抑制窗口内。

实现上会预创建窗口，但默认不显示。自动显示和 CLI `show` 都使用 `showInactive()`，尽量不抢焦点。

## 架构

应用分为四层：

- CLI/服务层：处理 `live-viewer` 命令、LaunchAgent 安装、启动、停止、状态查询。
- Electron 主进程：创建窗口、加载配置、注册 IPC、读 Codex 偏好、启动 watcher。
- 会话管线：发现最近线程、解析 rollout、增量读取 JSONL、聚合线程状态。
- Renderer：渲染 tabs、消息、按钮、滚动和每线程 UI 状态。

主进程启动顺序：

1. 获取 Electron 单实例锁。
2. 加载并合并配置。
3. 隐藏 Dock 图标。
4. 创建主题和语言控制器。
5. 创建窗口启动控制器，并预创建窗口。
6. 根据 CLI 参数或 `showOnLogin` 决定是否显示。
7. 注册 IPC handlers。
8. 启动 session watcher。
9. 主题变化时推送到 renderer。

## 代码描述

### 根目录

- `package.json`：项目元信息、CLI bin、npm scripts 和测试命令。
- `package-lock.json`：npm 锁文件。
- `bin/live-viewer.js`：CLI 入口，解析命令和 `--json`。
- `src/`：Electron 主进程、服务管理、会话读取和业务逻辑。
- `public/`：Renderer HTML/CSS/JS。
- `test/`：Node test runner 单元测试。

### CLI 和服务管理

- `src/service-manager.js`：封装 LaunchAgent 生命周期。
  - `installService()` 安装依赖、创建日志目录、写 plist。
  - `enableService()` 写 plist 并通过 `launchctl bootstrap` / `kickstart` 启动。
  - `stopService()` 执行 `launchctl bootout`。
  - `uninstallService()` 停止服务并删除 plist。
  - `getStatus()` 读取 installed、loaded、PID、日志路径等状态。
  - `showWindow()` / `hideWindow()` 通过 detached `npm start -- --show/--hide` 通知单实例窗口。

### Electron 主进程

- `src/main.js`：应用入口和总编排。
- `src/viewer-window.js`：创建固定尺寸 BrowserWindow，设置无边框、置顶、跨 Space、preload、缩放限制。
- `src/window-position.js`：计算初始窗口位置，优先使用 `lastPosition`。
- `src/window-start-controller.js`：管理窗口预创建、显示、隐藏、自动显示和 renderer 推送。
- `src/auto-show-controller.js`：纯函数判断是否应该为当前 session 自动显示。
- `src/ipc-handlers.js`：注册 renderer 调用的 IPC，包括初始状态、关闭、置顶、拖动和位置保存。
- `src/preload.js`：通过 `contextBridge` 暴露安全的 renderer API。

### 配置和偏好

- `src/config.js`：创建默认配置、加载配置、保存配置、合并旧配置并清理废弃字段。
- `src/codex-preferences-reader.js`：读取 Codex 偏好。
- `src/theme-controller.js`：解析当前主题并监听系统主题变化。
- `src/language-controller.js`：解析当前语言，支持 `en-US` 和 `zh-CN`。

### 会话管线

- `src/session-watcher.js`：核心协调器。定时 tick，读取活跃线程，发现最近线程，读取 rollout，更新文件监听，向主进程输出 session state。
- `src/active-thread-reader.js`：读取 `last-thread.json`。
- `src/recent-thread-source.js`：从 Codex 状态库、session index 和 rollout 文件中发现最近线程。
- `src/thread-store-reader.js`：读取 Codex `state_5.sqlite` 的最近线程信息。
- `src/session-index-reader.js`：读取 `session_index.jsonl`。
- `src/rollout-resolver.js`：按 threadId 定位 rollout 文件，并扫描最近 rollout 文件。
- `src/jsonl-tail-reader.js`：按 byte offset 增量读取 rollout，维护 partial line、截断恢复和去重。
- `src/jsonl-parser.js`：解析 Codex JSONL 事件，过滤出用户可见消息。
- `src/thread-state.js`：维护线程状态、标题推导、状态聚合、任务状态和移动端来源识别。
- `src/file-change-watcher.js`：监听静态路径和当前 rollout 文件，防抖后触发 watcher tick。

### Renderer

- `public/index.html`：窗口 HTML 骨架。
- `public/style.css`：窗口、tabs、消息、状态点、按钮和主题样式。
- `public/i18n.js`：英文/中文 UI 文案。
- `public/renderer.js`：renderer 总编排，订阅 IPC，渲染 session，处理跟随和语言主题变化。
- `public/renderer-state.js`：自动选中线程、tabs signature、空 session 和每线程 UI 状态。
- `public/renderer-scroll.js`：滚动到底部、捕获/恢复滚动锚点。
- `public/message-list.js`：消息列表渲染、折叠/展开、空状态。
- `public/thread-tabs.js`：线程 tabs、状态点、任务状态指示器。
- `public/window-controls.js`：隐藏、置顶和 header 拖动交互。

## 测试

运行全部测试：

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm test
```

运行语法检查：

```bash
cd /Users/dizzy/Project/remodex/live-viewer
node --check src/*.js
node --check public/*.js
```

测试覆盖重点：

- 自动显示判断。
- 配置合并和旧字段清理。
- 文件监听防抖和 rollout watcher 更新。
- JSONL 解析和用户可见消息过滤。
- CLI 参数解析和输出。
- LaunchAgent plist 生成和服务状态读取。
- 最近线程读取、session watcher、rollout resolver。
- renderer 状态选择、窗口位置和启动控制。

## 日志和排障

LaunchAgent 日志路径：

```text
~/.remodex/logs/live-viewer.stdout.log
~/.remodex/logs/live-viewer.stderr.log
```

常用检查：

```bash
live-viewer status
live-viewer status --json
npm run service:status
```

如果窗口没有自动出现，优先检查：

- `live-viewer status` 是否显示 LaunchAgent 已加载。
- `~/.remodex/last-thread.json` 是否有新的手机来源活动。
- 活动时间是否晚于当前 Live Viewer 进程启动时间。
- `autoShow.mode` 是否仍为 `on-phone-request`。
- `autoShow.showOnLogin` 是否符合预期。
- `~/.codex/state_5.sqlite` 或 `~/.codex/sessions` 是否能找到对应 rollout。
- stderr 日志是否有 Electron 或 launchctl 错误。

如果线程列表为空，优先检查：

- `~/.codex/state_5.sqlite` 是否存在且包含最近线程。
- `~/.codex/session_index.jsonl` 是否存在。
- `~/.codex/sessions` 下是否有 `rollout-*.jsonl`。
- 配置里的 `paths.*` 是否被改到错误位置。

## 维护边界

这个项目应保持 local-first 和单一职责：

- 不引入 hosted-service 假设。
- 不硬编码远程生产域名。
- 不把 Live Viewer 变成 Codex 输入客户端。
- 不在服务日志中记录 live relay `sessionId` 等 bearer-like pairing 标识。
- 不把读取、解析、UI 渲染逻辑混在一个文件里；共享逻辑放在服务/协调器模块。
- 不为了显示更多内容而展示工具调用输出或系统上下文。
- 不回退到“按侧边栏选中 repo 过滤内容”的旧假设。
- 不破坏跨 repo 打开/创建和本地 context switch 工作流。

## 开发原则

- 尽量把复杂逻辑写成纯函数，并为它们补测试。
- 主进程负责窗口和 IPC，session watcher 负责数据聚合，renderer 只负责 UI 状态和渲染。
- 文件监听只是优化，轮询必须保持可用。
- 自动显示必须保守，避免登录或旧活动导致窗口突然弹出。
- 配置合并要兼容旧配置，但不保留过期字段。
- 新增数据源时要明确它是 source of truth 还是 hint。

## 当前预期

当前测试命令：

```bash
npm test
```

当前测试规模：

```text
76 tests passing
```
