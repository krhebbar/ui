import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs-extra";
import prompts from "prompts";

// Adjust paths as necessary
import { runInit } from "../../../src/commands/init";
import { setupTestProject, cleanupTestProject } from "../utils/test-project-helpers";
import * as gitUtils from "../../../src/utils/git"; // To spy on cloneTemplate
import { AIRDROP_CONFIG_FILE } from "../../../src/config/constants";
import * as initConfigUtils from "../../../src/utils/init-config"; // To mock template URLs

// Mock external dependencies and utilities
vi.mock("prompts");
vi.mock("execa");
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

// Spy on cloneTemplate instead of fully mocking the git module if specific checks on args are needed.
// Or fully mock it if its internal behavior is not under test.
const cloneTemplateSpy = vi.spyOn(gitUtils, "cloneTemplate").mockResolvedValue(true);


describe("CLI Command: init (Snap-in Projects)", () => {
  let projectPath: string;
  const testProjectNameBase = "init-snapin-test";

  beforeEach(async () => {
    // Mock for getDefaultSnapInTemplate to return a specific template for testing
    vi.spyOn(initConfigUtils, "getDefaultSnapInTemplate").mockReturnValue({
        name: "test-snapin-template",
        description: "A test snap-in template",
        url: "https://example.com/test-snapin-template.git",
    });

    // Default prompts mock for a basic Snap-in project
    prompts.inject([
      "snap-in", // projectType
      "My Test Snapin", // snapInBaseName
      // Sync direction prompt should be skipped
      "Test Snapin External System", // externalSystemName
      "test-snapin-external-system", // externalSystemSlug
      "https://api.snapin.com/v1", // apiBaseUrl
      "/status", // testEndpoint
      ["issues"], // devrevObjects (optional for snapin)
      "external-issues,external-comments", // externalSyncUnits
      "secret", // connectionType
      // Secret specific prompts
      "TEST_SNAPIN_TOKEN_VAR", // tokenEnvVar
      false, // isSubdomain
    ]);
  });

  afterEach(async () => {
    if (projectPath) {
      await cleanupTestProject(projectPath);
    }
    vi.resetAllMocks();
    cloneTemplateSpy.mockClear(); // Clear spy history
  });

  it("should successfully initialize a new Snap-in project and attempt to clone template", async () => {
    projectPath = await setupTestProject(testProjectNameBase);
    const initialOptions = {
      cwd: projectPath,
      components: [],
      yes: false, // Interactive
      force: false,
      silent: false,
      isNewProject: false,
    };

    await runInit(initialOptions);

    const expectedProjectDir = path.join(projectPath, "airdrop-my-test-snapin-snap-in"); // Based on "My Test Snapin"
    expect(await fs.pathExists(expectedProjectDir)).toBe(true);

    // Verify template cloning was called
    expect(cloneTemplateSpy).toHaveBeenCalledOnce();
    expect(cloneTemplateSpy).toHaveBeenCalledWith({
      repoUrl: "https://example.com/test-snapin-template.git", // From mocked getDefaultSnapInTemplate
      targetPath: expectedProjectDir,
    });

    const configFilePath = path.join(expectedProjectDir, AIRDROP_CONFIG_FILE);
    expect(await fs.pathExists(configFilePath)).toBe(true);
    const configFileContent = await fs.readFile(configFilePath, "utf-8");
    expect(configFileContent).toContain("projectType: 'snap-in'");
    expect(configFileContent).not.toContain("syncDirection:"); // Should be skipped for snap-ins
    expect(configFileContent).toContain("slug: 'test-snapin-external-system'");
    expect(configFileContent).toContain("type: 'secret'");
    expect(configFileContent).toContain("id: 'test-snapin-external-system-secret-connection'");
  });

  it("should use default Snap-in name and skip prompts when --yes is used", async () => {
    projectPath = await setupTestProject(testProjectNameBase + "-yes");
    // For --yes with Snap-in, it should use a default name for the snap-in from createDefaultAirdropConfig
    // and then generate the folder name.
    // createDefaultAirdropConfig returns externalSystem.name "External System"
    // which slugifies to "external-system"
    const expectedProjectDirName = "airdrop-external-system-snap-in";

    const initialOptions = {
      cwd: projectPath,
      components: [],
      yes: true,
      force: false,
      silent: false,
      isNewProject: false,
    };

    await runInit(initialOptions);

    const finalProjectPath = path.join(projectPath, expectedProjectDirName);
    expect(await fs.pathExists(finalProjectPath)).toBe(true);
    expect(cloneTemplateSpy).toHaveBeenCalledOnce(); // Should still clone default template

    const configFilePath = path.join(finalProjectPath, AIRDROP_CONFIG_FILE);
    expect(await fs.pathExists(configFilePath)).toBe(true);
    const configFileContent = await fs.readFile(configFilePath, "utf-8");
    expect(configFileContent).toContain("projectType: 'snap-in'"); // Default for snap-in
    expect(configFileContent).not.toContain("syncDirection:");
  });

  // Add more test cases:
  // - Snap-in init with OAuth2 connection type
  // - What happens if template cloning fails (cloneTemplateSpy.mockResolvedValue(false))
  // - Test with --force when airdrop.config.mjs exists for a snap-in
});
