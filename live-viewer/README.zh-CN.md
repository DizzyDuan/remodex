# Remodex Live Viewer

[English](./README.md)

Remodex Live Viewer 是一个本地优先的 Electron 伴随窗口，用来读取本地 Codex 会话文件，并在一个紧凑的常驻窗口里展示最近对话。

它刻意保持独立：不修改 Codex.app，不补丁 app bundle，不注入 Codex 页面，不跟踪 Codex 窗口位置，不使用 CDP，也不需要任何托管服务。

## 它做什么

- 用 tab 展示最近的本地 Codex 对话。
- 显示用户和助手消息，隐藏工具调用、工具输出和合成上下文消息。
- 按线程跟随最新消息，并保留每个线程自己的滚动、展开状态。
- 为每个线程显示轻量的生命周期和活跃状态指示器。
- 在 macOS 工作区和全屏空间中保持可用。
- 优先跟随 Codex 的主题和语言偏好，不可用时回退到系统设置。
- 默认只在 Remodex 报告新的手机来源活动时自动显示窗口。

## 窗口行为

- 固定尺寸：`300 x 600`。
- 默认出现在主屏幕右侧附近，之后优先恢复上次保存的位置。
- 只能通过 header 拖动。
- 不允许缩放、最大化或全屏。
- 不显示 Dock 图标。
- 默认点击关闭按钮只是隐藏窗口，后台进程会继续运行，方便之后再次显示。

## 快速开始

开发时可以直接运行：

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm install
npm start
```

也可以安装为独立的 macOS LaunchAgent：

```bash
cd /Users/dizzy/Project/remodex/live-viewer
npm link
live-viewer install
live-viewer enable
```

`live-viewer install` 会安装依赖并写入 `~/Library/LaunchAgents/com.remodex.live-viewer.plist`。`live-viewer enable` 会加载并启动这个 LaunchAgent。

登录自启默认不显示窗口。后台进程只会在 `~/.remodex/last-thread.json` 报告新的手机来源活动时打开窗口。

## CLI

执行过 `npm link` 后可使用：

```bash
live-viewer status
live-viewer show
live-viewer hide
live-viewer stop
live-viewer enable
live-viewer disable
live-viewer uninstall
```

适用的命令支持 JSON 输出：

```bash
live-viewer status --json
```

本地开发也可以使用等价的 npm scripts：

```bash
npm run service:status
npm run service:show
npm run service:hide
npm run service:stop
```

## 配置

配置文件会自动创建在：

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

说明：

- `positioning.width` 和 `positioning.height` 会被固定为内置窗口尺寸。
- `watch.enabled` 开启本地文件监听，让更新更快显示；`pollMs` 保留为兜底轮询。
- `autoShow.mode = "on-phone-request"` 表示只在出现新的 `source: "phone"` 活动，并且活动时间晚于当前 Live Viewer 进程启动时间时显示窗口。
- `autoShow.mode = "manual"` 会关闭自动显示。
- `closeBehavior = "hide"` 表示点击窗口关闭按钮后保留后台进程。

## 本地数据来源

Live Viewer 只读取本地文件：

- `~/.remodex/last-thread.json`
- `~/.codex/session_index.jsonl`
- `~/.codex/state_5.sqlite`
- `~/.codex/sessions/**/*.jsonl`
- `~/.remodex/logs/bridge.stdout.log`

启动同步会综合多个来源：

- Codex session index 用于线程排序和标题。
- Codex 本地 state database 用于最近线程元数据。
- Rollout JSONL 文件用于读取消息内容。
- `last-thread.json` 只作为最近活动提示，不作为唯一来源。

如果没有可用对话，tab 和底部跟随按钮会隐藏，消息区域显示空状态。

## 架构

应用主要分为三部分：

- 主进程：创建 Electron 窗口，加载配置，注册 IPC，读取 Codex 偏好，启动会话监听，并处理显式 show/hide 命令。
- 会话管线：发现最近线程，解析 rollout 文件路径，按 byte offset 增量读取 JSONL，解析可见消息，对镜像事件去重，并聚合生命周期/活跃状态。
- Renderer：渲染 tab、消息气泡、底部控制、窗口控制、跟随最新、展开状态、滚动锚点、主题和语言。

重要文件：

- `src/main.js`：Electron 入口和进程编排。
- `src/viewer-window.js`：BrowserWindow 创建和固定窗口行为。
- `src/service-manager.js`：LaunchAgent 安装、启动、停止和状态命令。
- `src/config.js`：配置默认值、合并、持久化和旧字段清理。
- `src/session-watcher.js`：会话状态更新协调器。
- `src/recent-thread-source.js`：从本地 Codex 数据源发现最近线程。
- `src/jsonl-tail-reader.js`：增量读取 JSONL。
- `src/jsonl-parser.js`：解析 Codex 事件并过滤用户可见消息。
- `public/renderer.js`：Renderer 编排入口。
- `public/message-list.js`：消息渲染和展开/收起。
- `public/thread-tabs.js`：线程 tab 和状态指示器渲染。

## 开发

运行语法检查和测试：

```bash
node --check src/*.js
node --check public/*.js
npm test
```

当前期望测试结果：

```text
76 tests passing
```
