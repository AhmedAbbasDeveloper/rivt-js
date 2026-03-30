import type { TSESTree } from "@typescript-eslint/typescript-estree";
import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";

import type { RivtConfig, Violation } from "../models.js";
import type { Rule } from "./base.js";
import { walk } from "./walk.js";

const AXIOS_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "request",
  "create",
]);

export const httpTimeoutRule: Rule = {
  id: "http-timeout",
  description: "HTTP calls must specify a timeout",

  check(
    ast: TSESTree.Program,
    filePath: string,
    config: RivtConfig,
  ): Violation[] {
    if (config.httpClient !== "axios") return [];

    const violations: Violation[] = [];

    walk(ast, (node) => {
      if (node.type !== AST_NODE_TYPES.CallExpression) return;

      const { callee } = node;
      let attr: string | null = null;

      if (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        callee.object.name === "axios" &&
        callee.property.type === AST_NODE_TYPES.Identifier
      ) {
        attr = callee.property.name;
      }

      if (!attr || !AXIOS_METHODS.has(attr)) return;

      if (hasTimeoutArg(node)) return;

      violations.push({
        ruleId: "http-timeout",
        path: filePath,
        line: node.loc.start.line,
        col: node.loc.start.column,
        message: `Add timeout parameter to axios.${attr}() (e.g. timeout: 10000).`,
      });
    });

    return violations;
  },
};

function hasTimeoutArg(node: TSESTree.CallExpression): boolean {
  for (const arg of node.arguments) {
    if (arg.type === AST_NODE_TYPES.ObjectExpression) {
      for (const prop of arg.properties) {
        if (
          prop.type === AST_NODE_TYPES.Property &&
          prop.key.type === AST_NODE_TYPES.Identifier &&
          prop.key.name === "timeout"
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
