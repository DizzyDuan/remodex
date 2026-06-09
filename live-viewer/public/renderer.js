(async function boot() {
  const bridge = window.remodexLiveViewer;
  const i18n = window.RemodexLiveViewerI18n;
  const scroll = window.RemodexLiveViewerScroll;
  const stateHelpers = window.RemodexLiveViewerState;
  const windowControls = window.RemodexLiveViewerWindowControls;
  const threadTabs = window.RemodexLiveViewerThreadTabs;
  const messageList = window.RemodexLiveViewerMessageList;
  const threadUiStore = stateHelpers.createThreadUiStore();

  const state = {
    locale: "en-US",
    theme: "dark",
    session: stateHelpers.emptySession(),
    ...stateHelpers.emptyRendererState(),
    renderedThreadId: "",
    renderedItemsSignature: "",
    renderedTabsSignature: "",
    alwaysOnTop: true,
  };

  const elements = {
    root: document.documentElement,
    threadTabs: document.getElementById("threadTabs"),
    messageList: document.getElementById("messageList"),
    footer: document.querySelector(".footer"),
    followButton: document.getElementById("followButton"),
    alwaysOnTopButton: document.getElementById("alwaysOnTopButton"),
    hideButton: document.getElementById("hideButton"),
  };

  const initial = await bridge.getInitialState();
  state.locale = initial.locale || state.locale;
  state.theme = initial.theme || state.theme;
  state.session = normalizeSession(initial.session);
  state.alwaysOnTop = initial.config?.positioning?.alwaysOnTop !== false;
  syncAutoSelection();

  applyTheme();
  applyLocale();
  updateAlwaysOnTopButton();
  renderSession(true);

  bridge.onSession((session) => {
    saveCurrentScroll();
    state.session = normalizeSession(session);
    syncAutoSelection();
    renderSession();
  });

  bridge.onTheme((theme) => {
    state.theme = theme || "dark";
    applyTheme();
  });

  bridge.onLanguage((locale) => {
    state.locale = locale || state.locale;
    applyLocale();
    renderSession(true);
  });

  elements.followButton.addEventListener("click", () => {
    saveCurrentScroll({ force: true });
    const ui = currentThreadUi();
    ui.followLatest = !ui.followLatest;
    if (ui.followLatest) {
      scrollToBottom();
    } else {
      ui.scrollTop = elements.messageList.scrollTop;
    }
    updateFooterLabels();
  });

  elements.messageList.addEventListener("scroll", () => {
    const ui = currentThreadUi();
    if (!ui.followLatest) {
      ui.scrollTop = elements.messageList.scrollTop;
    }
  });
  elements.messageList.addEventListener("wheel", preventManualScrollWhileFollowing, { passive: false });
  elements.messageList.addEventListener("touchmove", preventManualScrollWhileFollowing, { passive: false });
  document.addEventListener("wheel", (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  }, { passive: false });

  windowControls.setup({ bridge, elements, state, t, toScreenPoint });

  function toScreenPoint(event) {
    return {
      screenX: event.screenX,
      screenY: event.screenY,
    };
  }

  function applyTheme() {
    elements.root.dataset.theme = state.theme === "light" ? "light" : "dark";
  }

  function applyLocale() {
    elements.root.lang = state.locale;
    for (const element of document.querySelectorAll("[data-i18n]")) {
      element.textContent = t(element.dataset.i18n);
    }
    elements.hideButton.title = t("hide");
    elements.hideButton.setAttribute("aria-label", t("hide"));
    updateAlwaysOnTopButton();
    updateFooterLabels();
  }

  function updateAlwaysOnTopButton() {
    windowControls.updateAlwaysOnTopButton({ elements, state, t });
  }

  function renderSession(forceMessages = false) {
    updateThreadControlsVisibility();
    const thread = activeThread();
    renderThreadTabs();
    renderMessages(thread, forceMessages);
    updateFooterLabels();
  }

  function syncAutoSelection() {
    stateHelpers.syncAutoSelection(state, {
      threadById,
    });
  }

  function updateThreadControlsVisibility() {
    const shouldShow = stateHelpers.shouldShowThreadControls(state.session);
    elements.threadTabs.hidden = !shouldShow;
    elements.footer.hidden = !shouldShow;
  }

  function renderThreadTabs() {
    const threads = visibleThreads();
    const selectedId = activeThreadId();
    const signature = stateHelpers.tabsSignature(threads, selectedId, state.session.latestThreadId);
    if (signature === state.renderedTabsSignature) {
      return;
    }

    state.renderedTabsSignature = signature;
    threadTabs.render({
      container: elements.threadTabs,
      threads,
      selectedId,
      latestId: state.session.latestThreadId,
      t,
      onSelect(threadId) {
        saveCurrentScroll({ force: true });
        state.selectionMode = "locked";
        state.selectedThreadId = threadId;
        state.autoSelectedThreadId = threadId;
        state.pendingLatestThreadId = "";
        state.pendingLatestSince = 0;
        renderSession(true);
      },
    });
  }

  function visibleThreads() {
    const threads = state.session.threads || [];
    if (threads.length) {
      return threads;
    }
    const fallback = fallbackThread();
    if (fallback?.threadId) {
      return [fallback];
    }
    return [];
  }

  function renderMessages(thread, force = false) {
    const threadId = thread?.threadId || "";
    const ui = getThreadUi(threadId);
    const rendered = messageList.render({
      container: elements.messageList,
      thread,
      force,
      renderedState: {
        threadId: state.renderedThreadId,
        itemsSignature: state.renderedItemsSignature,
      },
      ui,
      t,
      scroll,
      onCancelAutoFollow: cancelAutoFollowForExpansion,
      onSignatureChange(signature) {
        state.renderedItemsSignature = signature;
      },
    });
    state.renderedThreadId = rendered.threadId;
    state.renderedItemsSignature = rendered.itemsSignature;
  }

  function cancelAutoFollowForExpansion() {
    const ui = currentThreadUi();
    saveCurrentScroll({ force: true });
    ui.followLatest = false;
    lockToCurrentThread();
    elements.followButton.classList.toggle("is-active", false);
    elements.messageList.classList.remove("is-following");
    elements.followButton.textContent = t("resumeFollowing");
    elements.followButton.title = t("resumeFollowing");
  }

  function lockToCurrentThread() {
    const threadId = activeThreadId();
    if (!threadId) {
      return;
    }
    state.selectionMode = "locked";
    state.selectedThreadId = threadId;
  }

  function updateFooterLabels() {
    const ui = currentThreadUi();
    const key = ui.followLatest ? "stopFollowing" : "resumeFollowing";
    elements.followButton.classList.toggle("is-active", ui.followLatest);
    elements.messageList.classList.toggle("is-following", ui.followLatest);
    elements.followButton.textContent = t(key);
    elements.followButton.title = t(key);
  }

  function activeThread() {
    const id = activeThreadId();
    return threadById(id) || fallbackThread();
  }

  function activeThreadId() {
    return stateHelpers.activeThreadId(state, threadById);
  }

  function threadById(threadId) {
    return (state.session.threads || []).find((thread) => thread.threadId === threadId) || null;
  }

  function fallbackThread() {
    return stateHelpers.fallbackThread(state.session);
  }

  function currentThreadUi() {
    return getThreadUi(activeThreadId());
  }

  function getThreadUi(threadId) {
    return threadUiStore.getThreadUi(threadId);
  }

  function saveCurrentScroll({ force = false } = {}) {
    const ui = currentThreadUi();
    if (force || !ui.followLatest) {
      ui.scrollTop = elements.messageList.scrollTop;
    }
  }

  function scrollToBottom() {
    scroll.scrollToBottom(elements.messageList);
  }

  function preventManualScrollWhileFollowing(event) {
    if (currentThreadUi().followLatest) {
      event.preventDefault();
    }
  }

  function normalizeSession(session) {
    return stateHelpers.normalizeSession(session);
  }

  function t(key) {
    return i18n.translate(state.locale, key);
  }
})();
