#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { DEFAULT_CAN_IMPORT, loadConfig } from "./config.js";
import { RivtError } from "./models.js";
import { formatViolations } from "./reporter.js";
import { runCheck } from "./runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };
const VERSION = pkg.version;

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`rivt ${VERSION}`);
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  if (!command) {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case "check":
      runCheckCommand(args.slice(1));
      break;
    case "init":
      runInit();
      break;
    case "new-rule":
      runNewRule(args[1]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(2);
  }
}

function printHelp(): void {
  console.log(`rivt ${VERSION} — Your architecture, enforced.

Usage:
  rivt check [paths...]   Run all checks
  rivt init               Set up rivt for your project
  rivt new-rule <name>    Scaffold a custom rule

Options:
  --version, -v           Show version
  --help, -h              Show this help`);
}

function runCheckCommand(args: string[]): void {
  const cwd = process.cwd();
  const config = loadConfig(cwd);

  if (!config) {
    console.error(
      "No rivt configuration found. Run `rivt init` to set up your project.",
    );
    process.exit(2);
  }

  let violations;
  try {
    const targetPaths = args.length > 0 ? args : undefined;
    violations = runCheck(config, cwd, targetPaths);
  } catch (err) {
    if (err instanceof RivtError) {
      console.error(`Error: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }

  if (violations.length === 0) {
    process.exit(0);
  }

  console.log(formatViolations(violations));
  process.exit(1);
}

// --- init ---

const COMMON_LAYER_DIRS: Record<string, string[]> = {
  components: ["components", "component", "ui"],
  hooks: ["hooks", "hook"],
  services: ["services", "service", "api"],
  utils: ["utils", "util", "lib", "helpers", "helper"],
  types: ["types", "interfaces"],
  stores: ["stores", "store", "state"],
  pages: ["pages", "views", "routes", "screens"],
  contexts: ["contexts", "context", "providers"],
};

const CONFIG_MODULE_CANDIDATES = [
  "config.ts",
  "config.js",
  "env.ts",
  "env.js",
  "config/index.ts",
  "config/index.js",
  "constants/env.ts",
  "constants/env.js",
];

const PREFIXES = ["src", "app", ""];

function runInit(): void {
  const cwd = process.cwd();

  if (existsSync(resolve(cwd, "rivt.config.json"))) {
    console.log("rivt is already configured (rivt.config.json exists).");
    process.exit(0);
  }

  const pkgPath = resolve(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<
      string,
      unknown
    >;
    if (pkg["rivt"]) {
      console.log(
        'rivt is already configured ("rivt" key exists in package.json).',
      );
      process.exit(0);
    }
  }

  const detectedLayers = detectLayers(cwd);
  const detectedConfig = detectConfigModule(cwd);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const ask = (question: string): Promise<string> =>
    new Promise((res) => rl.question(question, res));

  (async () => {
    try {
      console.log("\nrivt init — setting up architectural enforcement\n");

      const layers: Record<string, { paths: string[]; can_import: string[] }> =
        {};

      if (Object.keys(detectedLayers).length > 0) {
        console.log("Detected layers:");
        for (const [name, path] of Object.entries(detectedLayers)) {
          console.log(`  ${name}: ${path}`);
        }
        const confirm = await ask("\nUse these? (Y/n) ");
        if (confirm.toLowerCase() !== "n") {
          for (const [name, path] of Object.entries(detectedLayers)) {
            const canImport = DEFAULT_CAN_IMPORT[name] ?? [];
            layers[name] = { paths: [path], can_import: canImport };
          }
        }
      }

      if (Object.keys(layers).length === 0) {
        console.log(
          "\nNo layers detected. You can configure them manually in rivt.config.json.",
        );
      }

      let configModule: string | undefined;
      if (detectedConfig) {
        const confirm = await ask(
          `\nDetected config module: ${detectedConfig}. Use this? (Y/n) `,
        );
        if (confirm.toLowerCase() !== "n") {
          configModule = detectedConfig;
        }
      }

      const httpClient = await ask(
        "\nHTTP client? (axios / ky / none) [none]: ",
      );
      const httpClientValue =
        httpClient === "axios" || httpClient === "ky" ? httpClient : undefined;

      const config: Record<string, unknown> = {};
      if (httpClientValue) config["http_client"] = httpClientValue;
      if (configModule) config["config_module"] = configModule;
      if (Object.keys(layers).length > 0) config["layers"] = layers;

      const json = JSON.stringify(config, null, 2);
      writeFileSync(resolve(cwd, "rivt.config.json"), json + "\n");

      console.log("\nCreated rivt.config.json");
      console.log("Run `rivt check` to find violations.\n");
    } finally {
      rl.close();
    }
  })().catch((err: unknown) => {
    console.error("Error during init:", err);
    process.exit(2);
  });
}

function detectLayers(cwd: string): Record<string, string> {
  const found: Record<string, string> = {};

  for (const [layerName, variants] of Object.entries(COMMON_LAYER_DIRS)) {
    for (const prefix of PREFIXES) {
      for (const variant of variants) {
        const path = prefix ? `${prefix}/${variant}` : variant;
        if (existsSync(resolve(cwd, path))) {
          found[layerName] = path;
          break;
        }
      }
      if (found[layerName]) break;
    }
  }

  return found;
}

function detectConfigModule(cwd: string): string | null {
  for (const prefix of PREFIXES) {
    for (const candidate of CONFIG_MODULE_CANDIDATES) {
      const path = prefix ? `${prefix}/${candidate}` : candidate;
      if (existsSync(resolve(cwd, path))) {
        return path;
      }
    }
  }
  return null;
}

// --- new-rule ---

function runNewRule(name: string | undefined): void {
  if (!name) {
    console.error("Usage: rivt new-rule <name>");
    process.exit(2);
  }

  const fileName = name.replace(/-/g, "_");
  const cwd = process.cwd();
  const rulesDir = resolve(cwd, ".rivt", "rules");
  const filePath = resolve(rulesDir, `${fileName}.ts`);

  if (existsSync(filePath)) {
    console.error(`File already exists: .rivt/rules/${fileName}.ts`);
    process.exit(1);
  }

  mkdirSync(rulesDir, { recursive: true });

  const template = `import type { TSESTree } from "@typescript-eslint/typescript-estree";
import type { Rule, RivtConfig, Violation } from "rivt";

export const ${camelCase(name)}Rule: Rule = {
  id: "${name}",
  description: "TODO: describe what this rule enforces",

  check(
    ast: TSESTree.Program,
    filePath: string,
    config: RivtConfig,
  ): Violation[] {
    const violations: Violation[] = [];
    // TODO: implement rule logic
    return violations;
  },
};
`;

  writeFileSync(filePath, template);
  console.log(`Created .rivt/rules/${fileName}.ts`);
}

function camelCase(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

main();
