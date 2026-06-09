function calculateInitialWindowBounds(config, workArea) {
  const width = config.positioning.width;
  const height = config.positioning.height;
  const lastPosition = config.positioning.lastPosition;

  if (isPosition(lastPosition)) {
    return {
      x: lastPosition.x,
      y: lastPosition.y,
      width,
      height,
    };
  }

  return {
    x: Math.round(workArea.x + workArea.width - width - config.positioning.screenRightInset),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  };
}

function isPosition(value) {
  return value
    && Number.isFinite(value.x)
    && Number.isFinite(value.y);
}

module.exports = {
  calculateInitialWindowBounds,
};
