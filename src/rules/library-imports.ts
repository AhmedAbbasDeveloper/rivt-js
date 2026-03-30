import type { TSESTree } from "@typescript-eslint/typescript-estree";
import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";

import { getLayer } from "../config.js";
import type { RivtConfig, Violation } from "../models.js";
import type { Rule } from "./base.js";
import { capitalize } from "./util.js";

export const libraryImportsRule: Rule = {
  id: "library-imports",
  description: "Restrict libraries to specific architectural layers",

  check(
    ast: TSESTree.Program,
    filePath: string,
    config: RivtConfig,
  ): Violation[] {
    if (Object.keys(config.libraries).length === 0) return [];

    const currentLayer = getLayer(filePath, config);
    if (!currentLayer) return [];

    const violations: Violation[] = [];

    for (const node of ast.body) {
      if (node.type !== AST_NODE_TYPES.ImportDeclaration) continue;

      if (node.importKind === "type") continue;

      const source = node.source.value;
      if (source.startsWith(".") || source.startsWith("/")) continue;

      const topLevel = source.split("/")[0] ?? source;
      const scoped =
        topLevel.startsWith("@") && source.includes("/")
          ? source.split("/").slice(0, 2).join("/")
          : topLevel;

      const restriction =
        config.libraries[scoped] ?? config.libraries[topLevel];
      if (!restriction) continue;
      if (restriction.allowedIn.includes(currentLayer.name)) continue;

      const found = source;
      const allowedStr = restriction.allowedIn.join(", ");
      const layerWord = restriction.allowedIn.length > 1 ? "layers" : "layer";

      let message: string;
      if (
        (scoped === "react" || scoped === "react-dom") &&
        currentLayer.name === "services"
      ) {
        message = `Services should be framework-agnostic. Move React-specific logic to a hook or component. (found: ${found})`;
      } else if (
        (scoped === "react" || scoped === "react-dom") &&
        currentLayer.name === "utils"
      ) {
        message = `Utils should be pure and framework-agnostic. Move React-specific logic to a hook or component. (found: ${found})`;
      } else {
        message = `${capitalize(currentLayer.name)} must not import ${scoped}. Move ${scoped} usage to the ${allowedStr} ${layerWord}. (found: ${found})`;
      }

      violations.push({
        ruleId: "library-imports",
        path: filePath,
        line: node.loc.start.line,
        col: node.loc.start.column,
        message,
      });
    }

    return violations;
  },
};
