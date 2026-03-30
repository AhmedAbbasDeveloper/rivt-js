import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { Layer, LibraryRestriction, RivtConfig } from "./models.js";

export const DEFAULT_CAN_IMPORT: Record<string, string[]> = {
  pages: ["components", "hooks", "services", "utils", "types", "stores"],
  components: ["hooks", "utils", "types", "stores"],
  hooks: ["services", "utils", "types", "stores"],
  services: ["utils", "types"],
  utils: ["types"],
  types: [],
  stores: ["services", "utils", "types"],
  contexts: ["hooks", "services", "utils", "types", "stores"],
};

const REACT_RESTRICTED_TO = [
  "components",
  "hooks",
  "pages",
  "stores",
  "contexts",
];

interface RawLayerConfig {
  paths?: string | string[];
  can_import?: string[];
}

interface RawConfig {
  http_client?: string;
  config_module?: string | string[];
  exclude?: string[];
  disable?: string[];
  plugins?: string[];
  layers?: Record<string, RawLayerConfig>;
  libraries?: Record<string, { allowed_in: string[] }>;
}

function findConfigFile(startDir: string): RawConfig | null {
  let dir = resolve(startDir);

  while (true) {
    const jsonPath = resolve(dir, "rivt.config.json");
    if (existsSync(jsonPath)) {
      return JSON.parse(readFileSync(jsonPath, "utf-8")) as RawConfig;
    }

    const pkgPath = resolve(dir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<
        string,
        unknown
      >;
      if (pkg["rivt"]) {
        return pkg["rivt"] as RawConfig;
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

function buildLayers(
  rawLayers: Record<string, RawLayerConfig>,
): Record<string, Layer> {
  const layers: Record<string, Layer> = {};

  for (const [name, raw] of Object.entries(rawLayers)) {
    const paths = raw.paths
      ? Array.isArray(raw.paths)
        ? raw.paths
        : [raw.paths]
      : [];

    if (paths.length === 0) continue;

    const canImport = raw.can_import ?? [];

    layers[name] = { name, paths, canImport };
  }

  return layers;
}

function buildLibraries(raw: RawConfig): Record<string, LibraryRestriction> {
  const libs: Record<string, LibraryRestriction> = {};

  libs["react"] = { allowedIn: REACT_RESTRICTED_TO };
  libs["react-dom"] = { allowedIn: REACT_RESTRICTED_TO };

  if (raw.http_client) {
    libs[raw.http_client] = { allowedIn: ["services"] };
  }

  if (raw.libraries) {
    for (const [name, conf] of Object.entries(raw.libraries)) {
      libs[name] = { allowedIn: conf.allowed_in };
    }
  }

  return libs;
}

export function loadConfig(startDir: string): RivtConfig | null {
  const raw = findConfigFile(startDir);
  if (!raw) return null;

  const configModule = raw.config_module
    ? Array.isArray(raw.config_module)
      ? raw.config_module
      : [raw.config_module]
    : [];

  const layers = raw.layers ? buildLayers(raw.layers) : {};
  const libraries = buildLibraries(raw);

  return {
    httpClient: raw.http_client,
    configModule,
    exclude: raw.exclude ?? [],
    disable: raw.disable ?? [],
    plugins: raw.plugins ?? [],
    layers,
    libraries,
  };
}

export function getLayer(filePath: string, config: RivtConfig): Layer | null {
  const normalized = filePath.replace(/\\/g, "/");

  let best: Layer | null = null;
  let bestLen = -1;

  for (const layer of Object.values(config.layers)) {
    for (const pattern of layer.paths) {
      const patternNorm = pattern.replace(/\\/g, "/");
      if (
        matchesPattern(normalized, patternNorm) &&
        patternNorm.length > bestLen
      ) {
        bestLen = patternNorm.length;
        best = layer;
      }
    }
  }

  return best;
}

export function isConfigModule(filePath: string, config: RivtConfig): boolean {
  if (config.configModule.length === 0) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return config.configModule.some((pattern) =>
    matchesPattern(normalized, pattern.replace(/\\/g, "/")),
  );
}

export function matchesPattern(filePath: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    const regex = getCachedGlobRegex(pattern);
    return regex.test(filePath);
  }
  return filePath === pattern || filePath.startsWith(pattern + "/");
}

const globRegexCache = new Map<string, RegExp>();

function getCachedGlobRegex(glob: string): RegExp {
  let regex = globRegexCache.get(glob);
  if (!regex) {
    regex = globToRegex(glob);
    globRegexCache.set(glob, regex);
  }
  return regex;
}

function globToRegex(glob: string): RegExp {
  let regex = "";
  let i = 0;
  while (i < glob.length) {
    const ch = glob.charAt(i);
    if (ch === "*" && glob.charAt(i + 1) === "*") {
      if (glob.charAt(i + 2) === "/") {
        regex += "(?:.+/)?";
        i += 3;
      } else {
        regex += ".*";
        i += 2;
      }
    } else if (ch === "*") {
      regex += "[^/]*";
      i++;
    } else if (ch === "?") {
      regex += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(ch)) {
      regex += "\\" + ch;
      i++;
    } else {
      regex += ch;
      i++;
    }
  }
  return new RegExp("^" + regex + "$");
}
