import { describe, it, expect, vi, beforeEach, afterEach, SpyInstance } from "vitest";
import path from "path";
import fs from "fs-extra";

// Adjust paths as necessary
import { dev as devCommand } from "../../../src/commands/dev"; // The command object
import { setupTestProject, cleanupTestProject } from "../utils/test-project-helpers";
import * as projectInfoUtils from "../../../src/utils/get-project-info";
import { ProjectInfo } from "../../../src/types/project-info"; // ValidationProjectInfo is ProjectInfo
import { AIRDROP_CONFIG_FILE, MANIFEST_FILE_YAML, COMMAND_PLACEHOLDERS } from "../../../src/config/constants";
import * as configUtils from "../../../src/utils/get-config"; // To spy on getConfig
import { logger } from "../../../src/utils/logger"; // Import the mocked logger

// Mock logger and spinner
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    break: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock("../../../src/utils/spinner", () => ({
    spinner: vi.fn().mockReturnValue({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        text: "",
    }),
}));


describe("CLI Command: dev (Stub)", () => {
  let projectPath: string;
  const testProjectName = "dev-stub-test";
  let originalCwd: string;

  let getAirdropProjectValidationSpy: SpyInstance<[string], Promise<ProjectInfo>>;
  let getConfigSpy: SpyInstance<[string], Promise<any>>; // Replace 'any' with actual config type if available

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectPath = await setupTestProject(testProjectName);

    // Create minimal valid project files for tests
    await fs.ensureDir(path.join(projectPath, "code", "src"));
    await fs.writeFile(path.join(projectPath, MANIFEST_FILE_YAML), "name: test-project\nslug: test-project\nversion: 1.0.0\ndescription: test\nserviceAccount: {}\nfunctions:\n  - name: testFn");
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
      rootPath: projectPath, // or null
      reasons: ["Invalid project structure"],
      isAirdropProject: false,
      isAtRoot: true,
    });
    process.chdir(projectPath);
    await devCommand.parseAsync([], { from: "user" });

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
    getConfigSpy.mockResolvedValue({ projectType: "airdrop" }); // Mock successful config load

    process.chdir(projectPath);
    await devCommand.parseAsync([], { from: "user" });

    expect(getAirdropProjectValidationSpy).toHaveBeenCalledWith(projectPath);
    expect(getConfigSpy).toHaveBeenCalledWith(projectPath);
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.dev);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("This is a stub command."));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should warn if run from a subdirectory but still proceed", async () => {
    const validProjectInfo: ProjectInfo = {
      isValid: true,
      rootPath: projectPath,
      reasons: ["Valid"],
      isAirdropProject: true,
      isAtRoot: false, // Key for this test
    };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockResolvedValue({ projectType: "airdrop" });

    const subDirPath = path.join(projectPath, "code"); // Simulate running from a subdir
    await fs.ensureDir(subDirPath);
    process.chdir(subDirPath);

    await devCommand.parseAsync([], { from: "user" });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("You are running 'shadcn dev' from a subdirectory."));
    expect(getConfigSpy).toHaveBeenCalledWith(projectPath); // Should use rootPath
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.dev);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should fail if snapin.config.mjs cannot be loaded", async () => {
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
    await devCommand.parseAsync([], { from: "user" });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error loading snapin.config.mjs"));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

});
