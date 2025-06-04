import fs from "fs-extra";
import path from "path";
import os from "os";
// Assuming loadRegistryItem will be in a separate file as per the plan,
// we might import it later if needed directly here, or expect parsed data.

/**
 * Creates a temporary directory for a test project.
 * Optionally copies from a base fixture.
 * @param testName - A descriptive name for the test or project, used to create a unique directory.
 * @param baseFixturePath - Optional path to a fixture to copy into the test project.
 * @returns The absolute path to the created test project directory.
 */
export async function setupTestProject(
  testName: string,
  baseFixturePath?: string
): Promise<string> {
  // Create a unique temporary directory path
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `shadcn-cli-test-${testName}-`));

  if (baseFixturePath) {
    const fixtureSourcePath = path.resolve(__dirname, "..", baseFixturePath); // Assuming fixtures are relative to test dir
    if (await fs.pathExists(fixtureSourcePath)) {
      await fs.copy(fixtureSourcePath, tempDir);
    } else {
      console.warn(`Fixture path ${fixtureSourcePath} does not exist. Test project will be empty.`);
    }
  }
  return tempDir;
}

/**
 * Removes the temporary test project directory.
 * @param projectPath - The absolute path to the test project directory to remove.
 */
export async function cleanupTestProject(projectPath: string): Promise<void> {
  if (await fs.pathExists(projectPath)) {
    await fs.remove(projectPath);
  }
}

/**
 * Populates a project directory with files specified in a registry item's JSON data.
 * @param projectPath - The root path of the test project.
 * @param registryItemData - The parsed JSON data from a registry-item.json.
 * @param registryBasePath - The base path where registry item files are located (e.g., "apps/web/registry/default").
 */
export async function populateProjectFromRegistryItem(
  projectPath: string,
  registryItemData: any, // Replace 'any' with a more specific type if available for registry items
  registryBasePath: string
): Promise<void> {
  if (!registryItemData || !registryItemData.files || !Array.isArray(registryItemData.files)) {
    console.warn("No files found in registry item data or data is malformed.");
    return;
  }

  for (const fileEntry of registryItemData.files) {
    if (typeof fileEntry.path !== "string" || typeof fileEntry.target !== "string") {
      console.warn("Skipping invalid file entry in registry item:", fileEntry);
      continue;
    }

    const sourceFilePath = path.resolve(registryBasePath, fileEntry.path);

    // Interpret target path: "~/" means project root.
    let targetFilePath = fileEntry.target;
    if (targetFilePath.startsWith("~/")) {
      targetFilePath = targetFilePath.substring(2); // Remove "~/"
    }
    targetFilePath = path.resolve(projectPath, targetFilePath);

    if (await fs.pathExists(sourceFilePath)) {
      try {
        await fs.ensureDir(path.dirname(targetFilePath)); // Ensure target directory exists
        await fs.copyFile(sourceFilePath, targetFilePath);
      } catch (error) {
        console.error(`Failed to copy file from ${sourceFilePath} to ${targetFilePath}:`, error);
      }
    } else {
      console.warn(`Source file ${sourceFilePath} specified in registry item does not exist.`);
    }
  }
}
