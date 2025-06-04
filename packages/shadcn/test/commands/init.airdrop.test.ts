import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs-extra";
import prompts from "prompts"; // For mocking

// Adjust paths as necessary for your project structure
import { runInit } from "../../../src/commands/init"; // The actual init command logic
import { setupTestProject, cleanupTestProject } from "../utils/test-project-helpers";
import { AirdropProjectConfig } from "../../../src/type/airdrop-config"; // For type checking
import { AIRDROP_CONFIG_FILE, MANIFEST_FILE_YAML } from "../../../src/config/constants";

// Mock external dependencies and utilities
vi.mock("prompts");
vi.mock("execa"); // If init calls git or other CLIs directly (e.g. for git clone)
vi.mock("../../../src/utils/git", () => ({ // Mock our git utility
  cloneTemplate: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../../src/utils/logger", () => ({ // Mock logger to prevent console noise
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    break: vi.fn(),
    debug: vi.fn(),
    // Removed Без_темы: vi.fn()
  },
}));
vi.mock("../../../src/utils/spinner", () => ({ // Mock spinner
    spinner: vi.fn().mockReturnValue({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        text: "",
    }),
}));


describe("CLI Command: init (Airdrop Projects)", () => {
  let projectPath: string;
  const testProjectName = "init-airdrop-test";

  beforeEach(async () => {
    // Default prompts mock for a basic Airdrop project
    prompts.inject([
      "airdrop", // projectType
      "airdrop-my-test-connector", // airdropProjectName
      "two-way", // syncDirection
      "Test External System", // externalSystemName
      "test-external-system", // externalSystemSlug (will be auto-generated/confirmed)
      "https://api.test.com/v1", // apiBaseUrl
      "/me", // testEndpoint
      ["tickets", "users"], // devrevObjects
      "external-tickets,external-users", // externalSyncUnits
      "oauth2", // connectionType
      // OAuth2 specific prompts
      "TEST_CLIENT_ID_VAR",
      "TEST_CLIENT_SECRET_VAR",
      "https://api.test.com/oauth/authorize",
      "https://api.test.com/oauth/token",
      "read write",
    ]);
  });

  afterEach(async () => {
    if (projectPath) {
      await cleanupTestProject(projectPath);
    }
    vi.resetAllMocks(); // Reset mocks for each test
  });

  it("should successfully initialize a new Airdrop project with default OAuth2 settings", async () => {
    projectPath = await setupTestProject(testProjectName);
    const initialOptions = {
      cwd: projectPath,
      components: [],
      yes: false, // Interactive mode
      force: false,
      silent: false,
      isNewProject: false, // Let runInit determine this based on prompts / preflight
    };

    await runInit(initialOptions);

    // 1. Verify project directory was created (based on prompted name)
    const expectedProjectDir = path.join(projectPath, "airdrop-my-test-connector");
    expect(await fs.pathExists(expectedProjectDir)).toBe(true);

    // 2. Verify airdrop.config.mjs was created
    const configFilePath = path.join(expectedProjectDir, AIRDROP_CONFIG_FILE);
    expect(await fs.pathExists(configFilePath)).toBe(true);

    // 3. Verify manifest.yaml (or .yml) was created (often part of template or initial setup)
    // For a new project, init might create a basic one or expect one from a template.
    // If `createProject` in `init.ts` creates one, test for it.
    // For now, let's assume it might not create one if not a snap-in with template.
    // We'll refine this assertion based on actual `init` behavior for new Airdrop projects.
    // For this test, let's assume a basic manifest is created by `createProject` utility
    // or that the test setup should create one if `init` doesn't.
    // For now, we'll just check if the config file is there.

    // 4. Verify content of airdrop.config.mjs (simplified check)
    const configFileContent = await fs.readFile(configFilePath, "utf-8");
    expect(configFileContent).toContain("projectType: 'airdrop'");
    expect(configFileContent).toContain("syncDirection: 'two-way'");
    expect(configFileContent).toContain("slug: 'test-external-system'");
    expect(configFileContent).toContain("type: 'oauth2'");
    expect(configFileContent).toContain("clientId: 'process.env.TEST_CLIENT_ID_VAR'");
  });

  it("should use default values and skip prompts when --yes is used", async () => {
    projectPath = await setupTestProject(testProjectName + "-yes");
     // In --yes mode for a new project, it uses default names or fails if dir not empty.
    // Let's assume it creates a default named project inside projectPath.
    // The `createDefaultAirdropConfig` will be used.
    const defaultAirdropConfig = { // Simplified version of what createDefaultAirdropConfig might produce
        projectType: "airdrop",
        externalSystem: { slug: "external-system", name: "External System" }
    };
    const expectedProjectDirName = `airdrop-${defaultAirdropConfig.externalSystem.slug}`;


    const initialOptions = {
      cwd: projectPath, // runInit will append expectedProjectDirName to this
      components: [],
      yes: true,
      force: false,
      silent: false, // Keep silent false to see logs if any (though logger is mocked)
      isNewProject: false, // Let it be determined
    };

    // No prompts.inject for --yes, as it should use defaults.

    await runInit(initialOptions);

    const finalProjectPath = path.join(projectPath, expectedProjectDirName);
    expect(await fs.pathExists(finalProjectPath)).toBe(true);

    const configFilePath = path.join(finalProjectPath, AIRDROP_CONFIG_FILE);
    expect(await fs.pathExists(configFilePath)).toBe(true);
    const configFileContent = await fs.readFile(configFilePath, "utf-8");
    expect(configFileContent).toContain("projectType: 'airdrop'"); // Default
    expect(configFileContent).toContain("syncDirection: 'two-way'"); // Default
  });

  // Add more test cases:
  // - Invalid Airdrop project name (e.g., "myproject" instead of "airdrop-myproject")
  // - Init with Secret connection type
  // - Init with --force when airdrop.config.mjs exists
  // - Init in an existing non-empty directory (not a new project)

});
