import { describe, it, expect, vi, beforeEach, afterEach, SpyInstance } from "vitest";
import path from "path";
import fs from "fs-extra";

// Adjust paths as necessary
import { logs as logsCommand } from "../../../src/commands/logs"; // The command object
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

// To capture action handler options if we replace the action
let capturedActionOptions: any;
const actionSpyPlaceholder = vi.fn((options) => {
  capturedActionOptions = options;
});


describe("CLI Command: logs (Stub)", () => {
  let projectPath: string;
  const testProjectName = "logs-stub-test";
  let originalCwd: string;
  let originalActionHandler: any;

  let getAirdropProjectValidationSpy: SpyInstance<[string], Promise<ProjectInfo>>;
  let getConfigSpy: SpyInstance<[string], Promise<any>>;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectPath = await setupTestProject(testProjectName);

    await fs.ensureDir(path.join(projectPath, "code", "src"));
    await fs.writeFile(path.join(projectPath, MANIFEST_FILE_YAML), "name: test-project\nslug: test-project\nversion: 1.0.0\ndescription: test\nserviceAccount: {}\nfunctions:\n  - name: testFn");
    await fs.writeFile(path.join(projectPath, AIRDROP_CONFIG_FILE), "export default { projectType: 'airdrop' };");
    await fs.writeFile(path.join(projectPath, "code", "src", "main.ts"), "// main.ts");
    await fs.writeFile(path.join(projectPath, "code", "src", "index.ts"), "// index.ts");

    getAirdropProjectValidationSpy = vi.spyOn(projectInfoUtils, "getAirdropProjectValidation");
    getConfigSpy = vi.spyOn(configUtils, "getConfig");

    // Store original action handler and replace with a spy OR let original run and check effects
    originalActionHandler = logsCommand._actionHandler;
    capturedActionOptions = null; // Reset captured options

    vi.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (projectPath) {
      await cleanupTestProject(projectPath);
    }
    vi.resetAllMocks();
    // Restore original action handler if it was replaced
    if (originalActionHandler) {
        logsCommand._actionHandler = originalActionHandler;
    }
  });

  it("should fail if not in a valid Airdrop project", async () => {
    // Let original action run to check its internal logic
    getAirdropProjectValidationSpy.mockResolvedValue({
      isValid: false,
      rootPath: projectPath,
      reasons: ["Invalid project structure"],
      isAirdropProject: false,
      isAtRoot: true,
    });
    process.chdir(projectPath);
    await logsCommand.parseAsync([], { from: "user" });

    expect(getAirdropProjectValidationSpy).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to validate project"));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should successfully run in a valid project, load config, print placeholder, and show default options", async () => {
    // Let original action run
    const validProjectInfo: ProjectInfo = {
      isValid: true,
      rootPath: projectPath,
      reasons: ["Valid"],
      isAirdropProject: true,
      isAtRoot: true,
    };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockResolvedValue({ projectType: "airdrop" });

    process.chdir(projectPath);
    await logsCommand.parseAsync([], { from: "user" });

    expect(getAirdropProjectValidationSpy).toHaveBeenCalledWith(projectPath);
    expect(getConfigSpy).toHaveBeenCalledWith(projectPath);
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.logs);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("This is a stub command."));
    expect(process.exit).not.toHaveBeenCalled();

    // Check default options passed to the (original) action by inspecting logger calls made by it
    expect(logger.info).toHaveBeenCalledWith("Options: lines=100, since=not set, follow=false");
  });

  it("should parse custom options correctly and pass them to the action", async () => {
    // Let original action run
    const validProjectInfo: ProjectInfo = { isValid: true, rootPath: projectPath, reasons: ["Valid"], isAirdropProject: true, isAtRoot: true };
    getAirdropProjectValidationSpy.mockResolvedValue(validProjectInfo);
    getConfigSpy.mockResolvedValue({ projectType: "airdrop" });

    process.chdir(projectPath);
    // These options are defined in logs.ts: .option("-n, --lines <number>", ..., "100"), .option("--since <time>"), .option("--follow", ..., false)
    await logsCommand.parseAsync(["--lines", "50", "--since", "2h", "--follow"], { from: "user" });

    // Check that the logger inside the original action was called with these options
    expect(logger.info).toHaveBeenCalledWith("Options: lines=50, since=2h, follow=true");
    expect(process.exit).not.toHaveBeenCalled();
  });

  // Test for running from subdirectory
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

    const subDirPath = path.join(projectPath, "code");
    await fs.ensureDir(subDirPath);
    process.chdir(subDirPath);

    await logsCommand.parseAsync([], { from: "user" });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("You are running 'shadcn logs' from a subdirectory."));
    expect(getConfigSpy).toHaveBeenCalledWith(projectPath); // Should use rootPath
    expect(logger.info).toHaveBeenCalledWith(COMMAND_PLACEHOLDERS.logs);
    expect(process.exit).not.toHaveBeenCalled();
  });


});
