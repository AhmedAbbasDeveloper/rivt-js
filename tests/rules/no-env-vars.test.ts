import { describe, expect, it } from "vitest";

import { noEnvVarsRule } from "../../src/rules/no-env-vars.js";
import { makeConfig, parseCode } from "../helpers.js";

describe("no-env-vars", () => {
  it("flags process.env access", () => {
    const ast = parseCode("const key = process.env.API_KEY;");
    const config = makeConfig();
    const violations = noEnvVarsRule.check(ast, "src/services/auth.ts", config);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.ruleId).toBe("no-env-vars");
  });

  it("flags import.meta.env access", () => {
    const ast = parseCode("const url = import.meta.env.VITE_API_URL;");
    const config = makeConfig();
    const violations = noEnvVarsRule.check(ast, "src/services/api.ts", config);
    expect(violations).toHaveLength(1);
  });

  it("allows env access in config module", () => {
    const ast = parseCode("const key = process.env.API_KEY;");
    const config = makeConfig({ configModule: ["src/config.ts"] });
    const violations = noEnvVarsRule.check(ast, "src/config.ts", config);
    expect(violations).toHaveLength(0);
  });

  it("includes config module path in message", () => {
    const ast = parseCode("const key = process.env.API_KEY;");
    const config = makeConfig({ configModule: ["src/config.ts"] });
    const violations = noEnvVarsRule.check(ast, "src/services/auth.ts", config);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain("src/config.ts");
  });

  it("reports generic message when no config module set", () => {
    const ast = parseCode("const key = process.env.API_KEY;");
    const config = makeConfig();
    const violations = noEnvVarsRule.check(ast, "src/services/auth.ts", config);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain(
      "Read from the config module instead.",
    );
  });

  it("does not flag non-env member expressions", () => {
    const ast = parseCode("const name = user.profile.name;");
    const config = makeConfig();
    const violations = noEnvVarsRule.check(ast, "src/services/auth.ts", config);
    expect(violations).toHaveLength(0);
  });
});
