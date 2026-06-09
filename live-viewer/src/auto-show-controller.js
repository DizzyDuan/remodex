function shouldAutoShowForSession({
  state = {},
  config = {},
  startedAtMs = 0,
  lastAutoShowAtMs = 0,
  lastAutoShowActivityKey = "",
  lastManualHideAtMs = 0,
  nowMs = Date.now(),
} = {}) {
  const autoShow = config.autoShow || {};
  if (autoShow.mode !== "on-phone-request") {
    return false;
  }

  if (!state.threadId || state.activeSource !== "phone") {
    return false;
  }

  const activityKey = sessionActivityKey(state);
  if (activityKey && activityKey === lastAutoShowActivityKey) {
    return false;
  }

  if (!Number.isFinite(state.activeUpdatedAtMs) || state.activeUpdatedAtMs < startedAtMs) {
    return false;
  }

  const cooldownMs = Number.isFinite(autoShow.cooldownMs) ? autoShow.cooldownMs : 1500;
  if (lastAutoShowAtMs && nowMs - lastAutoShowAtMs < cooldownMs) {
    return false;
  }

  const respectManualHideMs = Number.isFinite(autoShow.respectManualHideMs)
    ? autoShow.respectManualHideMs
    : 0;
  if (respectManualHideMs > 0 && lastManualHideAtMs && nowMs - lastManualHideAtMs < respectManualHideMs) {
    return false;
  }

  return true;
}

function sessionActivityKey(state = {}) {
  if (!state.threadId || !Number.isFinite(state.activeUpdatedAtMs)) {
    return "";
  }
  return `${state.threadId}:${state.activeUpdatedAtMs}`;
}

module.exports = {
  sessionActivityKey,
  shouldAutoShowForSession,
};
