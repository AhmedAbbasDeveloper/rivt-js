import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getLayer, isConfigModule, loadConfig } from "../src/config.js";

const TMP = resolve(import.meta.dirname, "__tmp_config_test__");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function writeConfig(config: Record<string, unknown>): void {
  writeFileSync(
    resolve(TMP, "rivt.config.json"),
    JSON.stringify(config, null, 2),
  );
}

describe("loadConfig", () => {
  it("loads from rivt.config.json", () => {
    writeConfig({
      layers: {
        components: { paths: ["src/components"] },
        services: { paths: ["src/services"] },
      },
    });
    const config = loadConfig(TMP);
    expect(config).not.toBeNull();
    expect(config!.layers["components"]).toBeDefined();
    expect(config!.layers["services"]).toBeDefined();
  });

  it("defaults can_import to empty when omitted", () => {
    writeConfig({
      layers: {
        components: { paths: ["src/components"] },
        hooks: { paths: ["src/hooks"] },
      },
    });
    const config = loadConfig(TMP)!;
    expect(config.layers["components"]!.canImport).toEqual([]);
    expect(config.layers["hooks"]!.canImport).toEqual([]);
  });

  it("uses explicit can_import from config", () => {
    writeConfig({
      layers: {
        components: { paths: ["src/components"], can_import: ["services"] },
      },
    });
    const config = loadConfig(TMP)!;
    expect(config.layers["components"]!.canImport).toEqual(["services"]);
  });

  it("hardcodes react and react-dom restrictions", () => {
    writeConfig({ layers: { services: { paths: ["src/services"] } } });
    const config = loadConfig(TMP)!;
    expect(config.libraries["react"]).toBeDefined();
    expect(config.libraries["react"]!.allowedIn).toContain("components");
    expect(config.libraries["react"]!.allowedIn).not.toContain("services");
  });

  it("generates http_client restriction", () => {
    writeConfig({
      http_client: "axios",
      layers: { services: { paths: ["src/services"] } },
    });
    const config = loadConfig(TMP)!;
    expect(config.libraries["axios"]).toBeDefined();
    expect(config.libraries["axios"]!.allowedIn).toEqual(["services"]);
  });

  it("user-defined libraries override defaults", () => {
    writeConfig({
      layers: { services: { paths: ["src/services"] } },
      libraries: { react: { allowed_in: ["services", "components"] } },
    });
    const config = loadConfig(TMP)!;
    expect(config.libraries["react"]!.allowedIn).toContain("services");
  });

  it("normalizes string config_module to array", () => {
    writeConfig({ config_module: "src/config.ts", layers: {} });
    const config = loadConfig(TMP)!;
    expect(config.configModule).toEqual(["src/config.ts"]);
  });

  it("skips layers without paths", () => {
    writeConfig({
      layers: { components: { paths: ["src/components"] }, empty: {} },
    });
    const config = loadConfig(TMP)!;
    expect(config.layers["components"]).toBeDefined();
    expect(config.layers["empty"]).toBeUndefined();
  });

  it("returns null when no config found", () => {
    const config = loadConfig(TMP);
    expect(config).toBeNull();
  });
});

describe("getLayer", () => {
  it("matches file to layer", () => {
    writeConfig({ layers: { components: { paths: ["src/components"] } } });
    const config = loadConfig(TMP)!;
    const layer = getLayer("src/components/Button.tsx", config);
    expect(layer).not.toBeNull();
    expect(layer!.name).toBe("components");
  });

  it("returns null for file outside layers", () => {
    writeConfig({ layers: { components: { paths: ["src/components"] } } });
    const config = loadConfig(TMP)!;
    const layer = getLayer("src/App.tsx", config);
    expect(layer).toBeNull();
  });
});

describe("isConfigModule", () => {
  it("matches config module path", () => {
    writeConfig({ config_module: "src/config.ts", layers: {} });
    const config = loadConfig(TMP)!;
    expect(isConfigModule("src/config.ts", config)).toBe(true);
    expect(isConfigModule("src/services/api.ts", config)).toBe(false);
  });
});
