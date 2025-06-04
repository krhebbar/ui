import { describe, it, expect, vi, beforeEach, afterEach, SpyInstance } from "vitest";
import path from "path";
import fs from "fs-extra";

// Adjust paths as necessary
import { release as releaseCommand } from "../../../src/commands/release"; // The command object
import { setupTestProject, cleanupTestProject } from "../utils/test-project-helpers";
import * as projectInfoUtils from "../../../src/utils/get-project-info";
import { ProjectInfo } from "../../../src/types/project-info"; // ValidationProjectInfo
import { AIRDROP_CONFIG_FILE, MANIFEST_FILE_YAML, COMMAND_PLACEHOLDERS } from "../../../src/config/constants";
import * as configUtils from "../../../src/utils/get-config"; // To spy on getConfig
import { logger } from "../../../src/utils/logger";

// Mock logger and spinner
vi.mock("../../../src/utils/logger");
vi.mock("../../../src/utils/spinner", () => ({
    spinner: vi.fn().mockReturnValue({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        text: "",
    }),
}));


describe("CLI Command: release (Stub)", () => {
  let projectPath: string;
  const testProjectName = "release-stub-test";
  let originalCwd: string;

  let getAirdropProjectValidationSpy: SpyInstance<[string], Promise<ProjectInfo>>;
  let getConfigSpy: SpyInstance<[string], Promise<any>>;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectPath = await setupTestProject(testProjectName);

    await fs.ensureDir(path.join(projectPath, "code", "src"));
    await fs.writeFile(path.join(projectPath, MANIFEST_FILE_YAML), "name: test-project\nslug: test-project\nversion: 1.0.0\ndescription: test\nserviceAccount: {}\nfunctions:\n  - name: testFn");
    await fs.writeFile(path.join(projectPath, AIRDROP_CONFIG_FILE), "export default { projectType: 'airdrop', version: '1.0.1' };"); // Ensure config exists
    await fs.writeFile(path.join(projectPath, "code", "src", "main.ts"), "// main.ts");
    await fs.writeFile(path.join(projectPath, "code", "src", "index.ts"), "// index.ts");

    getAirdropProjectValidationSpy = vi.spyOn(projectInfoUtils, "getAirdropProjectValidation");
    getConfigSpy = vi.spyOn(configUtils, "getConfig");

    vi.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (projectPath) {
      await cleanupTestProject(projectPath);
    }
    vi.resetAllMocks();
  });

  it("should fail if not in a valid Airdrop project", async () => {
    getAirdropProjectValidationSpy.mockResolvedValue({
      isValid: false,
      rootPath: projectPath,
      reasons: ["Invalid project structure"],
      isAirdropProject: false,
      isAtRoot: true,
    });
    process.chdir(projectPath);
    await releaseCommand.parseAsync([], { from: "user" });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to validate project"));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should successfully run in a valid project, load config, and print placeholder", async () => {
    const validProjectInfo: ProjectInfo = {
      isValid: true,
      rootPath: projectPath,
      reasons: ["Valid"],
      isAirdropProject: true,
      isAtRoot: true,
    };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockResolvedValue({ projectType: "airdrop", version: "1.0.1" }); // Mock successful config load

    process.chdir(projectPath);
    await releaseCommand.parseAsync([], { from: "user" });

    expect(getAirdropProjectValidationSpy).toHaveBeenCalledWith(projectPath);
    expect(getConfigSpy).toHaveBeenCalledWith(projectPath);
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.release);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("This is a stub command."));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Skipping build artifact check (stub)"));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should warn if run from a subdirectory but still proceed", async () => {
    const validProjectInfo: ProjectInfo = {
      isValid: true,
      rootPath: projectPath,
      reasons: ["Valid"],
      isAirdropProject: true,
      isAtRoot: false,
    };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockResolvedValue({ projectType: "airdrop", version: "1.0.1" });

    const subDirPath = path.join(projectPath, "code");
    await fs.ensureDir(subDirPath);
    process.chdir(subDirPath);

    await releaseCommand.parseAsync([], { from: "user" });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("You are running 'shadcn release' from a subdirectory."));
    expect(getConfigSpy).toHaveBeenCalledWith(projectPath);
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.release);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should fail if airdrop.config.mjs cannot be loaded (critical for release)", async () => {
    const validProjectInfo: ProjectInfo = {
      isValid: true,
      rootPath: projectPath,
      reasons: ["Valid"],
      isAirdropProject: true,
      isAtRoot: true,
    };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockRejectedValue(new Error("Failed to load config")); // Simulate config load failure

    process.chdir(projectPath);
    await releaseCommand.parseAsync([], { from: "user" });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error loading airdrop.config.mjs: Failed to load config"));
    expect(process.exit).toHaveBeenCalledWith(1); // Release command stub exits on config load failure
  });

  it("should fail if airdrop.config.mjs is loaded but returns null/undefined (critical for release)", async () => {
    const validProjectInfo: ProjectInfo = {
      isValid: true,
      rootPath: projectPath,
      reasons: ["Valid"],
      isAirdropProject: true,
      isAtRoot: true,
    };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockResolvedValue(null); // Simulate config returning null

    process.chdir(projectPath);
    await releaseCommand.parseAsync([], { from: "user" });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to load airdrop.config.mjs. This file is crucial for release information."));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

});
