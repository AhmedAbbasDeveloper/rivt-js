import type { TSESTree } from "@typescript-eslint/typescript-estree";
import { visitorKeys } from "@typescript-eslint/visitor-keys";

export function walk(
  node: TSESTree.Node,
  visitor: (node: TSESTree.Node) => void,
): void {
  visitor(node);
  const keys = visitorKeys[node.type];
  if (!keys) return;
  for (const key of keys) {
    const child = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && "type" in item) {
          walk(item as TSESTree.Node, visitor);
        }
      }
    } else if (child && typeof child === "object" && "type" in child) {
      walk(child as TSESTree.Node, visitor);
    }
  }
}
