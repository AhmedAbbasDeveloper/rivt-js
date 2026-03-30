import type { Rule } from "./base.js";
import { httpTimeoutRule } from "./http-timeout.js";
import { layerImportsRule } from "./layer-imports.js";
import { libraryImportsRule } from "./library-imports.js";
import { noEnvVarsRule } from "./no-env-vars.js";

export const builtinRules: Rule[] = [
  layerImportsRule,
  libraryImportsRule,
  noEnvVarsRule,
  httpTimeoutRule,
];

export type { Rule } from "./base.js";
