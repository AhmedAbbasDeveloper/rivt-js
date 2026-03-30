import { describe, expect, it } from "vitest";

import { libraryImportsRule } from "../../src/rules/library-imports.js";
import { makeConfig, makeLayer, parseCode } from "../helpers.js";

const config = makeConfig({
  layers: {
    components: makeLayer("components", ["src/components"], ["hooks", "utils"]),
    hooks: makeLayer("hooks", ["src/hooks"], ["services", "utils"]),
    services: makeLayer("services", ["src/services"], ["utils"]),
    utils: makeLayer("utils", ["src/utils"], []),
  },
  libraries: {
    react: {
      allowedIn: ["components", "hooks", "pages", "stores", "contexts"],
    },
    "react-dom": { allowedIn: ["components", "hooks", "pages", "contexts"] },
    axios: { allowedIn: ["services"] },
  },
});

describe("library-imports", () => {
  it("allows library in permitted layer", () => {
    const ast = parseCode('import React from "react";');
    const violations = libraryImportsRule.check(
      ast,
      "src/components/App.tsx",
      config,
    );
    expect(violations).toHaveLength(0);
  });

  it("flags library in forbidden layer", () => {
    const ast = parseCode('import { useState } from "react";');
    const violations = libraryImportsRule.check(
      ast,
      "src/services/auth.ts",
      config,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain("framework-agnostic");
  });

  it("flags react in utils with contextual message", () => {
    const ast = parseCode('import { useCallback } from "react";');
    const violations = libraryImportsRule.check(
      ast,
      "src/utils/helper.ts",
      config,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain("pure and framework-agnostic");
  });

  it("exempts import type statements", () => {
    const ast = parseCode('import type { ReactNode } from "react";');
    const violations = libraryImportsRule.check(
      ast,
      "src/services/auth.ts",
      config,
    );
    expect(violations).toHaveLength(0);
  });

  it("flags axios in components", () => {
    const ast = parseCode('import axios from "axios";');
    const violations = libraryImportsRule.check(
      ast,
      "src/components/Form.tsx",
      config,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain(
      "Move axios usage to the services layer",
    );
  });

  it("allows axios in services", () => {
    const ast = parseCode('import axios from "axios";');
    const violations = libraryImportsRule.check(
      ast,
      "src/services/api.ts",
      config,
    );
    expect(violations).toHaveLength(0);
  });

  it("ignores relative imports", () => {
    const ast = parseCode('import { helper } from "./helper";');
    const violations = libraryImportsRule.check(
      ast,
      "src/services/api.ts",
      config,
    );
    expect(violations).toHaveLength(0);
  });

  it("ignores files outside any layer", () => {
    const ast = parseCode('import { useState } from "react";');
    const violations = libraryImportsRule.check(ast, "src/App.tsx", config);
    expect(violations).toHaveLength(0);
  });

  it("handles no libraries configured", () => {
    const emptyConfig = makeConfig({
      layers: { services: makeLayer("services", ["src/services"], []) },
      libraries: {},
    });
    const ast = parseCode('import React from "react";');
    const violations = libraryImportsRule.check(
      ast,
      "src/services/api.ts",
      emptyConfig,
    );
    expect(violations).toHaveLength(0);
  });

  it("uses singular 'layer' when restricted to one", () => {
    const ast = parseCode('import axios from "axios";');
    const violations = libraryImportsRule.check(
      ast,
      "src/components/Form.tsx",
      config,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain(
      "Move axios usage to the services layer",
    );
  });

  it("uses plural 'layers' when restricted to multiple", () => {
    const multiConfig = makeConfig({
      layers: {
        components: makeLayer("components", ["src/components"], []),
        services: makeLayer("services", ["src/services"], []),
        utils: makeLayer("utils", ["src/utils"], []),
      },
      libraries: { lodash: { allowedIn: ["services", "utils"] } },
    });
    const ast = parseCode('import _ from "lodash";');
    const violations = libraryImportsRule.check(
      ast,
      "src/components/App.tsx",
      multiConfig,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain(
      "Move lodash usage to the services, utils layers",
    );
  });
});
