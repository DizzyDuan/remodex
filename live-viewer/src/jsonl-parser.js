const crypto = require("node:crypto");

function parseJsonlLine(line) {
  if (!line || !line.trim()) {
    return [];
  }

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return [];
  }

  const timestamp = event.timestamp || new Date().toISOString();
  const payload = event.payload || {};

  if (event.type === "event_msg") {
    return parseEventMessage(payload, timestamp);
  }

  if (event.type === "response_item") {
    return parseResponseItem(payload, timestamp);
  }

  return [];
}

function parseEventMessage(payload, timestamp) {
  const type = payload.type || payload.event_type;
  const turnId = payload.turn_id || payload.turnId;

  if (type === "user_message") {
    return [makeItem({
      role: "user",
      kind: "message",
      text: extractText(payload.message || payload.text || payload.content),
      timestamp,
      turnId,
    })].filter(hasText);
  }

  if (type === "agent_message") {
    return [makeItem({
      role: "assistant",
      kind: "message",
      text: extractText(payload.message || payload.text || payload.content),
      timestamp,
      turnId,
    })].filter(hasText);
  }

  if (type === "task_started") {
    return [makeItem({
      role: "status",
      kind: "lifecycle",
      text: "Task started",
      timestamp,
      turnId,
    })];
  }

  if (type === "task_complete") {
    return [makeItem({
      role: "status",
      kind: "lifecycle",
      text: "Task complete",
      timestamp,
      turnId,
    })];
  }

  if (type === "token_count") {
    const text = formatTokenCount(payload);
    return text ? [makeItem({ role: "status", kind: "usage", text, timestamp, turnId })] : [];
  }

  return [];
}

function parseResponseItem(payload, timestamp) {
  const type = payload.type;
  const turnId = payload.turn_id || payload.turnId;

  if (type === "message") {
    if (payload.role !== "assistant" && payload.role !== "user") {
      return [];
    }

    return [makeItem({
      role: payload.role === "user" ? "user" : "assistant",
      kind: "message",
      text: extractText(payload.content),
      timestamp,
      turnId,
    })].filter(hasText).filter(isUserVisibleMessage);
  }

  if (type === "function_call") {
    return [];
  }

  if (type === "function_call_output") {
    return [];
  }

  return [];
}

function makeItem({ role, text, timestamp, turnId, kind }) {
  const cleanText = typeof text === "string" ? text.trim() : "";
  return {
    id: stableId({ role, text: cleanText, timestamp, turnId, kind }),
    role,
    text: cleanText,
    timestamp,
    ...(turnId ? { turnId } : {}),
    ...(kind ? { kind } : {}),
  };
}

function stableId(value) {
  return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function hasText(item) {
  return Boolean(item.text);
}

function isUserVisibleMessage(item) {
  if (item.role !== "user") {
    return true;
  }
  return !item.text.startsWith("<environment_context>")
    && !item.text.startsWith("<developer_instructions>")
    && !item.text.startsWith("<skills_instructions>")
    && !item.text.startsWith("<plugins_instructions>");
}

function extractText(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }
    if (typeof value.content === "string") {
      return value.content;
    }
    if (Array.isArray(value.content)) {
      return extractText(value.content);
    }
    if (typeof value.output === "string") {
      return value.output;
    }
    return "";
  }

  return "";
}

function formatTokenCount(payload) {
  const used = payload.tokensUsed || payload.tokens_used || payload.total_tokens;
  const limit = payload.tokenLimit || payload.token_limit;
  if (!used && !limit) {
    return "";
  }
  return limit ? `${used || 0}/${limit} tokens` : `${used} tokens`;
}

module.exports = {
  isUserVisibleMessage,
  parseJsonlLine,
};
