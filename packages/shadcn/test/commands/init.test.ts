import { vi, afterEach, beforeEach, describe, expect, test, type MockedFunction } from "vitest";

// Mock 'prompts' at the very top, after importing vi.
const mockPromptResponses = { current: {} as Record<string, any> };
vi.mock("prompts", () => ({
  default: vi.fn(async (questions: any | any[]) => {
    const responsesToUse = mockPromptResponses.current;
    if (Array.isArray(questions)) {
      const answers = {};
      for (const question of questions) {
        if (question.name && responsesToUse.hasOwnProperty(question.name)) {
          answers[question.name] = responsesToUse[question.name];
        } else {
          // console.warn(`Mocked prompt (array): '${question.name}' received no specific response.`);
          answers[question.name] = undefined;
        }
      }
      return answers;
    }
    // Single question object
    if (questions && questions.name && responsesToUse.hasOwnProperty(questions.name)) {
      return { [questions.name]: responsesToUse[questions.name] };
    }
    // console.warn(`Mocked prompt (single): '${questions?.name}' received no specific response.`);
    return {};
  }),
  __esModule: true, // Important for ESM modules
}));

import path from "path";
import fs from "fs-extra";
// Note: 'prompts' is not imported directly as it's fully mocked.
// vi, afterEach, etc. are imported from vitest at the top.
import {
  runInitCommand,
  createTempDirWithStructure,
  cleanupTempDir,
} from "../utils/init-helpers";

const FIXTURES_PATH = path.resolve(__dirname, "../fixtures/init-projects");

describe("init command", () => {
  let tempProjectDir: string;

  beforeEach(async () => {
    tempProjectDir = await createTempDirWithStructure("init-basic");
    mockPromptResponses.current = {}; // Reset responses before each test
  });

  afterEach(async () => {
    if (tempProjectDir) { // This tempProjectDir is for "Basic Creation"
         await cleanupTempDir(tempProjectDir);
         tempProjectDir = "";
    }
    vi.resetAllMocks();
  });

  describe("Basic Creation", () => {
    test("should create a new project with expected folder structure (manifest.yml, code/)", async () => {
      const projectDir = tempProjectDir;
      const result = await runInitCommand(projectDir, ["-y"], []);

      const baseProjectPath = path.join(projectDir, "airdrop-external-system");
      // Removed console.log for debugging
      const manifestPath = path.join(baseProjectPath, "manifest.yaml");
      expect(await fs.pathExists(manifestPath), `manifest.yaml not found in ${baseProjectPath}. CLI output: ${JSON.stringify(result)}`).toBe(true);
      const codeDirPath = path.join(baseProjectPath, "code");
      expect(await fs.pathExists(codeDirPath), `code/ directory not found in ${baseProjectPath}. CLI output: ${JSON.stringify(result)}`).toBe(true);
      const codeDirStat = await fs.stat(codeDirPath);
      expect(codeDirStat.isDirectory()).toBe(true);
      const envPath = path.join(baseProjectPath, ".env");
      expect(await fs.pathExists(envPath), `.env file not found in ${baseProjectPath}. CLI output: ${JSON.stringify(result)}`).toBe(true);
    });

    test("should create .env with default values for non-interactive mode", async () => {
      const projectDir = tempProjectDir;
      const result = await runInitCommand(projectDir, ["-y"], []);
      const baseProjectPath = path.join(projectDir, "airdrop-external-system");

      // Removed console.log for debugging
      const envPath = path.join(baseProjectPath, ".env");
      expect(await fs.pathExists(envPath), `.env file not found in ${baseProjectPath}. CLI output: ${JSON.stringify(result)}`).toBe(true);
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("EXTERNAL_SYSTEM_CLIENT_ID=your-client-id-here");
      expect(envContent).toContain("EXTERNAL_SYSTEM_CLIENT_SECRET=your-client-secret-here");
      expect(envContent).toContain("DEVREV_PAT=your-devrev-pat-here");
      expect(envContent).toContain("DEVREV_ORG=your-devrev-org-slug-here");
    });
  });

  describe("Directory Context", () => {
    let projectDirTwo: string;

    afterEach(async () => {
      if (projectDirTwo) {
        await cleanupTempDir(projectDirTwo);
        projectDirTwo = "";
      }
    });

    test("should not error when re-initializing with -y in an existing project (but skip config overwrite)", async () => {
      projectDirTwo = await createTempDirWithStructure("existing-project-reinit");
      const firstRunResult = await runInitCommand(projectDirTwo, ["-y"], []);
      expect(firstRunResult.exitCode).toBe(0);
      const actualProjectRoot = path.join(projectDirTwo, "airdrop-external-system");
      expect(await fs.pathExists(path.join(actualProjectRoot, "manifest.yaml"))).toBe(true);
      expect(await fs.pathExists(path.join(actualProjectRoot, "snapin.config.mjs"))).toBe(true);
      const secondRunResult = await runInitCommand(actualProjectRoot, ["-y"], []);
      expect(secondRunResult.exitCode).toBe(0);
      expect(secondRunResult.stdout).toContain("Project configuration (snapin.config.mjs) already exists. Skipping overwrite due to --yes without --force.");
      expect(secondRunResult.stdout).toContain("Airdrop project initialization completed.");
    });
  });

  describe("External Object Types (Interactive)", () => {
    let localTempProjectDir: string;

    afterEach(async () => {
      if (localTempProjectDir) {
        await cleanupTempDir(localTempProjectDir);
        localTempProjectDir = "";
      }
    });

    test("should include 'tickets', 'conversations' in manifest if provided by user", async () => {
      localTempProjectDir = await createTempDirWithStructure("ext-obj-provided");
      mockPromptResponses.current = {
        projectType: "airdrop",
        airdropProjectName: "airdrop-obj-test-project",
        syncDirection: "two-way",
        externalSystemName: "Obj Test External System",
        externalSystemSlug: "obj-test-external-system",
        apiBaseUrl: "https://api.example.com",
        testEndpoint: "https://api.example.com/test",
        externalSyncUnits: ["tickets", "conversations"],
        connectionType: "secret",
        tokenEnvVar: "OBJ_TEST_TOKEN_VAR",
        isSubdomain: false,
        devrevObjects: ["dm"],
        devrevPatEnvVarName: "MY_PAT_VAR_INTERACTIVE_OBJ",
        devrevOrgEnvVarName: "MY_ORG_VAR_INTERACTIVE_OBJ",
      };

      const result = await runInitCommand(localTempProjectDir, [], []);
      expect(result.exitCode).toBe(0, `CLI failed with: ${result.stderr || result.stdout}`);

      const projectSubDir = path.join(localTempProjectDir, "airdrop-obj-test-project");
      const manifestPath = path.join(projectSubDir, "manifest.yaml");
      expect(await fs.pathExists(manifestPath)).toBe(true, `Manifest not found. CLI output: ${result.stdout}`);
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      expect(manifestContent).toMatch(/external_object_types:\s*[\r\n]+(\s*-\s*tickets\s*[\r\n]+)(\s*-\s*conversations)/m);

      const envPath = path.join(projectSubDir, ".env");
      expect(await fs.pathExists(envPath)).toBe(true);
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("MY_PAT_VAR_INTERACTIVE_OBJ=your-devrev-pat-here");
      expect(envContent).toContain("MY_ORG_VAR_INTERACTIVE_OBJ=your-devrev-org-slug-here");
      expect(envContent).toContain("OBJ_TEST_TOKEN_VAR=your-api-token-here");
    });

    test("object types should remain empty or not be added if user presses enter (empty input)", async () => {
      localTempProjectDir = await createTempDirWithStructure("ext-obj-empty");
      mockPromptResponses.current = {
        projectType: "airdrop",
        airdropProjectName: "airdrop-empty-obj-project",
        syncDirection: "one-way",
        externalSystemName: "Empty Obj External System",
        externalSystemSlug: "empty-obj-external-system",
        apiBaseUrl: "https://api.example.com",
        testEndpoint: "https://api.example.com/test",
        externalSyncUnits: [],
        connectionType: "oauth2",
        clientIdEnvVar: "EMPTY_CLIENT_ID_INTERACTIVE",
        clientSecretEnvVar: "EMPTY_CLIENT_SECRET_INTERACTIVE",
        authorizeUrl: "https://api.example.com/oauth/authorize",
        tokenUrl: "https://api.example.com/oauth/token",
        scope: "read",
        devrevObjects: ["works"],
        devrevPatEnvVarName: "EMPTY_PAT_VAR_INTERACTIVE",
        devrevOrgEnvVarName: "EMPTY_ORG_VAR_INTERACTIVE",
      };

      const result = await runInitCommand(localTempProjectDir, [], []);
      expect(result.exitCode).toBe(0, `CLI failed with: ${result.stderr || result.stdout}`);

      const projectSubDir = path.join(localTempProjectDir, "airdrop-empty-obj-project");
      const manifestPath = path.join(projectSubDir, "manifest.yaml");
      expect(await fs.pathExists(manifestPath)).toBe(true);
      const manifestContent = await fs.readFile(manifestPath, "utf-8");

      expect(manifestContent).not.toMatch(/external_object_types:/);
      if (!manifestContent.includes("some_other_capability:")) {
        expect(manifestContent).not.toMatch(/devrev_platform_extends_capabilities:/);
      }
      const envPath = path.join(projectSubDir, ".env");
      expect(await fs.pathExists(envPath)).toBe(true);
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("EMPTY_PAT_VAR_INTERACTIVE=your-devrev-pat-here");
      expect(envContent).toContain("EMPTY_ORG_VAR_INTERACTIVE=your-devrev-org-slug-here");
      expect(envContent).toContain("EMPTY_CLIENT_ID_INTERACTIVE=your-client-id-here");
      expect(envContent).toContain("EMPTY_CLIENT_SECRET_INTERACTIVE=your-client-secret-here");
    });
  });

  describe("Manifest File", () => {
    let localTempProjectDir: string;

    afterEach(async () => {
      if (localTempProjectDir) {
        await cleanupTempDir(localTempProjectDir);
        localTempProjectDir = "";
      }
    });

    test("interactive airdrop manifest should default to airdrop type and contain expected fields", async () => {
      localTempProjectDir = await createTempDirWithStructure("manifest-interactive-clean");
      mockPromptResponses.current = {
        projectType: "airdrop",
        airdropProjectName: "airdrop-manifest-test-project",
        syncDirection: "two-way",
        externalSystemName: "Manifest Test System",
        externalSystemSlug: "manifest-test-system",
        apiBaseUrl: "https://api.example.com",
        testEndpoint: "https://api.example.com/test",
        externalSyncUnits: [],
        connectionType: "secret",
        tokenEnvVar: "MTS_TOKEN_VAR_INTERACTIVE",
        isSubdomain: false,
        devrevObjects: ["works"],
        devrevPatEnvVarName: "PAT_MANIFEST_TEST_INTERACTIVE",
        devrevOrgEnvVarName: "ORG_MANIFEST_TEST_INTERACTIVE",
      };

      const result = await runInitCommand(localTempProjectDir, [], []);
      expect(result.exitCode).toBe(0, `CLI failed with: ${result.stderr || result.stdout}`);

      const projectSubDir = path.join(localTempProjectDir, "airdrop-manifest-test-project");
      const manifestPath = path.join(projectSubDir, "manifest.yaml");
      expect(await fs.pathExists(manifestPath)).toBe(true);
      const manifestContent = await fs.readFile(manifestPath, "utf-8");

      expect(manifestContent).toMatch(/^type: airdrop/m);
      expect(manifestContent).toMatch(/^slug: manifest-test-system/m);
      expect(manifestContent).toMatch(/^connection:/m);
      expect(manifestContent).toMatch(/^name: Manifest Test System/m);

      const envPath = path.join(projectSubDir, ".env");
      expect(await fs.pathExists(envPath)).toBe(true);
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("PAT_MANIFEST_TEST_INTERACTIVE=your-devrev-pat-here");
      expect(envContent).toContain("ORG_MANIFEST_TEST_INTERACTIVE=your-devrev-org-slug-here");
      expect(envContent).toContain("MTS_TOKEN_VAR_INTERACTIVE=your-api-token-here");
    });

    test("should not include snap-in type or user-defined connection fields by default (non-interactive -y airdrop)", async () => {
      localTempProjectDir = await createTempDirWithStructure("manifest-non-interactive-clean");
      // currentMockResponses is already reset by beforeEach in this describe block
      await runInitCommand(localTempProjectDir, ["-y"], []);
      const manifestPath = path.join(localTempProjectDir, "airdrop-external-system", "manifest.yaml");
      expect(await fs.pathExists(manifestPath)).toBe(true);
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      expect(manifestContent).toMatch(/^type: airdrop/m);
      expect(manifestContent).not.toMatch(/^type:\s*(snap-in|snap_in)/m);
      expect(manifestContent).toMatch(/^connection:/m);
      expect(manifestContent).toMatch(/^name: External System/m);
      expect(manifestContent).toMatch(/^version:/m);
    });

    test("ensure manifest is clean and includes only required sections (interactive airdrop)", async () => {
      localTempProjectDir = await createTempDirWithStructure("manifest-interactive-required");
      mockPromptResponses.current = {
        projectType: "airdrop",
        airdropProjectName: "airdrop-clean-manifest-project",
        syncDirection: "one-way",
        externalSystemName: "Clean External System",
        externalSystemSlug: "clean-external-system",
        apiBaseUrl: "https://clean.example.com",
        testEndpoint: "https://clean.example.com/health",
        externalSyncUnits: ["custom_objects"],
        connectionType: "oauth2",
        clientIdEnvVar: "CLEAN_CLIENT_ID_INTERACTIVE_REQ",
        clientSecretEnvVar: "CLEAN_CLIENT_SECRET_INTERACTIVE_REQ",
        authorizeUrl: "https://clean.example.com/oauth/authorize",
        tokenUrl: "https://clean.example.com/oauth/token",
        scope: "api:read",
        devrevObjects: ["works", "tags"],
        devrevPatEnvVarName: "MY_CLEAN_PAT_VAR_INTERACTIVE_REQ",
        devrevOrgEnvVarName: "MY_CLEAN_ORG_VAR_INTERACTIVE_REQ",
      };

      const result = await runInitCommand(localTempProjectDir, [], []);
      expect(result.exitCode).toBe(0, `CLI failed with: ${result.stderr || result.stdout}`);

      const projectSubDir = path.join(localTempProjectDir, "airdrop-clean-manifest-project");
      const manifestPath = path.join(projectSubDir, "manifest.yaml");
      expect(await fs.pathExists(manifestPath)).toBe(true);
      const manifestContent = await fs.readFile(manifestPath, "utf-8");

      expect(manifestContent).toMatch(/^name: Clean External System/m);
      expect(manifestContent).toMatch(/^version:/m);
      expect(manifestContent).toMatch(/^display_name: Clean External System/m);
      expect(manifestContent).toMatch(/description:/m);
      expect(manifestContent).toMatch(/external_object_types:\s*[\r\n]+(\s*-\s*custom_objects)/m);
      expect(manifestContent).toMatch(/^type: airdrop/m);
      expect(manifestContent).toMatch(/^connection:/m);
      expect(manifestContent).toMatch(/id: clean-external-system-oauth-connection/m);

      const envPath = path.join(projectSubDir, ".env");
      expect(await fs.pathExists(envPath)).toBe(true);
      const envContent = await fs.readFile(envPath, "utf-8");
      expect(envContent).toContain("MY_CLEAN_PAT_VAR_INTERACTIVE_REQ=your-devrev-pat-here");
      expect(envContent).toContain("MY_CLEAN_ORG_VAR_INTERACTIVE_REQ=your-devrev-org-slug-here");
      expect(envContent).toContain("CLEAN_CLIENT_ID_INTERACTIVE_REQ=your-client-id-here");
      expect(envContent).toContain("CLEAN_CLIENT_SECRET_INTERACTIVE_REQ=your-client-secret-here");
    });

    test("ensure manifest is clean and includes only required sections (non-interactive -y airdrop)", async () => {
      localTempProjectDir = await createTempDirWithStructure("manifest-non-interactive-required");
      // currentMockResponses is already reset by the top-level beforeEach
      await runInitCommand(localTempProjectDir, ["-y"], []);
      const manifestPath = path.join(localTempProjectDir, "airdrop-external-system", "manifest.yaml");
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      expect(manifestContent).toMatch(/^name: External System/m);
      expect(manifestContent).toMatch(/^version:/m);
      expect(manifestContent).toMatch(/^display_name: External System/m);
      expect(manifestContent).toMatch(/^author:/m);
      expect(manifestContent).toMatch(/description:/m);
      expect(manifestContent).toMatch(/^type: airdrop/m);
      expect(manifestContent).toMatch(/^connection:/m);
      expect(manifestContent).not.toMatch(/external_object_types:/m);
    });
  });
});
