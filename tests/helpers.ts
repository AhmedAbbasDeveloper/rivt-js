import type { TSESTree } from "@typescript-eslint/typescript-estree";
import { parse } from "@typescript-eslint/typescript-estree";

import type { Layer, RivtConfig } from "../src/models.js";

export function parseCode(code: string, jsx = false): TSESTree.Program {
  return parse(code, { loc: true, range: true, jsx });
}

export function makeConfig(overrides: Partial<RivtConfig> = {}): RivtConfig {
  return {
    httpClient: undefined,
    configModule: [],
    exclude: [],
    disable: [],
    plugins: [],
    layers: {},
    libraries: {},
    ...overrides,
  };
}

export function makeLayer(
  name: string,
  paths: string[],
  canImport: string[] = [],
): Layer {
  return { name, paths, canImport };
}
