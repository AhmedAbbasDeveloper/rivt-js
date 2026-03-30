import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, resolve } from "node:path";

import type { RivtConfig } from "./models.js";
import { RivtError } from "./models.js";
import type { Rule } from "./rules/base.js";
import { builtinRules } from "./rules/index.js";

const BUILTIN_IDS = new Set(builtinRules.map((r) => r.id));

export function loadPluginRules(rootDir: string, config: RivtConfig): Rule[] {
  const rules: Rule[] = [];

  const localRules = loadLocalRules(rootDir);
  rules.push(...localRules);

  const pluginRules = loadPackagePlugins(rootDir, config.plugins);
  rules.push(...pluginRules);

  const seen = new Set<string>();
  for (const rule of rules) {
    if (BUILTIN_IDS.has(rule.id)) {
      throw new RivtError(
        `Custom rule "${rule.id}" conflicts with a built-in rule ID.`,
      );
    }
    if (seen.has(rule.id)) {
      throw new RivtError(`Duplicate custom rule ID "${rule.id}".`);
    }
    seen.add(rule.id);
  }

  return rules;
}

function loadLocalRules(rootDir: string): Rule[] {
  const rulesDir = resolve(rootDir, ".rivt", "rules");
  if (!existsSync(rulesDir)) return [];

  let entries;
  try {
    entries = readdirSync(rulesDir);
  } catch {
    return [];
  }

  const ruleFiles = entries.filter(
    (e) => !e.startsWith("_") && [".ts", ".js", ".mjs"].includes(extname(e)),
  );
  if (ruleFiles.length === 0) return [];

  const jitiMod = require("jiti") as {
    createJiti: (dir: string) => {
      require: (path: string) => Record<string, unknown>;
    };
  };
  const jiti = jitiMod.createJiti(rulesDir);
  const rules: Rule[] = [];

  for (const entry of ruleFiles) {
    const fullPath = resolve(rulesDir, entry);
    try {
      const mod = jiti.require(fullPath);
      for (const value of Object.values(mod)) {
        if (isRule(value)) {
          rules.push(value);
        }
      }
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new RivtError(`Failed to load custom rule from ${entry}: ${cause}`);
    }
  }

  return rules;
}

function loadPackagePlugins(rootDir: string, plugins: string[]): Rule[] {
  if (plugins.length === 0) return [];

  const rules: Rule[] = [];
  const req = createRequire(resolve(rootDir, "package.json"));

  for (const pluginName of plugins) {
    let mod: Record<string, unknown>;
    try {
      mod = req(pluginName) as Record<string, unknown>;
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new RivtError(`Failed to load plugin "${pluginName}": ${cause}`);
    }

    if (typeof mod["getRules"] === "function") {
      const pluginRules = (mod["getRules"] as () => unknown[])();
      for (const value of pluginRules) {
        if (isRule(value)) {
          rules.push(value);
        }
      }
    } else {
      for (const value of Object.values(mod)) {
        if (isRule(value)) {
          rules.push(value);
        }
      }
    }
  }

  return rules;
}

function isRule(value: unknown): value is Rule {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["description"] === "string" &&
    typeof obj["check"] === "function"
  );
}
