import { describe, it, expect, vi, beforeEach, afterEach, SpyInstance } from "vitest";
import path from "path";
import fs from "fs-extra";
import prompts from "prompts";

// Adjust paths as necessary
import { doctor as doctorCommand } from "../../../src/commands/doctor"; // The command object
import { setupTestProject, cleanupTestProject, populateProjectFromRegistryItem } from "../utils/test-project-helpers";
import * as projectInfoUtils from "../../../src/utils/get-project-info"; // To spy on getAirdropProjectValidation
import * as envValidationUtils from "../../../src/validation/env";
import * as depsValidationUtils from "../../../src/validation/deps";
import * as devrevValidationUtils from "../../../src/validation/devrev"; // Stubs for now
import { MANIFEST_FILE_YAML, ENV_FILE, DEFAULT_ENV_CONTENT, AIRDROP_CONFIG_FILE } from "../../../src/config/constants";
import { ProjectInfo } from "../../../src/types/project-info"; // The ValidationProjectInfo is ProjectInfo

// Mock utilities
vi.mock("prompts");
vi.mock("execa"); // Used by deps validation

// Mock logger and spinner to control output during tests
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

// Default mock implementations for validation utilities
// These can be overridden in specific tests
const mockValidateEnv = vi.spyOn(envValidationUtils, "validateEnv").mockResolvedValue({ isValid: true, summary: "Env valid", issues: [] });
const mockValidateDependencies = vi.spyOn(depsValidationUtils, "validateDependencies").mockResolvedValue({ isValid: true, summary: "Deps valid", issues: [], foundTools: [], missingTools: [] });
const mockValidateDevRev = vi.spyOn(devrevValidationUtils, "validateDevRev").mockResolvedValue({ isValid: true, summary: "DevRev valid (stub)", issues: [] });


describe("CLI Command: doctor", () => {
  let projectPath: string;
  const testProjectName = "doctor-test-project";
  let originalCwd: string;

  // Spy on getAirdropProjectValidation to control its output for different scenarios
  let getAirdropProjectValidationSpy: SpyInstance<[string], Promise<ProjectInfo>>;

  beforeEach(async () => {
    originalCwd = process.cwd();
    // Assuming "fixtures/airdrop-template" contains a basic valid structure
    // For doctor, we might need a manifest.yaml and an empty airdrop.config.mjs for some tests.
    // Let's ensure setupTestProject can copy from a fixture.
    // If not, we might need to manually create these files in projectPath for some tests.
    projectPath = await setupTestProject(testProjectName);
    // Manually create a dummy manifest and config for basic valid project structure
    await fs.writeFile(path.join(projectPath, MANIFEST_FILE_YAML), "name: test-project\ndescription: A test project");
    await fs.ensureDir(path.join(projectPath, "code", "src", "functions"));
    await fs.writeFile(path.join(projectPath, "code", "src", "main.ts"), "// main.ts");
    await fs.writeFile(path.join(projectPath, "code", "src", "index.ts"), "// index.ts");
    await fs.writeFile(path.join(projectPath, AIRDROP_CONFIG_FILE), "export default {};");


    // Default behavior for project validation: valid project at root
    getAirdropProjectValidationSpy = vi.spyOn(projectInfoUtils, "getAirdropProjectValidation").mockResolvedValue({
      isValid: true,
      rootPath: projectPath,
      reasons: ["Project structure and manifest are valid."],
      isAirdropProject: true,
      isAtRoot: true,
    });

    // Reset specific validation mocks
    mockValidateEnv.mockResolvedValue({ isValid: true, summary: "Env valid", issues: [], envPath: path.join(projectPath, ENV_FILE) });
    mockValidateDependencies.mockResolvedValue({ isValid: true, summary: "Deps valid", issues: [], foundTools: ["Node.js", "npm"], missingTools: [] });
    mockValidateDevRev.mockResolvedValue({ isValid: true, summary: "DevRev valid (stub)", issues: [] });

    // Mock process.exit to prevent tests from stopping
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);
  });

  afterEach(async () => {
    process.chdir(originalCwd); // Restore CWD
    if (projectPath) {
      await cleanupTestProject(projectPath);
    }
    vi.resetAllMocks();
  });

  it("should report success for a valid project with all checks passing", async () => {
    process.chdir(projectPath); // Simulate running from project root
    await doctorCommand.parseAsync([], { from: "user" });

    expect(getAirdropProjectValidationSpy).toHaveBeenCalledWith(projectPath);
    expect(mockValidateEnv).toHaveBeenCalledWith(projectPath, false); // false for --fix by default
    expect(mockValidateDependencies).toHaveBeenCalledWith(false);
    expect(mockValidateDevRev).toHaveBeenCalledWith(expect.objectContaining({ rootPath: projectPath }), false);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should detect and report an invalid project structure", async () => {
    getAirdropProjectValidationSpy.mockResolvedValue({
      isValid: false,
      rootPath: projectPath,
      reasons: ["Missing code/src directory."],
      isAirdropProject: true,
      isAtRoot: true,
    });
    process.chdir(projectPath);
    await doctorCommand.parseAsync([], { from: "user" });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should detect missing .env file and report it", async () => {
    mockValidateEnv.mockResolvedValue({
        isValid: false,
        summary: ".env missing",
        issues: [".env file is missing."],
        envPath: path.join(projectPath, ENV_FILE)
    });
    process.chdir(projectPath);
    await doctorCommand.parseAsync([], { from: "user" });

    expect(mockValidateEnv).toHaveBeenCalledWith(projectPath, false);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should attempt to fix missing .env file when --fix is used", async () => {
    // Simulate .env missing initially, then created by validateEnv
    mockValidateEnv.mockImplementationOnce(async (root, fix) => {
        if (fix && root) { // Added null check for root
            // Simulate creation
            await fs.writeFile(path.join(root, ENV_FILE), DEFAULT_ENV_CONTENT);
            // Assuming validateEnv now considers it valid enough or returns specific issues for placeholders
            return { isValid: false, summary: "Created .env, please update placeholders.", issues: ["Newly created .env requires your DEV_ORG and USER_IMAIL."], envPath: path.join(root, ENV_FILE) };
        }
        return { isValid: false, summary: ".env missing", issues: [".env file is missing."], envPath: root ? path.join(root, ENV_FILE) : undefined };
    });
    prompts.inject([true]); // Confirm creation of .env

    process.chdir(projectPath);
    await doctorCommand.parseAsync(["--fix"], { from: "user" });

    expect(mockValidateEnv).toHaveBeenCalledWith(projectPath, true); // true for --fix
    // If `validateEnv` still returns issues (like "update placeholders"), exit(1) will be called.
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(await fs.pathExists(path.join(projectPath, ENV_FILE))).toBe(true);
  });

  it("should detect missing dependencies and report them", async () => {
    const missingTool = { name: "devrev", command: "devrev --version", installLink: "link", purpose: "testing" };
    mockValidateDependencies.mockResolvedValue({
        isValid: false,
        summary: "Deps missing",
        issues: ["devrev not found"],
        foundTools: ["Node.js", "npm"],
        missingTools: [missingTool]
    });
    process.chdir(projectPath);
    await doctorCommand.parseAsync([], { from: "user" });

    expect(mockValidateDependencies).toHaveBeenCalledWith(false);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  // Add more tests:
  // - Project with incomplete .env (missing DEV_ORG)
  // - Project with invalid manifest.yml (using populateProjectFromRegistryItem with a bad manifest)
  // - Project with missing airdrop.config.mjs when it's expected
  // - Running doctor from a subdirectory (isAtRoot: false)
  // - Different --project-type flags
});
