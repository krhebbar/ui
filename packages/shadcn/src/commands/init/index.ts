import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import prompts from "prompts";
import { addItems } from "../../utils/add-item";
import { preFlightInit } from "../../preflights/preflight-init";
import * as ERRORS from "../../utils/errors";
import { initOptionsSchema } from "../init";
import { hasSnapinConfig } from "../../utils/project-config";
import { getConfig } from "../../utils/get-config";
import { logger } from "../../utils/logger";
import { highlighter } from "../../utils/highlighter";
import { AirdropProjectConfig } from "../../types/snapin-config";
import { copyConfigTypes, generateTypeDefinitions } from "../../utils/generators/type-generator";
import { spinner } from "../../utils/spinner";
import {
  writeSnapinConfigFile,
  updateManifestFile
} from "../../utils/updaters/update-config-files";

// Import modular components
import { gatherAirdropConfiguration } from "./prompts";
import { cloneProjectTemplate, createProjectDirectory } from "../../utils/project-templates";
// import { writeProjectConfig, generateProjectTypes, updateManifestYaml } from "./init-file-generation"; // Functions moved
import { extractCoreConfigForGeneration } from "../../utils/project-utils";
import { 
  updateEnvFile,
  validateEnvFile,
  logValidationResults,
  extractEnvVarsFromConfig
} from "../../utils/updaters/update-config-files";

// Promisify exec for async execution
const execAsync = promisify(exec);

/**
 * Main init command orchestrator
 */
export async function runInit(
  options: z.infer<typeof initOptionsSchema> & {
    skipPreflight?: boolean;
  }
) {
  // Run preflight checks
  let preflightCheckResult;
  if (!options.skipPreflight) {
    preflightCheckResult = await preFlightInit(options);
    if (preflightCheckResult.errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] && !options.force) {
      // Let runInit proceed, it will handle actual creation or error if not interactive
    }
    options.cwd = preflightCheckResult.projectRootPath;

    // Adjust isNewProject based on preflight results
    if (preflightCheckResult.isExistingProjectStructure) {
      options.isNewProject = false;
    } else {
      // For any non-existing project (empty dir, non-empty dir without project structure, etc.)
      options.isNewProject = true;
    }
  }

  // Handle manifest overwrite prompt
  let shouldGenerateManifest = true;
  if (preflightCheckResult && preflightCheckResult.manifestFileExists && !options.force) {
    if (!options.yes) {
      const { overwriteManifest } = await prompts({
        type: "confirm",
        name: "overwriteManifest",
        message: `A manifest.yaml already exists at ${highlighter.info(options.cwd)}. Do you want to overwrite it with a new one? (y/N)`,
        initial: false,
      });
      if (!overwriteManifest) {
        logger.info("Skipping manifest generation/overwrite.");
        shouldGenerateManifest = false;
      }
    } else {
      logger.info(`Found existing manifest at ${highlighter.info(options.cwd)}. Skipping overwrite due to --yes without --force.`);
      shouldGenerateManifest = false;
    }
  }

  // Gather configuration - always initialized to avoid undefined issues
  let airdropConfigResult = await gatherAirdropConfiguration(options);

  // Handle new project setup (only if not already initialized or if explicitly new)
  const needsTemplateCloning = options.isNewProject && !preflightCheckResult?.manifestFileExists;
  if (needsTemplateCloning) {
    await handleNewProjectSetup(options, airdropConfigResult, shouldGenerateManifest);
  }

  // Gather configuration again if needed (for existing projects)
  if (!airdropConfigResult) {
    airdropConfigResult = await gatherAirdropConfiguration(options);
  }

  // Check for manifest file after potential template cloning
  const configFromManifest = await getConfig(options.cwd);
  if (!configFromManifest && shouldGenerateManifest && airdropConfigResult.projectTypeFromPrompt === 'airdrop') {
    logger.warn(`Manifest file not found at ${highlighter.info(options.cwd)} after Airdrop template setup. This is expected for new Airdrop projects - a manifest will be generated.`);
  } else if (!configFromManifest && airdropConfigResult.projectTypeFromPrompt === 'snap-in') {
    logger.warn(`Manifest file not found at ${highlighter.info(options.cwd)}. This might be expected for a new Snap-in if the template doesn't include it or manifest generation was skipped.`);
  }

  // Handle existing config overwrite prompt
  await handleConfigOverwritePrompt(options, configFromManifest);

  // Proceed with project setup confirmation
  if (!options.yes && !options.isNewProject) {
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: `Initialize/Update project configuration in ${highlighter.info(options.cwd)}. Proceed?`,
      initial: true,
    });
    if (!proceed) {
      process.exit(0);
    }
  }

  // Generate project files
  await generateProjectFiles(options.cwd, airdropConfigResult, shouldGenerateManifest, options.isNewProject);

  // Handle components if specified
  if (options.components?.length) {
    const finalConfigForComponents = await getConfig(options.cwd);
    if (finalConfigForComponents) {
      await addItems(options.components, finalConfigForComponents, {
        overwrite: true,
        silent: options.silent,
        isNewProject: options.isNewProject,
      });
    } else {
      logger.warn("Could not read configuration after writing. Skipping component addition.");
    }
  }

  // Run npm install for new projects
  if (options.isNewProject) {
    await runNpmInstall(options.cwd, options.silent);
  }

  return null;
}

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

/**
 * Handle new project setup including directory creation and template cloning
 */
async function handleNewProjectSetup(
  options: z.infer<typeof initOptionsSchema>,
  airdropConfigResult: any,
  shouldGenerateManifest: boolean
): Promise<void> {
  // Create project directory if needed (only when we have a specific project name)
  if (airdropConfigResult.projectName) {
    try {
      const projectPath = await createProjectDirectory(options.cwd, airdropConfigResult.projectName);
      options.cwd = projectPath;
      options.isNewProject = true;
    } catch (error) {
      logger.error(`Failed to create project directory: ${error}`);
      process.exit(1);
    }
  }

  // Clone template for new projects - check if we have template name OR if it's airdrop
  const shouldCloneTemplate = 
    airdropConfigResult.selectedSnapInTemplateName || 
    airdropConfigResult.projectTypeFromPrompt === 'airdrop';
  
  if (shouldCloneTemplate) {
    // For airdrop projects, pass the project type directly to clone the airdrop template
    // For snap-in projects, pass the specific template name
    const templateNameToUse = airdropConfigResult.projectTypeFromPrompt === 'airdrop' 
      ? undefined  // Let cloneProjectTemplate use default airdrop template
      : airdropConfigResult.selectedSnapInTemplateName;
      
    const cloneSuccess = await cloneProjectTemplate(
      airdropConfigResult.projectTypeFromPrompt,
      options.cwd,
      templateNameToUse
    );

    if (!cloneSuccess) {
      logger.error(`Failed to clone ${airdropConfigResult.projectTypeFromPrompt} template. Aborting initialization.`);
      process.exit(1);
    }
  } else {
    logger.info("Skipping template cloning - no template specified.");
  }
}

/**
 * Handle configuration overwrite prompts for existing projects
 */
async function handleConfigOverwritePrompt(
  options: z.infer<typeof initOptionsSchema>,
  configFromManifest: any
): Promise<void> {
  const hasExistingSnapInConfig = await hasSnapinConfig(options.cwd);
  if (hasExistingSnapInConfig && !options.force && !options.isNewProject) {
    if (!options.yes) {
      const { overwrite } = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `Project configuration (snapin.config.mjs) in ${highlighter.info(options.cwd)} already exists. Overwrite?`,
        initial: false,
      });
      if (!overwrite) {
        logger.info("Skipping snapin.config.mjs creation.");
        if (options.components?.length && configFromManifest) {
          await addItems(options.components, configFromManifest, {
            overwrite: true,
            silent: options.silent,
            isNewProject: false,
          });
        }
        return;
      }
    } else if (!options.force) {
      logger.info("Project configuration (snapin.config.mjs) already exists. Skipping overwrite due to --yes without --force.");
      if (options.components?.length && configFromManifest) {
        await addItems(options.components, configFromManifest, {
          overwrite: true,
          silent: options.silent,
          isNewProject: false,
        });
      }
      return;
    }
  }
}

/**
 * Generate all project files (config, types, manifest, env)
 */
async function generateProjectFiles(
  cwd: string,
  airdropConfigResult: any,
  shouldGenerateManifest: boolean,
  isNewProject: boolean
): Promise<void> {
  const coreConfig = extractCoreConfigForGeneration(airdropConfigResult);

  // Write configuration files
  await writeProjectConfig(cwd, coreConfig);

  // Handle environment variables
  const envVars = extractEnvVarsFromConfig(coreConfig);
  if (Object.keys(envVars).length > 0) {
    await updateEnvFile(cwd, envVars, { createIfMissing: true });
    const validationResult = await validateEnvFile(
      cwd,
      coreConfig,
      {
        pat: airdropConfigResult.devrevPatEnvVarName,
        org: airdropConfigResult.devrevOrgEnvVarName
      }
    );
    logValidationResults([validationResult]);
  }

  // Generate type definitions
  await generateProjectTypes(cwd, coreConfig);

  // Update manifest
  await updateManifestYaml(cwd, coreConfig, shouldGenerateManifest, isNewProject);

  // Success message
  const projectTypeLabel = airdropConfigResult.projectTypeFromPrompt === 'airdrop' ? 'Airdrop' : 'Snap-in';
  logger.success(`Success! ${projectTypeLabel} project initialization completed.`);
  logger.info("You may now add items.");
}

/**
 * Run npm install in the code directory
 */
async function runNpmInstall(cwd: string, silent: boolean): Promise<void> {
  const execAsync = promisify(exec);
  const codeDir = path.join(cwd, "code");
  
  // Check if code directory exists
  try {
    await fs.access(codeDir);
  } catch {
    if (!silent) {
      logger.warn("Code directory not found, skipping npm install");
    }
    return;
  }
  
  if (!silent) {
    const installSpinner = spinner("Installing dependencies with npm install in code/...").start();
    
    try {
      await execAsync("npm install", { cwd: codeDir });
      installSpinner.succeed("Dependencies installed successfully in code/ directory!");
    } catch (error) {
      installSpinner.fail("Failed to install dependencies in code/ directory");
      logger.warn(`npm install failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.info("You can run 'npm install' manually in the code/ directory.");
    }
  } else {
    try {
      await execAsync("npm install", { cwd: codeDir });
      logger.info("Dependencies installed successfully in code/ directory");
    } catch (error) {
      logger.warn(`npm install failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 