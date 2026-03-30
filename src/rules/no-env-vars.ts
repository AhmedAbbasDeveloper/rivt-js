import type { TSESTree } from "@typescript-eslint/typescript-estree";
import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";

import { isConfigModule } from "../config.js";
import type { RivtConfig, Violation } from "../models.js";
import type { Rule } from "./base.js";
import { walk } from "./walk.js";

export const noEnvVarsRule: Rule = {
  id: "no-env-vars",
  description:
    "No direct environment variable access outside the config module",

  check(
    ast: TSESTree.Program,
    filePath: string,
    config: RivtConfig,
  ): Violation[] {
    if (isConfigModule(filePath, config)) return [];

    const violations: Violation[] = [];
    const message = buildMessage(config);

    walk(ast, (node) => {
      if (isProcessEnv(node) || isImportMetaEnv(node)) {
        violations.push({
          ruleId: "no-env-vars",
          path: filePath,
          line: node.loc.start.line,
          col: node.loc.start.column,
          message,
        });
      }
    });

    return violations;
  },
};

function isProcessEnv(node: TSESTree.Node): boolean {
  if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
  const obj = node.object;
  if (obj.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (obj.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (obj.object.name !== "process") return false;
  if (obj.property.type !== AST_NODE_TYPES.Identifier) return false;
  if (obj.property.name !== "env") return false;
  return true;
}

function isImportMetaEnv(node: TSESTree.Node): boolean {
  if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
  const obj = node.object;
  if (obj.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (obj.object.type !== AST_NODE_TYPES.MetaProperty) return false;
  if (obj.property.type !== AST_NODE_TYPES.Identifier) return false;
  if (obj.property.name !== "env") return false;
  return true;
}

function buildMessage(config: RivtConfig): string {
  if (config.configModule.length > 0) {
    const modules = config.configModule.join(", ");
    return `Do not access environment variables directly. Read from the config module instead (${modules}).`;
  }
  return "Do not access environment variables directly. Read from the config module instead.";
}
