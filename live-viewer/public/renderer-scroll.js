window.RemodexLiveViewerScroll = {
  captureTopAnchor(scroller, element) {
    return {
      type: "top",
      element,
      top: element.getBoundingClientRect().top,
      scrollTop: scroller.scrollTop,
    };
  },

  captureBottomAnchor(scroller, element) {
    return {
      type: "bottom",
      element,
      bottom: element.getBoundingClientRect().bottom,
      scrollTop: scroller.scrollTop,
    };
  },

  restoreAnchor(scroller, anchor) {
    const restore = () => {
      if (anchor.type === "top") {
        const delta = anchor.element.getBoundingClientRect().top - anchor.top;
        scroller.scrollTop = anchor.scrollTop + delta;
        return;
      }
      if (anchor.type === "bottom") {
        const delta = anchor.element.getBoundingClientRect().bottom - anchor.bottom;
        scroller.scrollTop = anchor.scrollTop + delta;
      }
    };
    restore();
    requestAnimationFrame(restore);
  },

  scrollToBottom(scroller) {
    requestAnimationFrame(() => {
      scroller.scrollTop = scroller.scrollHeight;
    });
  },
};
