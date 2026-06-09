function normalizeTheme(theme) {
  if (typeof theme !== "string") {
    return null;
  }

  const lower = theme.toLowerCase();
  if (lower.includes("dark")) {
    return "dark";
  }
  if (lower.includes("light")) {
    return "light";
  }
  return null;
}

function resolveTheme({ codexTheme, shouldUseDarkColors } = {}) {
  return normalizeTheme(codexTheme) || (shouldUseDarkColors ? "dark" : "light");
}

function createThemeController({ nativeTheme, preferencesReader }) {
  const listeners = new Set();

  function getTheme() {
    const preferences = preferencesReader?.readCodexPreferences?.() || {};
    return resolveTheme({
      codexTheme: preferences.theme,
      shouldUseDarkColors: nativeTheme?.shouldUseDarkColors !== false,
    });
  }

  function notify() {
    const theme = getTheme();
    for (const listener of listeners) {
      listener(theme);
    }
  }

  nativeTheme?.on?.("updated", notify);

  return {
    getTheme,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

module.exports = {
  createThemeController,
  normalizeTheme,
  resolveTheme,
};
