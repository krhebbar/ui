import path from "path";
import fs from "fs-extra";
import yaml from "yaml";
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

  if (manifestExists) {
    // Update existing manifest with new configuration values
    try {
      const existingContent = await fs.readFile(manifestPath, "utf8");
      const existingManifest = yaml.parse(existingContent);
      
      // Update relevant fields while preserving existing structure
      if (projectConfig.externalSystem?.name && existingManifest.name !== projectConfig.externalSystem.slug) {
        existingManifest.name = projectConfig.externalSystem.slug;
        logger.info(`Updated manifest name to: ${projectConfig.externalSystem.slug}`);
      }
      
      if (projectConfig.externalSystem?.name && (!existingManifest.description || existingManifest.description.includes("DevRev CLI"))) {
        existingManifest.description = `${projectConfig.externalSystem.name} integration created with DevRev CLI`;
        logger.info(`Updated manifest description`);
      }

      // Add airdrop-specific fields if it's an airdrop project
      if (projectConfig.projectType === 'airdrop') {
        existingManifest.type = 'airdrop';
        if (projectConfig.syncDirection) {
          existingManifest.sync_direction = projectConfig.syncDirection;
        }
      }

      const updatedContent = yaml.stringify(existingManifest, { indent: 2 });
      await fs.writeFile(manifestPath, updatedContent, "utf8");
      logger.info(`manifest.yaml updated successfully at ${manifestPath}`);
    } catch (error) {
      logger.warn(`Failed to update existing manifest.yaml: ${error}. Keeping original.`);
    }
  } else {
    // Create basic manifest structure if it doesn't exist
    const basicManifest = generateBasicManifest(projectConfig);
    await fs.writeFile(manifestPath, basicManifest, "utf8");
    logger.info(`manifest.yaml created successfully at ${manifestPath}`);
  }
}

/**
 * Generate basic manifest content
 */
function generateBasicManifest(config: AirdropProjectConfig): string {
  const isAirdrop = config.projectType === 'airdrop';
  const systemName = config.externalSystem?.name || 'External System';
  const systemSlug = config.externalSystem?.slug || 'my-snapin';
  
  let manifestContent = `version: "2"
name: "${systemSlug}"
description: "${systemName} integration created with DevRev CLI"
`;

  // Add airdrop-specific fields
  if (isAirdrop) {
    manifestContent += `type: airdrop
`;
    if (config.syncDirection) {
      manifestContent += `sync_direction: ${config.syncDirection}
`;
    }
  }

  // Add basic structure
  manifestContent += `
app:
  - name: main

functions:
  - name: ${isAirdrop ? 'extraction' : 'example_function'}
    description: "${isAirdrop ? 'Extraction function for the snap-in' : 'Example function'}"
`;

  // Add airdrop-specific imports section
  if (isAirdrop) {
    manifestContent += `
imports:
  - slug: ${systemSlug}
    display_name: ${systemName}
    description: ${systemName} integration for importing data into DevRev
    extractor_function: extraction
    allowed_connection_types:
      - ${config.connection?.id || 'example-connection'}
`;
  }

  return manifestContent;
} 