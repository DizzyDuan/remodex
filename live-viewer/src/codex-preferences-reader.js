const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CANDIDATE_PATHS = [
  path.join("Library", "Application Support", "Codex", "Preferences.json"),
  path.join("Library", "Application Support", "Codex", "config.json"),
  path.join(".codex", "config.json"),
  path.join(".codex", "preferences.json"),
  path.join(".codex", "config.toml"),
];

function readCodexPreferences(homeDir = os.homedir()) {
  let preferences = {};
  for (const relativePath of CANDIDATE_PATHS) {
    const candidate = path.join(homeDir, relativePath);
    const value = readPreferenceFile(candidate);
    if (value && Object.keys(value).length) {
      preferences = {
        ...preferences,
        ...value,
      };
    }
  }
  return preferences;
}

function readPreferenceFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = filePath.endsWith(".toml") ? parseTomlPreferences(raw) : JSON.parse(raw);
    return extractPreferences(parsed);
  } catch {
    return null;
  }
}

function extractPreferences(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const theme = firstString(
    value.theme,
    value.colorTheme,
    value.appearance,
    value.window?.theme,
    value.desktop?.appearanceTheme,
    value.desktop?.theme,
    value.preferences?.theme,
    value.settings?.theme
  );
  const locale = firstString(
    value.locale,
    value.language,
    value.preferences?.locale,
    value.preferences?.language,
    value.settings?.locale,
    value.settings?.language
  );

  return {
    ...(theme ? { theme } : {}),
    ...(locale ? { locale } : {}),
  };
}

function parseTomlPreferences(raw) {
  const result = {};
  let section = result;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionForPath(result, sectionMatch[1].trim());
      continue;
    }

    const assignmentMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!assignmentMatch) {
      continue;
    }

    const value = parseTomlString(assignmentMatch[2]);
    if (value) {
      section[assignmentMatch[1]] = value;
    }
  }

  return result;
}

function sectionForPath(root, sectionPath) {
  return sectionPath.split(".").reduce((current, part) => {
    current[part] = current[part] && typeof current[part] === "object" ? current[part] : {};
    return current[part];
  }, root);
}

function parseTomlString(value) {
  const trimmed = value.trim();
  const quoted = trimmed.match(/^"([^"]*)"/) || trimmed.match(/^'([^']*)'/);
  if (quoted) {
    return quoted[1].trim();
  }
  return trimmed.split("#")[0].trim();
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

module.exports = {
  extractPreferences,
  parseTomlPreferences,
  readCodexPreferences,
};
