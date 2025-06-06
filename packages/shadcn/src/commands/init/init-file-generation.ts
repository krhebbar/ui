import { AirdropProjectConfig } from "../../types/snapin-config";
import { copyConfigTypes, generateTypeDefinitions } from "../../utils/generators/type-generator";
import { logger } from "../../utils/logger";
import { highlighter } from "../../utils/highlighter";
import { spinner } from "../../utils/spinner";
import { 
  writeSnapinConfigFile,
  updateManifestFile
} from "../../utils/updaters/update-config-files";

/**
 * Write snap-in configuration file
 */
export async function writeProjectConfig(
  cwd: string,
  config: AirdropProjectConfig
): Promise<void> {
  const configSpinner = spinner(`Creating project configuration (snapin.config.mjs)...`).start();
  await writeSnapinConfigFile(cwd, config);
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
  if (shouldGenerateManifest || !isNewProject) {
    await updateManifestFile(cwd, projectConfig, { createIfMissing: true });
  } else {
    logger.info("Skipping manifest.yaml update based on earlier choices or new project state without manifest generation.");
  }
} 