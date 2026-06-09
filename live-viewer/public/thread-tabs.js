window.RemodexLiveViewerThreadTabs = {
  render({ container, threads, selectedId, latestId, t, onSelect }) {
    container.replaceChildren();

    for (const thread of threads) {
      const button = document.createElement("button");
      button.className = "thread-tab";
      button.type = "button";
      button.disabled = !thread.threadId;
      button.dataset.active = thread.threadId === selectedId ? "true" : "false";
      button.dataset.latest = thread.threadId === latestId ? "true" : "false";
      button.title = tabTitle(thread, t);
      button.append(
        tabIndicatorStack(thread, t),
        tabTitleText(thread, t)
      );
      button.addEventListener("click", () => {
        if (thread.threadId) {
          onSelect(thread.threadId);
        }
      });
      container.appendChild(button);
    }
  },

  taskStatusLabel,
};

function tabIndicatorStack(thread, t) {
  const stack = document.createElement("span");
  stack.className = "tab-indicator-stack";
  stack.append(tabTaskIndicator(thread, t), tabStatusDot(thread, t));
  return stack;
}

function tabStatusDot(thread, t) {
  const dot = document.createElement("span");
  dot.className = "tab-status-dot";
  dot.dataset.status = thread.status || "disconnected";
  dot.title = t(thread.status || "disconnected");
  return dot;
}

function tabTitleText(thread, t) {
  const label = document.createElement("span");
  label.className = "tab-title";
  label.textContent = truncateTabTitle(thread.title || shortThreadId(thread.threadId, t), t);
  return label;
}

function tabTaskIndicator(thread, t) {
  const indicator = document.createElement("span");
  const taskStatus = thread.taskStatus || "idle";
  indicator.className = "tab-task-indicator";
  indicator.dataset.task = taskStatus;
  indicator.title = taskStatusLabel(taskStatus, t);
  return indicator;
}

function tabTitle(thread, t) {
  const title = thread.title || shortThreadId(thread.threadId, t);
  return `${title} · ${t(thread.status || "disconnected")} · ${taskStatusLabel(thread.taskStatus, t)}`;
}

function truncateTabTitle(title, t) {
  const chars = Array.from(title || t("untitled"));
  return chars.length > 10 ? `${chars.slice(0, 10).join("")}…` : chars.join("");
}

function taskStatusLabel(taskStatus, t) {
  if (taskStatus === "running") {
    return t("taskRunning");
  }
  if (taskStatus === "complete") {
    return t("taskComplete");
  }
  return t("taskIdle");
}

function shortThreadId(threadId, t) {
  return threadId ? threadId.slice(0, 8) : t("untitled");
}
