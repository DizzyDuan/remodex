window.RemodexLiveViewerI18n = {
  messages: {
    "en-US": {
      appTitle: "Remodex",
      live: "Live",
      stale: "Stale",
      disconnected: "Disconnected",
      stopFollowing: "Stop following",
      resumeFollowing: "Resume following",
      hide: "Hide",
      enableAlwaysOnTop: "Keep on top",
      disableAlwaysOnTop: "Stop keeping on top",
      expand: "Expand",
      collapse: "Collapse",
      noThread: "No active thread",
      waiting: "Waiting for local activity",
      untitled: "Untitled chat",
      taskIdle: "Idle",
      taskRunning: "Running",
      taskComplete: "Complete",
      user: "You",
      assistant: "Codex",
      status: "Status"
    },
    "zh-CN": {
      appTitle: "Remodex",
      live: "实时",
      stale: "已停滞",
      disconnected: "未连接",
      stopFollowing: "取消跟随",
      resumeFollowing: "继续跟随",
      hide: "隐藏",
      enableAlwaysOnTop: "置顶窗口",
      disableAlwaysOnTop: "取消置顶",
      expand: "展开",
      collapse: "收起",
      noThread: "暂无活动线程",
      waiting: "等待本地活动",
      untitled: "未命名对话",
      taskIdle: "空闲",
      taskRunning: "运行中",
      taskComplete: "已完成",
      user: "你",
      assistant: "Codex",
      status: "状态"
    }
  },
  translate(locale, key) {
    const messages = this.messages[locale] || this.messages["en-US"];
    return messages[key] || this.messages["en-US"][key] || key;
  }
};
