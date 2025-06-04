import { describe, it, expect, vi, beforeEach, afterEach, SpyInstance } from "vitest";
import path from "path";
import fs from "fs-extra";

// Adjust paths as necessary
import { build as buildCommand } from "../../../src/commands/build"; // The command object
import { setupTestProject, cleanupTestProject } from "../utils/test-project-helpers";
import * as projectInfoUtils from "../../../src/utils/get-project-info";
import { ProjectInfo } from "../../../src/types/project-info"; // ValidationProjectInfo
import { AIRDROP_CONFIG_FILE, MANIFEST_FILE_YAML, COMMAND_PLACEHOLDERS } from "../../../src/config/constants";
import * as configUtils from "../../../src/utils/get-config"; // To spy on getConfig
import { logger } from "../../../src/utils/logger"; // Direct import for logger

// Mock logger and spinner
vi.mock("../../../src/utils/logger"); // Already mocked, this ensures it's consistently mocked
vi.mock("../../../src/utils/spinner", () => ({
    spinner: vi.fn().mockReturnValue({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        text: "",
    }),
}));


describe("CLI Command: build (Stub)", () => {
  let projectPath: string;
  const testProjectName = "build-stub-test";
  let originalCwd: string;

  let getAirdropProjectValidationSpy: SpyInstance<[string], Promise<ProjectInfo>>;
  let getConfigSpy: SpyInstance<[string], Promise<any>>;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectPath = await setupTestProject(testProjectName);

    await fs.ensureDir(path.join(projectPath, "code", "src"));
    await fs.writeFile(path.join(projectPath, MANIFEST_FILE_YAML), "name: test-project\nslug: test-project\nversion: 1.0.0\ndescription: test\nserviceAccount: {}\nfunctions:\n  - name: testFn");
    // airdrop.config.mjs is optional for build stub, but good to have for consistency
    await fs.writeFile(path.join(projectPath, AIRDROP_CONFIG_FILE), "export default { projectType: 'airdrop' };");
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
    await buildCommand.parseAsync([], { from: "user" });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to validate project"));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should successfully run in a valid project, attempt to load config, and print placeholder", async () => {
    const validProjectInfo: ProjectInfo = {
      isValid: true,
      rootPath: projectPath,
      reasons: ["Valid"],
      isAirdropProject: true,
      isAtRoot: true,
    };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockResolvedValue({ projectType: "airdrop" }); // Mock successful config load

    process.chdir(projectPath);
    await buildCommand.parseAsync([], { from: "user" });

    expect(getAirdropProjectValidationSpy).toHaveBeenCalledWith(projectPath);
    expect(getConfigSpy).toHaveBeenCalledWith(projectPath);
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.build);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("This is a stub command."));
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
    getConfigSpy.mockResolvedValue({ projectType: "airdrop" });

    const subDirPath = path.join(projectPath, "code");
    await fs.ensureDir(subDirPath);
    process.chdir(subDirPath);

    await buildCommand.parseAsync([], { from: "user" });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("You are running 'shadcn build' from a subdirectory."));
    expect(getConfigSpy).toHaveBeenCalledWith(projectPath);
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.build);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should warn but not fail if airdrop.config.mjs cannot be loaded (as per stub logic)", async () => {
    const validProjectInfo: ProjectInfo = {
      isValid: true,
      rootPath: projectPath,
      reasons: ["Valid"],
      isAirdropProject: true,
      isAtRoot: true,
    };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockRejectedValue(new Error("Failed to load config"));

    process.chdir(projectPath);
    await buildCommand.parseAsync([], { from: "user" });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Continuing build without airdrop.config.mjs"));
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.build); // Still prints placeholder
    expect(process.exit).not.toHaveBeenCalled(); // Build stub doesn't exit on config load failure
  });

});
