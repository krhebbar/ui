import path from "path";
import fs from "fs-extra";
import { AirdropProjectConfig } from "../../types/airdrop-config";
import { writeSnapInConfig } from "../../utils/airdrop-config";
import { copyConfigTypes, generateTypeDefinitions } from "../../utils/type-generator";
import { logger } from "../../utils/logger";
import { highlighter } from "../../utils/highlighter";
import { spinner } from "../../utils/spinner";

/**
 * Write snap-in configuration file
 */
export async function writeProjectConfig(
  cwd: string,
  config: AirdropProjectConfig
): Promise<void> {
  const configSpinner = spinner(`Creating project configuration (snapin.config.mjs)...`).start();
  await writeSnapInConfig(cwd, config);
  configSpinner.succeed(`Project configuration created successfully in ${highlighter.info(cwd)}.`);
}

/**
 * Generate TypeScript type definitions
 */
export async function generateProjectTypes(
  cwd: string,
  config: AirdropProjectConfig
): Promise<void> {
  await copyConfigTypes(cwd);
  await generateTypeDefinitions(cwd, config);
  logger.info("TypeScript definition files generated successfully");
}

/**
 * Update or create manifest.yaml file
 */
export async function updateManifestYaml(
  cwd: string,
  projectConfig: AirdropProjectConfig,
  shouldGenerateManifest: boolean,
  isNewProject: boolean
): Promise<void> {
  // Update manifest.yaml, only if shouldGenerateManifest is true OR if it's not a new project (meaning we might be updating an existing one)
  if (shouldGenerateManifest || !isNewProject) {
    await updateManifestYamlFile(cwd, projectConfig);
  } else {
    logger.info("Skipping manifest.yaml update based on earlier choices or new project state without manifest generation.");
  }
}

/**
 * Internal function to update manifest.yaml file
 */
async function updateManifestYamlFile(
  cwd: string,
  projectConfig: AirdropProjectConfig
): Promise<void> {
  const manifestPath = path.join(cwd, "manifest.yaml");
  let manifestExists = false;

  try {
    await fs.access(manifestPath);
    manifestExists = true;
  } catch {
    manifestExists = false;
  }

  if (!manifestExists) {
    logger.info(`manifest.yaml not found at ${manifestPath}. A new one will be created with default values if applicable, or this step might be skipped if template doesn't include it.`);
  }

  // Create basic manifest structure if it doesn't exist
  if (!manifestExists) {
    const basicManifest = generateBasicManifest(projectConfig);
    await fs.writeFile(manifestPath, basicManifest, "utf8");
    logger.info(`manifest.yaml updated successfully at ${manifestPath}`);
  } else {
    // If manifest exists, we could enhance it here, but for now just log
    logger.info(`Using existing manifest.yaml at ${manifestPath}`);
  }
}

/**
 * Generate basic manifest content
 */
function generateBasicManifest(config: AirdropProjectConfig): string {
  const manifestContent = `version: "2"
name: "${config.externalSystem?.slug || 'my-snapin'}"
description: "A snap-in created with the DevRev CLI"

app:
  - name: main

functions:
  - name: example_function
    description: "Example function"

`;

  return manifestContent;
} 