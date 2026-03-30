import { dirname, posix } from "node:path";

import type { TSESTree } from "@typescript-eslint/typescript-estree";
import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";

import { getLayer, matchesPattern } from "../config.js";
import type { Layer, RivtConfig, Violation } from "../models.js";
import type { Rule } from "./base.js";
import { capitalize } from "./util.js";

function moduleToLayer(modulePath: string, config: RivtConfig): Layer | null {
  let best: Layer | null = null;
  let bestLen = -1;

  for (const layer of Object.values(config.layers)) {
    for (const pattern of layer.paths) {
      const patternNorm = pattern.replace(/\\/g, "/");
      const matched =
        matchesPattern(modulePath, patternNorm) ||
        matchesPattern(modulePath + ".ts", patternNorm) ||
        matchesPattern(modulePath + ".tsx", patternNorm) ||
        matchesPattern(modulePath + ".js", patternNorm) ||
        matchesPattern(modulePath + ".jsx", patternNorm) ||
        matchesPattern(modulePath + "/index.ts", patternNorm) ||
        matchesPattern(modulePath + "/index.tsx", patternNorm);
      if (matched && patternNorm.length > bestLen) {
        bestLen = patternNorm.length;
        best = layer;
      }
    }
  }

  return best;
}

function resolveImportToPath(source: string, fromFile: string): string | null {
  if (!source.startsWith(".") && !source.startsWith("/")) return null;
  const dir = dirname(fromFile);
  const resolved = posix.normalize(`${dir}/${source}`);
  return resolved;
}

export const layerImportsRule: Rule = {
  id: "layer-imports",
  description: "Enforce import boundaries between architectural layers",

  check(
    ast: TSESTree.Program,
    filePath: string,
    config: RivtConfig,
  ): Violation[] {
    const currentLayer = getLayer(filePath, config);
    if (!currentLayer) return [];

    const violations: Violation[] = [];

    for (const node of ast.body) {
      if (node.type === AST_NODE_TYPES.ImportDeclaration) {
        const source = node.source.value;
        const resolved = resolveImportToPath(source, filePath);
        if (!resolved) continue;

        checkImport(
          filePath,
          resolved,
          source,
          node.loc.start.line,
          node.loc.start.column,
          currentLayer,
          config,
          violations,
        );
      }
    }

    return violations;
  },
};

function checkImport(
  filePath: string,
  modulePath: string,
  found: string,
  line: number,
  col: number,
  currentLayer: Layer,
  config: RivtConfig,
  violations: Violation[],
): void {
  const targetLayer = moduleToLayer(modulePath, config);
  if (!targetLayer) return;
  if (targetLayer.name === currentLayer.name) return;
  if (currentLayer.canImport.includes(targetLayer.name)) return;

  const suggestion =
    currentLayer.canImport.length > 0
      ? `Import from ${currentLayer.canImport.join(", ")} instead.`
      : "This layer cannot import from other layers. It should be self-contained — pass any dependencies as function arguments.";

  violations.push({
    ruleId: "layer-imports",
    path: filePath,
    line,
    col,
    message: `${capitalize(currentLayer.name)} must not import from ${targetLayer.name}. ${suggestion} (found: ${found})`,
  });
}
