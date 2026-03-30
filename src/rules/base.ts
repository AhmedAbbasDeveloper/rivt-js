import type { TSESTree } from "@typescript-eslint/typescript-estree";

import type { RivtConfig, Violation } from "../models.js";

export interface Rule {
  id: string;
  description: string;
  check(
    ast: TSESTree.Program,
    filePath: string,
    config: RivtConfig,
  ): Violation[];
}
