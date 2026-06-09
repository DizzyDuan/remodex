const AUTO_SELECT_DEBOUNCE_MS = 1200;

window.RemodexLiveViewerState = {
  createThreadUiStore() {
    const threadUi = new Map();

    function getThreadUi(threadId) {
      const id = threadId || "__empty__";
      if (!threadUi.has(id)) {
        threadUi.set(id, {
          followLatest: true,
          scrollTop: 0,
          expandedItems: new Set(),
        });
      }
      return threadUi.get(id);
    }

    return {
      getThreadUi,
    };
  },

  emptyRendererState() {
    return {
      selectionMode: "auto",
      selectedThreadId: "",
      autoSelectedThreadId: "",
      pendingLatestThreadId: "",
      pendingLatestSince: 0,
    };
  },

  syncAutoSelection(state, {
    now = Date.now(),
    threadById,
    debounceMs = AUTO_SELECT_DEBOUNCE_MS,
  } = {}) {
    if (state.selectionMode === "locked" && threadById(state.selectedThreadId)) {
      return;
    }

    if (state.selectionMode === "locked") {
      state.selectionMode = "auto";
      state.selectedThreadId = "";
    }

    const latestThreadId = state.session.latestThreadId || state.session.threadId || "";
    if (!latestThreadId || !threadById(latestThreadId)) {
      if (!threadById(state.autoSelectedThreadId)) {
        state.autoSelectedThreadId = "";
      }
      state.pendingLatestThreadId = "";
      state.pendingLatestSince = 0;
      return;
    }

    if (!state.autoSelectedThreadId || !threadById(state.autoSelectedThreadId)) {
      state.autoSelectedThreadId = latestThreadId;
      state.pendingLatestThreadId = "";
      state.pendingLatestSince = 0;
      return;
    }

    if (state.autoSelectedThreadId === latestThreadId) {
      state.pendingLatestThreadId = "";
      state.pendingLatestSince = 0;
      return;
    }

    if (state.pendingLatestThreadId !== latestThreadId) {
      state.pendingLatestThreadId = latestThreadId;
      state.pendingLatestSince = now;
      return;
    }

    if (now - state.pendingLatestSince >= debounceMs) {
      state.autoSelectedThreadId = latestThreadId;
      state.pendingLatestThreadId = "";
      state.pendingLatestSince = 0;
    }
  },

  activeThreadId(state, threadById) {
    if (state.selectionMode === "locked" && threadById(state.selectedThreadId)) {
      return state.selectedThreadId;
    }
    if (threadById(state.autoSelectedThreadId)) {
      return state.autoSelectedThreadId;
    }
    return state.session.latestThreadId || state.session.threadId || "";
  },

  fallbackThread(session) {
    if (!session.threadId && !(session.items || []).length) {
      return null;
    }
    return {
      status: session.status,
      threadId: session.threadId,
      title: session.title,
      taskStatus: session.taskStatus,
      items: session.items || [],
    };
  },

  shouldShowThreadControls(session) {
    return Boolean(session?.threads?.length);
  },

  tabsSignature(threads, selectedId, latestId) {
    return (threads || []).map((thread) => [
      thread.threadId || "",
      thread.title || "",
      thread.status || "",
      thread.taskStatus || "",
      thread.threadId === selectedId ? "active" : "",
      thread.threadId === latestId ? "latest" : "",
    ].join(":")).join("|");
  },

  emptySession() {
    return {
      status: "disconnected",
      latestThreadId: "",
      activeThreadId: "",
      threadId: "",
      title: "",
      taskStatus: "idle",
      items: [],
      threads: [],
    };
  },

  normalizeSession(session) {
    if (!session || typeof session !== "object") {
      return this.emptySession();
    }
    const threads = Array.isArray(session.threads) ? session.threads : [];
    return {
      ...this.emptySession(),
      ...session,
      threads,
    };
  },
};
