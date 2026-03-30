import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

import { parse } from "@typescript-eslint/typescript-estree";

import { matchesPattern } from "./config.js";
import type { RivtConfig, Violation } from "./models.js";
import { loadPluginRules } from "./plugins.js";
import { builtinRules } from "./rules/index.js";

const ALWAYS_EXCLUDE = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".rivt",
  ".cache",
  "coverage",
]);

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export function runCheck(
  config: RivtConfig,
  rootDir: string,
  targetPaths?: string[],
): Violation[] {
  const customRules = loadPluginRules(rootDir, config);
  const allRules = [...builtinRules, ...customRules];
  const activeRules = allRules.filter((r) => !config.disable.includes(r.id));

  const files = targetPaths
    ? resolveTargetPaths(targetPaths, rootDir, config)
    : discoverFiles(rootDir, config);

  const violations: Violation[] = [];

  for (const file of files) {
    const relPath = relative(rootDir, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf-8");

    const fileSuppressed = parseFileDisable(source);
    const lineSuppressed = parseLineSuppression(source);

    let ast;
    try {
      ast = parse(source, {
        loc: true,
        range: true,
        jsx: extname(file) === ".tsx" || extname(file) === ".jsx",
      });
    } catch (err: unknown) {
      const cause = err instanceof Error ? err.message : String(err);
      violations.push({
        ruleId: "parse-error",
        path: relPath,
        line: 1,
        col: 0,
        message: `Failed to parse: ${cause}`,
      });
      continue;
    }

    for (const rule of activeRules) {
      if (fileSuppressed.has(rule.id)) continue;

      const ruleViolations = rule.check(ast, relPath, config);

      for (const v of ruleViolations) {
        if (isLineSuppressed(v.line, v.ruleId, lineSuppressed)) continue;
        violations.push(v);
      }
    }
  }

  violations.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (a.line !== b.line) return a.line - b.line;
    return a.col - b.col;
  });
  return violations;
}

function discoverFiles(dir: string, config: RivtConfig): string[] {
  const files: string[] = [];
  walkDir(dir, dir, config, files);
  return files;
}

function walkDir(
  currentDir: string,
  rootDir: string,
  config: RivtConfig,
  files: string[],
): void {
  let entries;
  try {
    entries = readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = resolve(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (ALWAYS_EXCLUDE.has(entry.name)) continue;
      if (isExcluded(relative(rootDir, fullPath), config.exclude)) continue;
      walkDir(fullPath, rootDir, config, files);
    } else if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) {
      const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");
      if (!isExcluded(relPath, config.exclude)) {
        files.push(fullPath);
      }
    }
  }
}

function resolveTargetPaths(
  paths: string[],
  rootDir: string,
  config: RivtConfig,
): string[] {
  const files: string[] = [];

  for (const p of paths) {
    const full = resolve(rootDir, p);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walkDir(full, rootDir, config, files);
      } else if (stat.isFile() && EXTENSIONS.has(extname(full))) {
        files.push(full);
      }
    } catch {
      // skip non-existent paths
    }
  }

  return files;
}

function isExcluded(relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchesPattern(relPath, pattern)) return true;
  }
  return false;
}

function parseFileDisable(source: string): Set<string> {
  const suppressed = new Set<string>();
  const lines = source.split("\n").slice(0, 10);

  for (const line of lines) {
    const match = line.match(/\/\/\s*rivt:\s*disable-file=(.+)/);
    if (match?.[1]) {
      for (const id of match[1].split(",")) {
        suppressed.add(id.trim());
      }
    }
  }

  return suppressed;
}

interface LineSuppression {
  line: number;
  ruleIds: Set<string>;
}

function parseLineSuppression(source: string): LineSuppression[] {
  const suppressions: LineSuppression[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineNum = i + 1;

    const inlineMatch = line.match(/\/\/\s*rivt:\s*disable=(.+)/);
    if (inlineMatch?.[1]) {
      const ruleIds = new Set(inlineMatch[1].split(",").map((s) => s.trim()));
      suppressions.push({ line: lineNum, ruleIds });
    }

    const nextLineMatch = line.match(/\/\/\s*rivt:\s*disable-next-line=(.+)/);
    if (nextLineMatch?.[1]) {
      const ruleIds = new Set(nextLineMatch[1].split(",").map((s) => s.trim()));
      suppressions.push({ line: lineNum + 1, ruleIds });
    }
  }

  return suppressions;
}

function isLineSuppressed(
  line: number,
  ruleId: string,
  suppressions: LineSuppression[],
): boolean {
  return suppressions.some((s) => s.line === line && s.ruleIds.has(ruleId));
}
