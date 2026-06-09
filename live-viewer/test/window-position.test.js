const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultConfig } = require("../src/config");
const { calculateInitialWindowBounds } = require("../src/window-position");

test("uses saved absolute window position when available", () => {
  const config = createDefaultConfig("/Users/dizzy");
  config.positioning.lastPosition = { x: 123, y: 456 };

  const bounds = calculateInitialWindowBounds(config, {
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
  });

  assert.deepEqual(bounds, {
    x: 123,
    y: 456,
    width: 300,
    height: 600,
  });
});

test("defaults to primary work area vertical center with right inset", () => {
  const config = createDefaultConfig("/Users/dizzy");

  const bounds = calculateInitialWindowBounds(config, {
    x: 0,
    y: 25,
    width: 1440,
    height: 875,
  });

  assert.deepEqual(bounds, {
    x: 1125,
    y: 163,
    width: 300,
    height: 600,
  });
});

test("accounts for non-zero work area origin", () => {
  const config = createDefaultConfig("/Users/dizzy");
  config.positioning.screenRightInset = 15;

  const bounds = calculateInitialWindowBounds(config, {
    x: 1440,
    y: 50,
    width: 1280,
    height: 800,
  });

  assert.deepEqual(bounds, {
    x: 2405,
    y: 150,
    width: 300,
    height: 600,
  });
});
