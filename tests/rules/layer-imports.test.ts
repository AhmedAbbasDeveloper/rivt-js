import { describe, expect, it } from "vitest";

import { layerImportsRule } from "../../src/rules/layer-imports.js";
import { makeConfig, makeLayer, parseCode } from "../helpers.js";

const config = makeConfig({
  layers: {
    components: makeLayer("components", ["src/components"], ["hooks", "utils"]),
    hooks: makeLayer("hooks", ["src/hooks"], ["services", "utils"]),
    services: makeLayer("services", ["src/services"], ["utils"]),
    utils: makeLayer("utils", ["src/utils"], []),
  },
});

describe("layer-imports", () => {
  it("allows import from permitted layer", () => {
    const ast = parseCode('import { useAuth } from "../hooks/useAuth";');
    const violations = layerImportsRule.check(
      ast,
      "src/components/Login.tsx",
      config,
    );
    expect(violations).toHaveLength(0);
  });

  it("flags import from forbidden layer", () => {
    const ast = parseCode('import { fetchUser } from "../services/user";');
    const violations = layerImportsRule.check(
      ast,
      "src/components/Login.tsx",
      config,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.ruleId).toBe("layer-imports");
    expect(violations[0]!.message).toContain(
      "Components must not import from services",
    );
  });

  it("allows same-layer import", () => {
    const ast = parseCode('import { Button } from "./Button";');
    const violations = layerImportsRule.check(
      ast,
      "src/components/Form.tsx",
      config,
    );
    expect(violations).toHaveLength(0);
  });

  it("ignores files outside any layer", () => {
    const ast = parseCode('import { fetchUser } from "../services/user";');
    const violations = layerImportsRule.check(ast, "src/App.tsx", config);
    expect(violations).toHaveLength(0);
  });

  it("ignores bare package imports", () => {
    const ast = parseCode('import React from "react";');
    const violations = layerImportsRule.check(
      ast,
      "src/components/Login.tsx",
      config,
    );
    expect(violations).toHaveLength(0);
  });

  it("shows allowed layers in suggestion", () => {
    const ast = parseCode('import { api } from "../services/api";');
    const violations = layerImportsRule.check(
      ast,
      "src/components/Home.tsx",
      config,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain(
      "Import from hooks, utils instead",
    );
  });

  it("handles layer with no allowed imports", () => {
    const ast = parseCode('import { useAuth } from "../hooks/useAuth";');
    const violations = layerImportsRule.check(
      ast,
      "src/utils/helper.ts",
      config,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain(
      "This layer cannot import from other layers. It should be self-contained",
    );
  });
});
