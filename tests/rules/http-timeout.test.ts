import { describe, expect, it } from "vitest";

import { httpTimeoutRule } from "../../src/rules/http-timeout.js";
import { makeConfig, parseCode } from "../helpers.js";

const axiosConfig = makeConfig({ httpClient: "axios" });

describe("http-timeout", () => {
  it("flags axios.get without timeout", () => {
    const ast = parseCode('axios.get("/users");');
    const violations = httpTimeoutRule.check(
      ast,
      "src/services/api.ts",
      axiosConfig,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain("timeout");
  });

  it("allows axios.get with timeout", () => {
    const ast = parseCode('axios.get("/users", { timeout: 5000 });');
    const violations = httpTimeoutRule.check(
      ast,
      "src/services/api.ts",
      axiosConfig,
    );
    expect(violations).toHaveLength(0);
  });

  it("flags axios.create without timeout", () => {
    const ast = parseCode('const client = axios.create({ baseURL: "/api" });');
    const violations = httpTimeoutRule.check(
      ast,
      "src/services/api.ts",
      axiosConfig,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain("axios.create");
  });

  it("allows axios.create with timeout", () => {
    const ast = parseCode(
      'const client = axios.create({ baseURL: "/api", timeout: 10000 });',
    );
    const violations = httpTimeoutRule.check(
      ast,
      "src/services/api.ts",
      axiosConfig,
    );
    expect(violations).toHaveLength(0);
  });

  it("skips when http_client is not axios", () => {
    const kyConfig = makeConfig({ httpClient: "ky" });
    const ast = parseCode('axios.get("/users");');
    const violations = httpTimeoutRule.check(
      ast,
      "src/services/api.ts",
      kyConfig,
    );
    expect(violations).toHaveLength(0);
  });

  it("skips when no http_client configured", () => {
    const noConfig = makeConfig();
    const ast = parseCode('axios.get("/users");');
    const violations = httpTimeoutRule.check(
      ast,
      "src/services/api.ts",
      noConfig,
    );
    expect(violations).toHaveLength(0);
  });

  it("flags axios.post without timeout", () => {
    const ast = parseCode('axios.post("/users", { name: "test" });');
    const violations = httpTimeoutRule.check(
      ast,
      "src/services/api.ts",
      axiosConfig,
    );
    expect(violations).toHaveLength(1);
  });

  it("ignores non-axios method calls", () => {
    const ast = parseCode('console.log("hello");');
    const violations = httpTimeoutRule.check(
      ast,
      "src/services/api.ts",
      axiosConfig,
    );
    expect(violations).toHaveLength(0);
  });
});
