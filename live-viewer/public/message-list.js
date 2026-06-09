window.RemodexLiveViewerMessageList = {
  render({
    container,
    thread,
    force = false,
    renderedState,
    ui,
    t,
    scroll,
    onCancelAutoFollow,
    onSignatureChange,
  }) {
    const items = thread?.items || [];
    const threadId = thread?.threadId || "";
    const signature = renderSignature(threadId, items, ui);
    if (!force && signature === renderedState.itemsSignature) {
      if (ui.followLatest) {
        scroll.scrollToBottom(container);
      }
      return renderedState;
    }

    const threadChanged = threadId !== renderedState.threadId;
    container.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = threadId ? t("waiting") : t("noThread");
      container.appendChild(empty);
      return { threadId, itemsSignature: signature };
    }

    for (const item of items) {
      container.appendChild(renderItem({
        item,
        items,
        threadId,
        ui,
        t,
        container,
        scroll,
        onCancelAutoFollow,
        onSignatureChange,
      }));
    }

    if (ui.followLatest) {
      scroll.scrollToBottom(container);
    } else if (threadChanged || force) {
      requestAnimationFrame(() => {
        container.scrollTop = ui.scrollTop;
      });
    }

    return { threadId, itemsSignature: signature };
  },

  renderSignature,
};

function renderItem({
  item,
  items,
  threadId,
  ui,
  t,
  container,
  scroll,
  onCancelAutoFollow,
  onSignatureChange,
}) {
  const row = document.createElement("article");
  row.className = `message message-${item.role}`;

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = labelForItem(item, t);

  const body = document.createElement("div");
  body.className = "message-body";

  const expanded = ui.expandedItems.has(item.id);
  const text = document.createElement("div");
  text.className = `message-text${expanded ? " is-expanded" : " is-collapsed"}`;
  text.textContent = item.text;
  const toggle = document.createElement("button");
  toggle.className = "text-toggle";
  toggle.type = "button";
  toggle.hidden = true;
  toggle.textContent = expanded ? t("collapse") : t("expand");
  toggle.addEventListener("click", () => {
    const nextExpanded = !ui.expandedItems.has(item.id);
    const anchor = nextExpanded
      ? scroll.captureTopAnchor(container, body)
      : scroll.captureBottomAnchor(container, row);
    if (nextExpanded) {
      ui.expandedItems.add(item.id);
      onCancelAutoFollow();
    } else {
      ui.expandedItems.delete(item.id);
    }
    text.classList.toggle("is-expanded", nextExpanded);
    text.classList.toggle("is-collapsed", !nextExpanded);
    toggle.textContent = nextExpanded ? t("collapse") : t("expand");
    onSignatureChange(renderSignature(threadId, items, ui));
    scroll.restoreAnchor(container, anchor);
  });
  body.append(text, toggle);
  requestAnimationFrame(() => {
    const canExpand = text.scrollHeight > text.clientHeight + 1 || expanded;
    toggle.hidden = !canExpand;
  });

  row.append(label, body);
  return row;
}

function labelForItem(item, t) {
  if (item.role === "user") {
    return t("user");
  }
  if (item.role === "assistant") {
    return t("assistant");
  }
  return t("status");
}

function renderSignature(threadId, items, ui) {
  return `${threadId}:${items.map((item) => item.id).join("|")}:${expandedSignature(ui)}`;
}

function expandedSignature(ui) {
  return Array.from(ui.expandedItems).sort().join(",");
}
