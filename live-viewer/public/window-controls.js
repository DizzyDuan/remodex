window.RemodexLiveViewerWindowControls = {
  setup({ bridge, elements, state, t, toScreenPoint }) {
    elements.alwaysOnTopButton.addEventListener("click", async () => {
      state.alwaysOnTop = await bridge.toggleAlwaysOnTop();
      this.updateAlwaysOnTopButton({ elements, state, t });
    });
    elements.hideButton.addEventListener("click", () => bridge.closeWindow());
    setupHeaderDrag({ bridge, toScreenPoint });
  },

  updateAlwaysOnTopButton({ elements, state, t }) {
    const key = state.alwaysOnTop ? "disableAlwaysOnTop" : "enableAlwaysOnTop";
    elements.alwaysOnTopButton.classList.toggle("is-active", state.alwaysOnTop);
    elements.alwaysOnTopButton.title = t(key);
    elements.alwaysOnTopButton.setAttribute("aria-label", t(key));
    elements.alwaysOnTopButton.setAttribute("aria-pressed", state.alwaysOnTop ? "true" : "false");
  },
};

function setupHeaderDrag({ bridge, toScreenPoint }) {
  const header = document.querySelector(".header");
  let isDragging = false;

  header.addEventListener("pointerdown", async (event) => {
    if (event.button !== 0 || event.target.closest("button")) {
      return;
    }

    event.preventDefault();
    isDragging = true;
    header.setPointerCapture(event.pointerId);
    await bridge.beginDrag(toScreenPoint(event));
  });

  header.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    event.preventDefault();
    bridge.dragWindow(toScreenPoint(event));
  });

  function finishDrag(event) {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    if (header.hasPointerCapture(event.pointerId)) {
      header.releasePointerCapture(event.pointerId);
    }
    bridge.endDrag();
  }

  header.addEventListener("pointerup", finishDrag);
  header.addEventListener("pointercancel", finishDrag);
}
