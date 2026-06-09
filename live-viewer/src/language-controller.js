const DEFAULT_SUPPORTED_LOCALES = ["en-US", "zh-CN"];
const DEFAULT_LOCALE = "en-US";

function normalizeLocale(locale, options = {}) {
  const supportedLocales = options.supportedLocales || DEFAULT_SUPPORTED_LOCALES;
  const defaultLocale = options.defaultLocale || DEFAULT_LOCALE;

  if (!locale || typeof locale !== "string") {
    return defaultLocale;
  }

  const normalized = locale.replace("_", "-");
  const lower = normalized.toLowerCase();

  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") {
    return supportedLocales.includes("zh-CN") ? "zh-CN" : defaultLocale;
  }

  if (lower === "en" || lower === "en-us") {
    return supportedLocales.includes("en-US") ? "en-US" : defaultLocale;
  }

  const direct = supportedLocales.find((item) => item.toLowerCase() === lower);
  return direct || defaultLocale;
}

function resolveLocale({
  codexLocale,
  systemLocale,
  supportedLocales = DEFAULT_SUPPORTED_LOCALES,
  defaultLocale = DEFAULT_LOCALE,
} = {}) {
  const options = { supportedLocales, defaultLocale };
  if (codexLocale) {
    return normalizeLocale(codexLocale, options);
  }
  return normalizeLocale(systemLocale, options);
}

function createLanguageController({ app, preferencesReader, config }) {
  const i18n = config.i18n || {};

  function getLocale() {
    const preferences = preferencesReader?.readCodexPreferences?.() || {};
    return resolveLocale({
      codexLocale: preferences.locale || preferences.language,
      systemLocale: app?.getLocale?.(),
      supportedLocales: i18n.supportedLocales || DEFAULT_SUPPORTED_LOCALES,
      defaultLocale: i18n.defaultLocale || DEFAULT_LOCALE,
    });
  }

  return { getLocale };
}

module.exports = {
  createLanguageController,
  normalizeLocale,
  resolveLocale,
};
