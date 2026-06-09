const assert = require("node:assert/strict");
const test = require("node:test");

const { parseJsonlLine } = require("../src/jsonl-parser");

test("parses user message events", () => {
  const [item] = parseJsonlLine(JSON.stringify({
    timestamp: "2026-06-04T08:00:00.000Z",
    type: "event_msg",
    payload: {
      type: "user_message",
      message: "hello",
      turn_id: "turn-1",
    },
  }));

  assert.equal(item.role, "user");
  assert.equal(item.text, "hello");
  assert.equal(item.turnId, "turn-1");
});

test("parses assistant response message items", () => {
  const [item] = parseJsonlLine(JSON.stringify({
    timestamp: "2026-06-04T08:00:01.000Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "done" }],
    },
  }));

  assert.equal(item.role, "assistant");
  assert.equal(item.text, "done");
});

test("ignores non-chat response message roles", () => {
  assert.deepEqual(parseJsonlLine(JSON.stringify({
    timestamp: "2026-06-04T08:00:01.000Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "developer",
      content: [{ type: "input_text", text: "internal instructions" }],
    },
  })), []);
});

test("ignores synthetic environment context user messages", () => {
  assert.deepEqual(parseJsonlLine(JSON.stringify({
    timestamp: "2026-06-04T08:00:01.000Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "<environment_context>\n  <cwd>/tmp</cwd>\n</environment_context>" }],
    },
  })), []);
});

test("ignores tool calls and tool outputs", () => {
  assert.deepEqual(parseJsonlLine(JSON.stringify({
    timestamp: "2026-06-04T08:00:02.000Z",
    type: "response_item",
    payload: {
      type: "function_call",
      name: "shell",
      arguments: "{\"cmd\":\"ls\"}",
      call_id: "call-1",
    },
  })), []);

  assert.deepEqual(parseJsonlLine(JSON.stringify({
    timestamp: "2026-06-04T08:00:03.000Z",
    type: "response_item",
    payload: {
      type: "function_call_output",
      call_id: "call-1",
      output: "command output",
    },
  })), []);
});

test("bad JSON and unknown events are ignored", () => {
  assert.deepEqual(parseJsonlLine("{bad json"), []);
  assert.deepEqual(parseJsonlLine(JSON.stringify({ type: "session_meta", payload: {} })), []);
});
