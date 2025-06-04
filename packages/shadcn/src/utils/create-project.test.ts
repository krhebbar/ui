import { existsSync } from "fs"
import path from "path"
import * as os from "os";
import * as fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { TEMPLATES, createProject } from "./create-project"
import { InitConfig } from "./init-config";

// Mock all external dependencies
vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue(undefined),
}))

// No top-level await for actualFsExtra here, do it inside the mock factory or beforeEach/afterEach

vi.mock("fs-extra", async () => {
  const actualFs = await vi.importActual("fs-extra") as typeof import('fs-extra');

  // Create distinct mock functions
  const mockExistsSync = vi.fn().mockReturnValue(false);
  const mockAccess = vi.fn().mockResolvedValue(undefined);
  const mockRemove = vi.fn().mockResolvedValue(undefined); // Used in createAirdropProject

  const defaultExportObject = {
    // Actual properties/functions needed by createProject.ts or general utility
    constants: actualFs.constants, // For fs.constants.W_OK
    // mkdirSync & rmSync are primarily for test setup/teardown via vi.importActual("fs-extra")
    // but including them here ensures that if fs.mkdirSync was called, it'd be the real one.
    mkdirSync: actualFs.mkdirSync,
    rmSync: actualFs.rmSync,
    // execa is used for git, not an fs-extra function.
    // fs.remove is used in createAirdropProject - so it should be the mocked one (mockRemove).

    // Mocked functions:
    existsSync: mockExistsSync,
    access: mockAccess,
    remove: mockRemove,
  };

  return {
    default: defaultExportObject,
    // Also provide named exports for the mocked functions and essential actuals
    existsSync: mockExistsSync,
    access: mockAccess,
    remove: mockRemove,
    constants: actualFs.constants,
    mkdirSync: actualFs.mkdirSync,
    rmSync: actualFs.rmSync,
  };
});

vi.mock("prompts", () => ({
  default: vi.fn().mockResolvedValue({ name: "airdrop-project" }),
}))

vi.mock("../get-package-manager", () => ({
  getPackageManager: vi.fn().mockResolvedValue("npm"),
}))

const FIXTURES = path.resolve(__dirname, "../fixtures")

const initConfig: InitConfig = {
  defaultApiBaseUrl: "https://api.example.com/v1",
  defaultTestEndpoint: "/me", // Relative to apiBaseUrl typically, or an absolute path
  defaultSnapInTemplateName: "default-snapin-template", // Key to find in snapInTemplates
  snapInTemplates: [
    {
      name: "default-snapin-template",
      description: "Default Snap-in template",
      url: "https://github.com/krhebbar/snapin-template.git", // Example URL
    },
    {
      name: "custom-webhook-snapin-template",
      description: "Custom Webhook Snap-in template",
      url: "https://github.com/krhebbar/snapin-custom-webhook-template.git",
    },
  ],
};

let tempTestDir: string;

describe("createProject", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Create a unique temporary directory for each test
    tempTestDir = path.join(os.tmpdir(), "shadcn-test-project", Math.random().toString(36).substring(2, 15));
    // Ensure fs.mkdirSync is the real one for this setup
    const fsActual = await vi.importActual("fs-extra") as typeof fs;
    fsActual.mkdirSync(tempTestDir, { recursive: true });

    // The module-level mock for fs-extra should handle existsSync, access, etc.
    // mkdirSync and rmSync for setup/teardown will use the actual versions due to the mock structure.
  })

  afterEach(async () => {
    vi.clearAllMocks();
    // Clean up the temporary directory
    if (tempTestDir) {
      // Use actual fs-extra functions for cleanup, not mocks
      const fsActual = await vi.importActual("fs-extra") as typeof fs;
      if (fsActual.existsSync(tempTestDir)) { // Use actual existsSync for reliable cleanup check
        fsActual.rmSync(tempTestDir, { recursive: true, force: true }); // Use actual rmSync
      }
    }
  })

  test("should create an airdrop project with default options", async () => {
    const result = await createProject({
      cwd: tempTestDir,
      force: false,
      components: [],
    })

    expect(result).toEqual({
      projectPath: path.join(tempTestDir, "airdrop-project"),
      projectName: "airdrop-project",
      template: "airdrop",
    })
  })

  test("should create an airdrop project when monorepo is requested", async () => {
    const prompts = await import("prompts")
    vi.mocked(prompts.default).mockResolvedValueOnce({
      name: "airdrop-monorepo",
    })

    const result = await createProject({
      cwd: tempTestDir,
      force: false,
      components: [],
    })

    expect(result).toEqual({
      projectPath: path.join(tempTestDir, "airdrop-monorepo"),
      projectName: "airdrop-monorepo",
      template: "airdrop",
    })
  })

  test("should default to airdrop template", async () => {
    const result = await createProject({
      cwd: tempTestDir,
      force: false,
      components: ["button"],
    })

    expect(result.template).toBe("airdrop")
  })

  test("should throw error if project path already exists", async () => {
    // Get the mocked version of fs-extra
    const fsExtraMock = await import("fs-extra");
    // Override the default mock for existsSync for this specific test case
    // Targeting fsExtraMock.default.existsSync as createProject.ts uses the default import.
    // The mock structure should ensure fsExtraMock.default.existsSync is a vi.fn()
    vi.mocked(fsExtraMock.default.existsSync).mockReturnValueOnce(true);

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

    // Ensure prompts return a specific project name for this test
    const prompts = await import("prompts")
    vi.mocked(prompts.default).mockResolvedValueOnce({ name: "existing-project" })

    await createProject({
      cwd: tempTestDir,
      force: false,
      components: [],
    })

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  test("should throw error if path is not writable", async () => {
    // Get the mocked version of fs-extra
    const fsExtraMock = await import("fs-extra");
    // Override the default mock for access for this specific test case
    // Targeting fsExtraMock.default.access as createProject.ts uses the default import.
    // The mock structure should ensure fsExtraMock.default.access is a vi.fn()
    vi.mocked(fsExtraMock.default.access).mockRejectedValueOnce(new Error("Permission denied"));

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

    await createProject({
      cwd: tempTestDir,
      force: false,
      components: [],
    })

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})

