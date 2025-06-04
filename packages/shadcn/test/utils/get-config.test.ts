import path from "path"
import { describe, expect, test } from "vitest"

import { getConfig } from "../../src/utils/get-config"

test("get config from project without manifest", async () => {
  // This test refers to a fixture "config-none" which is not part of the current subtask's changes.
  // Assuming it should be kept as per instructions ("Keep existing: test("get config from project without manifest", ...) if it refers to config-none")
  expect(
    await getConfig(path.resolve(__dirname, "../fixtures/config-none"))
  ).toEqual(null)
})

// Removed the old "get config generates from project structure" test block.

describe("getConfig for invalid configurations", () => {
  test("should return null if manifest.yaml is missing", async () => {
    const configPath = path.resolve(__dirname, "../fixtures/config-invalid-missing-manifest");
    expect(await getConfig(configPath)).toBeNull();
  });

  test("should return null if manifest.yaml is malformed", async () => {
    const configPath = path.resolve(__dirname, "../fixtures/config-invalid-malformed-manifest");
    expect(await getConfig(configPath)).toBeNull();
  });

  test("should return null if manifest.yaml is incomplete (e.g., missing name)", async () => {
    const configPath = path.resolve(__dirname, "../fixtures/config-invalid-incomplete-manifest");
    expect(await getConfig(configPath)).toBeNull();
  });

  test("should throw an error if tsconfig.json is missing in code directory", async () => {
    const configPath = path.resolve(__dirname, "../fixtures/config-invalid-no-tsconfig");
    // Expecting error because loadConfig in resolveConfigPaths will fail
    await expect(getConfig(configPath)).rejects.toThrow(/Failed to load tsconfig.json/);
  });
});

describe("getConfig for partial configurations", () => {
  test("should handle partial config with missing optional aliases gracefully", async () => {
    const configPath = path.resolve(__dirname, "../fixtures/config-partial");
    const config = await getConfig(configPath);

    expect(config).not.toBeNull();
    if (!config) return; // Type guard for TypeScript

    expect(config.style).toBe("new-york"); // Default style
    expect(config.rsc).toBe(false); // Default rsc
    expect(config.tsx).toBe(true); // Default tsx because tsconfig.json exists

    // getProjectInfo finds "@/" as aliasPrefix from tsconfig.json
    // getConfig then sets aliases.components = "@/functions", aliases.utils = "@/lib/utils"
    // resolveConfigPaths resolves these.
    const codePath = path.resolve(configPath, "code");
    const expectedComponentsPath = path.resolve(codePath, "src", "functions");
    const expectedUtilsPath = path.resolve(codePath, "src", "lib", "utils");

    expect(config.resolvedPaths.cwd).toBe(codePath); // cwd for resolveConfigPaths is projectInfo.codePath
    expect(config.resolvedPaths.components).toBe(expectedComponentsPath);
    expect(config.resolvedPaths.utils).toBe(expectedUtilsPath);

    // Check fallback behavior for optional aliases (ui, lib, hooks)
    // ui: path.resolve(resolvedPaths.components, "ui")
    expect(config.resolvedPaths.ui).toBe(path.resolve(expectedComponentsPath, "ui"));
    // lib: path.resolve(resolvedPaths.utils, "..") which is code/src/lib
    expect(config.resolvedPaths.lib).toBe(path.resolve(expectedUtilsPath, ".."));
    // hooks: path.resolve(resolvedPaths.components, "..", "hooks") which is code/src/hooks
    expect(config.resolvedPaths.hooks).toBe(path.resolve(expectedComponentsPath, "..", "hooks"));
  });
});
