import path from "path"
import { preFlightInit } from "@/src/preflights/preflight-init"
import { addComponents } from "@/src/utils/add-item"
import * as ERRORS from "@/src/utils/errors"
import {
  getConfig,
} from "@/src/utils/get-config"
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { 
  writeSnapInConfig, // Renamed
  updateEnvFile, 
  hasSnapInConfig // Renamed
} from "@/src/utils/airdrop-config"
import { 
  generateTypeDefinitions, 
  copyConfigTypes 
} from "@/src/utils/type-generator"
import { 
  AirdropProjectConfig, 
  SUPPORTED_DEVREV_OBJECTS,
  SecretConnection // Added SecretConnection import
} from "@/src/types/airdrop-config" // Updated path
import { getInitConfig, getDefaultSnapInTemplate, airdropTemplates } from "@/src/utils/init-config";
import { slugify, isValidAirdropProjectName, generateAirdropSnapInFolderName, toKebabCase } from "@/src/utils/naming";
import { cloneTemplate } from "@/src/utils/git";
import fs from "fs-extra";
import yaml from 'js-yaml'; // Added import

import { Command } from "commander"
import prompts from "prompts"
import { z } from "zod"

// Helper function to get the original AirdropProjectConfig part from the augmented one.
// This is important because writeSnapInConfig and other utilities expect AirdropProjectConfig.
function extractCoreConfigForGeneration( // Renamed
  augmentedConfig: AirdropProjectConfig & { projectName?: string; projectTypeFromPrompt?: 'airdrop' | 'snap-in'; airdropProjectName?: string; snapInBaseName?: string; selectedSnapInTemplateName?: string; }
): AirdropProjectConfig {
  const {
    projectName,
    projectTypeFromPrompt,
    airdropProjectName,
    snapInBaseName,
    selectedSnapInTemplateName, // Added selectedSnapInTemplateName
    ...coreConfig
  } = augmentedConfig;
  return coreConfig;
}

export const initOptionsSchema = z.object({
  cwd: z.string(),
  components: z.array(z.string()).optional(),
  yes: z.boolean(),
  force: z.boolean(),
  silent: z.boolean(),
  isNewProject: z.boolean(),
})

export const init = new Command()
  .name("init")
  .description("initialize your airdrop project and install dependencies")
  .argument(
    "[components...]",
    "the items to add or a url to the item."
  )
  .option("-y, --yes", "skip confirmation prompt.", false)
  .option("-f, --force", "force overwrite of existing configuration.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .option("-s, --silent", "mute output.", false)
  .action(async (components, opts) => {
    try {
      const options = initOptionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        isNewProject: false,
        components,
        ...opts,
      })

      await runInit(options)

      logger.log(
        `${highlighter.success(
          "Success!"
          )} Airdrop project initialization completed.\nYou may now add items.`
      )
      logger.break()
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })

export async function runInit(
  options: z.infer<typeof initOptionsSchema> & {
    skipPreflight?: boolean;
  }
) {
  let preflightCheckResult;
  if (!options.skipPreflight) {
    preflightCheckResult = await preFlightInit(options);
    if (preflightCheckResult.errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] && !options.force) {
        // If preflight determined the dir doesn't exist and it's not a forced operation,
        // it means init should likely create it or error out if not interactive.
        // The preflight already logs if dir doesn't exist.
        // For now, let runInit proceed, it will handle actual creation or error if not interactive.
    }
    options.cwd = preflightCheckResult.projectRootPath; // IMPORTANT: Update cwd for all subsequent operations

    // Adjust isNewProject based on preflight results
    if (preflightCheckResult.isDirectoryEmpty && !preflightCheckResult.isExistingProjectStructure) {
        options.isNewProject = true;
    } else if (preflightCheckResult.isExistingProjectStructure) {
        options.isNewProject = false;
    }
    // if neither, options.isNewProject retains its initial value (false) or what was set by --yes
  }


  // let projectInfoFromGetProjectInfo; // Stores result from original getProjectInfo - Potentially remove if preflightCheckResult replaces its use cases
  let airdropConfigResult: AirdropProjectConfig & { projectName?: string; projectTypeFromPrompt?: 'airdrop' | 'snap-in'; airdropProjectName?: string; snapInBaseName?: string; selectedSnapInTemplateName?: string; devrevPatEnvVarName?: string; devrevOrgEnvVarName?: string; };

  // --- Start of Manifest Overwrite Prompt and Conditional Logic ---
  let shouldGenerateManifest = true; // Default to true
  if (preflightCheckResult && preflightCheckResult.manifestFileExists && !options.force) {
    if (!options.yes) { // Only prompt if not --yes
      const { overwriteManifest } = await prompts({
        type: "confirm",
        name: "overwriteManifest",
        message: `A manifest.yml (or .yaml) already exists at ${highlighter.info(options.cwd)}. Do you want to overwrite it with a new one? (y/N)`,
        initial: false,
      });
      if (!overwriteManifest) {
        logger.info("Skipping manifest generation/overwrite.");
        shouldGenerateManifest = false;
      }
    } else { // --yes is present but not --force
      logger.info(`Found existing manifest at ${highlighter.info(options.cwd)}. Skipping overwrite due to --yes without --force.`);
      shouldGenerateManifest = false;
    }
  }
  // --- End of Manifest Overwrite Prompt ---


  // Handling for new projects in silent (-s) or yes (-y) mode
  // This block needs to use preflightCheckResult if available
  if (options.isNewProject && (options.silent || options.yes)) {
      // For silent/yes mode on a new project (empty dir, no existing structure as per preflight)
      const defaultConfigCore = createDefaultAirdropConfig();
      const projectTypeForNaming = defaultConfigCore.projectType || 'airdrop';

      let tempProjectName = projectTypeForNaming === 'snap-in'
            ? generateAirdropSnapInFolderName(defaultConfigCore.externalSystem?.name || "default-snapin")
            : `airdrop-${defaultConfigCore.externalSystem?.slug || "default-project"}`;

      // options.cwd is already preflightCheckResult.projectRootPath
      // If the basename of this path is not already the tempProjectName, it means user might have
      // provided a generic path like `.` or `new-dir` which preflight resolved.
      // We might want to create a subdirectory *inside* this options.cwd if it's truly empty
      // and its name doesn't match. This part needs careful thought.
      // For now, assume options.cwd from preflight is the target root.
      // If the logic requires creating a sub-folder, that needs to be explicit here.
      // Let's assume for now that if options.cwd (from preflight) is empty, we use it directly.
      // The naming part (tempProjectName) is more about the *content* and config values.

      airdropConfigResult = {
          ...defaultConfigCore,
          projectTypeFromPrompt: projectTypeForNaming as 'airdrop' | 'snap-in',
          projectName: path.basename(options.cwd), // Use the final path's basename
      };

      await fs.ensureDir(options.cwd); // Ensure dir, though preflight might have confirmed it
      logger.info(`Project directory confirmed/created: ${highlighter.info(options.cwd)} (silent/yes mode on new project)`);
      // options.isNewProject is already true

      if (shouldGenerateManifest) { // Check if we should proceed with template cloning (which includes manifest)
        if (airdropConfigResult.projectTypeFromPrompt === "airdrop") {
          logger.info(`Cloning Airdrop project template...`);
          const airdropTemplateToUse = airdropTemplates && airdropTemplates.length > 0
                                      ? airdropTemplates[0]
                                      : undefined;
          if (airdropTemplateToUse) {
            logger.info(`Cloning Airdrop project from template: ${airdropTemplateToUse.name}`);
            const cloneSuccess = await cloneTemplate({
              repoUrl: airdropTemplateToUse.url,
              targetPath: options.cwd,
              branch: airdropTemplateToUse.branch,
              path: airdropTemplateToUse.path
            });
            if (!cloneSuccess) {
              logger.error("Failed to clone Airdrop project template. Aborting initialization.");
              process.exit(1);
            }
            logger.info(`Airdrop project template cloned successfully into ${highlighter.info(options.cwd)}.`);
          } else {
            logger.error("No Airdrop templates found in configuration. Cannot proceed with cloning. Please define airdrop templates in init-config.ts.");
            process.exit(1);
          }
        } else if (airdropConfigResult.projectTypeFromPrompt === "snap-in") {
          const initConf = getInitConfig();
          const templateToUse = initConf.snapInTemplates.find(t => t.name === initConf.defaultSnapInTemplateName);
          if (!templateToUse) {
              logger.error(`Default Snap-in template '${initConf.defaultSnapInTemplateName}' not found. Aborting.`);
              process.exit(1);
          }
          logger.info(`Using default Snap-in template: ${templateToUse.name} (silent/yes mode)`);
          const cloneSuccess = await cloneTemplate({
            repoUrl: templateToUse.url,
            targetPath: options.cwd,
            branch: templateToUse.branch,
            path: templateToUse.path
          });
          if (!cloneSuccess) {
            logger.error("Failed to clone Snap-in template in silent/yes mode. Aborting.");
            process.exit(1);
          }
          logger.info(`Snap-in template cloned (silent/yes mode).`);
        }
      } else {
        logger.info("Skipping template cloning due to existing manifest and user choice/--yes without --force.");
      }
  }


  // Interactive new project flow or operations on existing projects
  if (!options.isNewProject) { // If not a new project (i.e., existing structure or non-empty dir)
    // This block runs if:
    // 1. preflight determined it's an existing project structure.
    // 2. preflight determined it's a non-empty directory without full structure, and not --yes.
    //    (If --yes on non-empty non-structured, it might have been treated as new if preflight.isDirectoryEmpty was false but preflight.isExistingProjectStructure was also false)

    // If it's interactive (not --yes) and preflight said it's an empty dir (MISSING_DIR_OR_EMPTY_PROJECT can mean empty)
    // then it's an interactive new project setup.
    if (preflightCheckResult && preflightCheckResult.isDirectoryEmpty && !preflightCheckResult.isExistingProjectStructure && !options.yes && !options.force) {
        airdropConfigResult = await gatherAirdropConfiguration(options);

        // options.cwd is already set by preflight. We assume this is the target.
        // If gatherAirdropConfiguration's projectName implies a *subfolder*, that needs adjustment.
        // For now, assume options.cwd from preflight is the root where project should be initialized.
        // The `projectName` from `gatherAirdropConfiguration` will be used for config values, not necessarily folder creation here.
        if (path.basename(options.cwd) !== airdropConfigResult.projectName && projectTypeFromPrompt !== 'snap-in') { // For snap-ins, folder name can differ from snapInBaseName
             // This case is tricky: preflight gave a root, prompts gave a name.
             // If options.cwd is truly empty, maybe we should create options.cwd/projectName?
             // For now, let's stick to options.cwd from preflight as the true root.
             // logger.warn(`Project name '${airdropConfigResult.projectName}' differs from target directory name '${path.basename(options.cwd)}'. Using '${options.cwd}' as root.`);
        }


        await fs.ensureDir(options.cwd);
        logger.info(`Project directory confirmed/created: ${highlighter.info(options.cwd)}`);
        options.isNewProject = true; // Mark as new project for subsequent logic like template cloning

        if (shouldGenerateManifest) { // Check if we should proceed with template cloning
            if (airdropConfigResult.projectTypeFromPrompt === "airdrop") {
              logger.info(`Cloning Airdrop project template...`);
              const airdropTemplateToUse = airdropTemplates && airdropTemplates.length > 0
                                          ? airdropTemplates[0]
                                          : undefined;
              if (airdropTemplateToUse) {
                logger.info(`Cloning Airdrop project from template: ${airdropTemplateToUse.name}`);
                const cloneSuccess = await cloneTemplate({ repoUrl: airdropTemplateToUse.url, targetPath: options.cwd, branch: airdropTemplateToUse.branch, path: airdropTemplateToUse.path });
                if (!cloneSuccess) { logger.error("Failed to clone Airdrop project template."); process.exit(1); }
                logger.info(`Airdrop project template cloned into ${highlighter.info(options.cwd)}.`);
              } else {
                logger.error("No Airdrop templates found. Cannot clone."); process.exit(1);
              }
            } else if (airdropConfigResult.projectTypeFromPrompt === "snap-in") {
              const initConf = getInitConfig();
              let templateToUse = initConf.snapInTemplates.find(t => t.name === airdropConfigResult.selectedSnapInTemplateName);
              if (!templateToUse) { logger.error(`Selected Snap-in template '${airdropConfigResult.selectedSnapInTemplateName}' not found.`); process.exit(1); }
              logger.info(`Using selected Snap-in template: ${templateToUse.name}`);
              const cloneSuccess = await cloneTemplate({ repoUrl: templateToUse.url, targetPath: options.cwd, branch: templateToUse.branch, path: templateToUse.path });
              if (!cloneSuccess) { logger.error("Failed to clone Snap-in template."); process.exit(1); }
              logger.info(`Snap-in template cloned into ${highlighter.info(options.cwd)}.`);
            }
        } else {
            logger.info("Skipping template cloning due to existing manifest and user choice.");
        }
    } else {
        // This is an existing project or a non-empty directory where user chose not to overwrite manifest,
        // or it's a forced/silent operation on an existing dir.
        // `options.isNewProject` should be false here.
        options.isNewProject = false;
        // `projectInfoFromGetProjectInfo` was part of old logic, if needed, it should use `options.cwd` (which is now `projectRootPath`)
        // projectInfoFromGetProjectInfo = preflightCheckResult.projectInfo || await getProjectInfo(options.cwd); // This line might be obsolete
    }
  }


  // Gather configuration if not already done (e.g., for existing projects where preflight didn't set it up as new)
  if (!airdropConfigResult!) { // Notice the "!" - ensure airdropConfigResult is defined by this point or handle error
    // This typically runs for existing projects or if the new project path was already set (e.g. user cd'd into an empty dir and preflight confirmed it)
    airdropConfigResult = await gatherAirdropConfiguration(options);
    // options.cwd is already the correct project root path from preflight
  }


  // Final check for manifest file after potential directory creation and cloning.
  // This uses options.cwd which is already projectRootPath.
  const configFromManifest = await getConfig(options.cwd);
  if (!configFromManifest && shouldGenerateManifest && airdropConfigResult.projectTypeFromPrompt === 'airdrop') {
    // If we were supposed to generate a manifest (e.g. cloned a template) and it's still not found for Airdrop.
    logger.error(`Failed to read manifest file at ${highlighter.info(options.cwd)} even after setup attempt. Ensure a manifest.yml/yaml exists for Airdrop projects.`);
    throw new Error("Manifest file not found after project setup for Airdrop project.");
  } else if (!configFromManifest && !shouldGenerateManifest && preflightCheckResult && preflightCheckResult.manifestFileExists) {
    // User skipped overwrite, so configFromManifest might be null if getConfig failed on existing.
    // This implies we should try to use the existing manifest if possible or warn.
    logger.info(`Using existing manifest at ${highlighter.info(options.cwd)} as per user choice (overwrite skipped).`);
    // Potentially, try to load the existing manifest again explicitly if `getConfig` had issues.
    // For now, assume `getConfig` would have worked if the file is valid.
  } else if (!configFromManifest && airdropConfigResult.projectTypeFromPrompt === 'snap-in') {
    logger.warn(`Manifest file not found at ${highlighter.info(options.cwd)}. This might be expected for a new Snap-in if the template doesn't include it or manifest generation was skipped.`);
  }


  // Check for existing snapin.config.mjs in the final options.cwd (projectRootPath)
  const hasExistingSnapInConfig = await hasSnapInConfig(options.cwd); // Renamed
  if (hasExistingSnapInConfig && !options.force && !options.isNewProject) { // Don't ask to overwrite if it's a new project
    if (!options.yes) {
      const { overwrite } = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `Project configuration (snapin.config.mjs) in ${highlighter.info(options.cwd)} already exists. Overwrite?`, // Updated message
        initial: false,
      });
      if (!overwrite) {
        logger.info("Skipping snapin.config.mjs creation."); // Updated message
        // If components were specified, we might still want to add them with the existing config.
        if (options.components?.length && configFromManifest) {
             await addComponents(options.components, configFromManifest, {
                overwrite: true, // Assuming init always implies potential overwrite for components
                silent: options.silent,
                isNewProject: false, // It's an existing project if we are here
            });
        }
        return configFromManifest; // Return the existing manifest config
      }
    } else if (!options.force) { // If --yes but not --force, don't overwrite
        logger.info("Project configuration (snapin.config.mjs) already exists. Skipping overwrite due to --yes without --force."); // Updated message
        if (options.components?.length && configFromManifest) {
            await addComponents(options.components, configFromManifest, {
                overwrite: true, silent: options.silent, isNewProject: false,
            });
        }
        return configFromManifest;
    }
  }

  // Confirmation prompt for proceeding (skipped for new projects or if --yes)
  if (!options.yes && !options.isNewProject) {
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: `Initialize/Update project configuration in ${highlighter.info(options.cwd)}. Proceed?`, // Updated message
      initial: true,
    });
    if (!proceed) {
      process.exit(0);
    }
  }
  
  const coreConfig = extractCoreConfigForGeneration(airdropConfigResult);

  const configSpinner = spinner(`Creating project configuration (snapin.config.mjs)...`).start();
  await writeSnapInConfig(options.cwd, coreConfig);
  
  const envVars = extractEnvVarsFromConfig(coreConfig);
  if (Object.keys(envVars).length > 0) {
    await updateEnvFile(options.cwd, envVars);

    // Read the .env file to check actual values
    const envFilePath = path.join(options.cwd, ".env");
    let finalEnvContent = "";
    try {
      finalEnvContent = await fs.readFile(envFilePath, "utf8");
    } catch {
      // .env file might not have been created if no envVars were to be written, though unlikely for init
    }

    const finalEnvValues: Record<string, string> = {};
    finalEnvContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          finalEnvValues[key.trim()] = valueParts.join("=").trim();
        } else if (key) {
          finalEnvValues[key.trim()] = ""; // Handle empty values
        }
      }
    });

    const patEnvVarName = airdropConfigResult.devrevPatEnvVarName || "DEVREV_PAT";
    const orgEnvVarName = airdropConfigResult.devrevOrgEnvVarName || "DEVREV_ORG";

    const placeholderMessages: string[] = [];

    // Check PAT variable
    if (finalEnvValues[patEnvVarName] === undefined || finalEnvValues[patEnvVarName] === "your-devrev-pat-here" || finalEnvValues[patEnvVarName] === "") {
      placeholderMessages.push(`- ${patEnvVarName} is missing or has a placeholder value.`);
    }

    // Check Org variable
    if (finalEnvValues[orgEnvVarName] === undefined || finalEnvValues[orgEnvVarName] === "your-devrev-org-slug-here" || finalEnvValues[orgEnvVarName] === "") {
      placeholderMessages.push(`- ${orgEnvVarName} is missing or has a placeholder value.`);
    }

    // Add check for OAuth variables if connection is OAuth2
    if (coreConfig.connection?.type === "oauth2") {
        const oauthConnection = coreConfig.connection;
        if (typeof oauthConnection.clientId === 'string') {
            const clientIdMatch = oauthConnection.clientId.match(/process\.env\.([A-Z_0-9]+)/);
            if (clientIdMatch && clientIdMatch[1]) {
                const clientIdEnvVar = clientIdMatch[1];
                if (finalEnvValues[clientIdEnvVar] === undefined || finalEnvValues[clientIdEnvVar] === "your-client-id-here" || finalEnvValues[clientIdEnvVar] === "") {
                    placeholderMessages.push(`- ${clientIdEnvVar} (OAuth Client ID) is missing or has a placeholder value.`);
                }
            }
        }
        if (typeof oauthConnection.clientSecret === 'string') {
            const clientSecretMatch = oauthConnection.clientSecret.match(/process\.env\.([A-Z_0-9]+)/);
            if (clientSecretMatch && clientSecretMatch[1]) {
                const clientSecretEnvVar = clientSecretMatch[1];
                if (finalEnvValues[clientSecretEnvVar] === undefined || finalEnvValues[clientSecretEnvVar] === "your-client-secret-here" || finalEnvValues[clientSecretEnvVar] === "") {
                    placeholderMessages.push(`- ${clientSecretEnvVar} (OAuth Client Secret) is missing or has a placeholder value.`);
                }
            }
        }
    } else if (coreConfig.connection?.type === "secret") {
        const secretConnection = coreConfig.connection as SecretConnection;
        if (secretConnection.tokenEnvVarName) {
            const tokenEnvVar = secretConnection.tokenEnvVarName;
             if (finalEnvValues[tokenEnvVar] === undefined || finalEnvValues[tokenEnvVar] === "your-api-token-here" || finalEnvValues[tokenEnvVar] === "") {
                placeholderMessages.push(`- ${tokenEnvVar} (API Token) is missing or has a placeholder value.`);
            }
        }
    }

    if (placeholderMessages.length > 0) {
      logger.warn("\nPlease update the following placeholder values in your .env file:");
      placeholderMessages.forEach(msg => logger.warn(msg));
      logger.break();
    }
  }
  
  await copyConfigTypes(options.cwd);
  await generateTypeDefinitions(options.cwd, coreConfig);
  configSpinner.succeed(`Project configuration created successfully in ${highlighter.info(options.cwd)}.`);

  // Update manifest.yaml, only if shouldGenerateManifest is true OR if it's not a new project (meaning we might be updating an existing one)
  if (shouldGenerateManifest || (!options.isNewProject && preflightCheckResult && preflightCheckResult.manifestFileExists)) {
    await updateManifestYaml(options.cwd, coreConfig, airdropConfigResult);
  } else {
    logger.info("Skipping manifest.yaml update based on earlier choices or new project state without manifest generation.");
  }

  if (options.components?.length) {
    // Re-fetch config after writing, to ensure components are added based on the *new* or existing-but-verified configuration
    const finalConfigForComponents = await getConfig(options.cwd);
    if (finalConfigForComponents) {
      await addComponents(options.components, finalConfigForComponents, {
        overwrite: true, // Init implies overwrite capability for components
        silent: options.silent,
        isNewProject: options.isNewProject, // Pass the final status
      });
    } else {
        logger.warn("Could not read configuration after writing. Skipping component addition.");
    }
  }
  return null;
}

/**
 * Gather airdrop configuration from user prompts
 */
async function gatherAirdropConfiguration(
  options: z.infer<typeof initOptionsSchema>
): Promise<AirdropProjectConfig & { projectName?: string; projectTypeFromPrompt?: 'airdrop' | 'snap-in'; airdropProjectName?: string; snapInBaseName?: string; selectedSnapInTemplateName?: string; devrevPatEnvVarName?: string; devrevOrgEnvVarName?: string; }> {
  if (options.silent || options.yes) {
    // Return default configuration for silent mode
    // Add projectName and projectTypeFromPrompt for consistency, though not directly used by default config path
    // No selectedSnapInTemplateName in silent mode, it will use default
    // Add default env var names for silent mode
    return {
      ...createDefaultAirdropConfig(),
      projectName: 'default-project',
      projectTypeFromPrompt: 'airdrop',
      devrevPatEnvVarName: "DEVREV_PAT", // Default for silent/yes
      devrevOrgEnvVarName: "DEVREV_ORG",  // Default for silent/yes
    };
  }

  const initSettings = getInitConfig();
  logger.info("Let's configure your project:");
  logger.break();

  const basicInfo = await prompts([
    {
      type: "select",
      name: "projectType",
      message: "What type of project are you creating?",
      choices: [
        { title: "Airdrop Project (from template)", value: "airdrop" },
        { title: "snap-in Project (from template)", value: "snap-in" },
      ],
      initial: 0,
    },
  ]);

  const projectTypeFromPrompt = basicInfo.projectType as 'airdrop' | 'snap-in';
  let projectName: string | undefined;
  let airdropProjectName: string | undefined;
  let snapInBaseName: string | undefined;
  let selectedSnapInTemplateName: string | undefined; // Added to store the name

  if (projectTypeFromPrompt === "airdrop") {
    const nameResponse = await prompts({
      type: "text",
      name: "airdropProjectName",
      message: "Enter a name for your Airdrop project (e.g., airdrop-my-connector):",
      initial: "airdrop-",
      validate: (value: string) => {
        const kebabValue = toKebabCase(value);
        if (!isValidAirdropProjectName(kebabValue)) {
          return "Invalid name. Must be kebab-case, start with 'airdrop-', and contain only a-z, 0-9, and hyphens.";
        }
        if (value !== kebabValue) {
            // Suggest kebab-case if user input is not already in that format
            return `Did you mean '${kebabValue}'? Invalid characters or case.`;
        }
        return true;
      },
      format: (value: string) => toKebabCase(value) // Auto-format to kebab-case
    });
    airdropProjectName = nameResponse.airdropProjectName;
    projectName = airdropProjectName;
  } else { // Snap-in
    const nameResponse = await prompts({
      type: "text",
      name: "snapInBaseName",
      message: "Enter a base name for your Snap-in (e.g., Notion Connector):",
      initial: "My Snap-in",
      validate: (value: string) => value.trim().length > 0 ? true : "Name cannot be empty."
    });
    snapInBaseName = nameResponse.snapInBaseName;
    projectName = snapInBaseName ? generateAirdropSnapInFolderName(snapInBaseName) : "my-snap-in"; // This will be the folder name

    // Snap-in template selection
    const initConf = getInitConfig(); // Re-fetch or ensure it's in scope
    const availableSnapInTemplates = initConf.snapInTemplates;

    if (!availableSnapInTemplates || availableSnapInTemplates.length === 0) {
      logger.error("No Snap-in templates are defined in the configuration. Cannot proceed.");
      process.exit(1);
    }

    const templateChoices = availableSnapInTemplates.map(template => ({
      title: `${template.name} (${template.description})`,
      value: template.name, // Store the name, as it's unique
    }));

    const templateResponse = await prompts({
      type: "select",
      name: "selectedSnapInTemplateName",
      message: "Select a Snap-in template:",
      choices: templateChoices,
      initial: 0, // Default to the first template
    });

    selectedSnapInTemplateName = templateResponse.selectedSnapInTemplateName;
    // Handle potential cancellation of prompt (e.g., user presses Ctrl+C)
    if (typeof selectedSnapInTemplateName === 'undefined') {
        logger.error("Snap-in template selection was cancelled or skipped. Aborting.");
        process.exit(0); // Exit gracefully
    }
  }

  let needsExternalSystem = projectTypeFromPrompt === 'airdrop'; // Airdrop projects always need external system details
  if (projectTypeFromPrompt === "snap-in") {
      const externalSystemResponse = await prompts({
        type: "confirm",
        name: "needsExternalSystemValue",
        message: "Will this Snap-in connect to an external system?",
        initial: true,
      });
      needsExternalSystem = externalSystemResponse.needsExternalSystemValue;

      if (typeof needsExternalSystem === 'undefined') {
          logger.error("Snap-in external system choice was not provided. Aborting.");
          process.exit(1);
      }
  }

  // Dynamically build promptsList
  const promptsList: prompts.PromptObject<string>[] = [];

  if (projectTypeFromPrompt === "airdrop") {
    promptsList.push({
      type: "select" as prompts.PromptType,
      name: "syncDirection",
      message: "What sync direction do you need for this Airdrop project?",
      choices: [
        { title: "Two-way sync", value: "two-way" },
        { title: "One-way sync", value: "one-way" },
      ],
      initial: 0,
    });
  }

  if (needsExternalSystem) {
    promptsList.push(
      {
        type: "text",
        name: "externalSystemName",
        message: "What is the name of your external system (e.g., Notion, Jira)?",
        initial: projectTypeFromPrompt === 'snap-in' && snapInBaseName ? snapInBaseName : "My External System",
      },
      {
        type: "text",
        name: "externalSystemSlug",
        message: projectTypeFromPrompt === 'snap-in'
                   ? "Snap-in slug (machine-readable, kebab-case, for identification):"
                   : "External system slug (machine-readable, kebab-case):",
        initial: (prev: any, values: any) => {
          const baseName = values.externalSystemName || (projectTypeFromPrompt === 'snap-in' && snapInBaseName ? snapInBaseName : "external-system");
          if (projectTypeFromPrompt === 'airdrop') {
            return `airdrop-${slugify(baseName)}`;
          }
          return slugify(baseName);
        },
        validate: (value: string) => slugify(value).length > 0 ? true : "Slug cannot be empty."
      },
      {
        type: "text",
        name: "apiBaseUrl",
        message: "API base URL for the external system:",
        initial: initSettings.defaultApiBaseUrl,
      },
      {
        type: "text",
        name: "testEndpoint",
        message: "Test endpoint for connection verification (relative to API base URL or absolute):",
        initial: (prev: any, values: any) => {
          if (initSettings.defaultTestEndpoint.startsWith('http://') || initSettings.defaultTestEndpoint.startsWith('https://')) {
            return initSettings.defaultTestEndpoint;
          }
          const baseUrl = values.apiBaseUrl || initSettings.defaultApiBaseUrl;
          return `${baseUrl.replace(/\/$/, '')}/${initSettings.defaultTestEndpoint.replace(/^\//, '')}`;
        }
      },
      {
        type: "list",
        name: "externalSyncUnits",
        message: "Enter external system object types (e.g., tickets, conversations, comma-separated):",
        initial: "",
        separator: ",",
      },
      {
        type: "select",
        name: "connectionType",
        message: "What type of connection will the snap-in use?",
        choices: [
          { title: "OAuth2", value: "oauth2" },
          { title: "Secret/API Key", value: "secret" },
        ],
        initial: 0,
      }
    );
  }

  // DevRev objects prompt is always relevant
  promptsList.push({
    type: "multiselect",
    name: "devrevObjects",
    message: "Select DevRev objects to sync/interact with (space to select, enter to confirm):",
    choices: SUPPORTED_DEVREV_OBJECTS.map((obj: string) => ({
      title: obj,
      value: obj,
    })),
    min: projectTypeFromPrompt === "airdrop" ? 1 : 0,
    hint: "- Space to select. Enter to submit."
  });

  const responses = await prompts(promptsList);
   // Handle cases where prompts might be skipped (e.g. user presses Ctrl+C during promptsList)
  if (Object.keys(responses).length === 0 && promptsList.length > 0 && !options.yes && !options.silent) {
    // This condition might indicate that prompts were exited early (e.g. Ctrl+C)
    // Check some key expected responses
    if (typeof responses.devrevObjects === 'undefined') {
        logger.error("Project configuration was not completed (essential prompts skipped). Aborting.");
        process.exit(0);
    }
    // If needsExternalSystem was true, but essential responses like externalSystemName are missing
    if (needsExternalSystem && typeof responses.externalSystemName === 'undefined') {
        logger.error("External system configuration was not completed. Aborting.");
        process.exit(0);
    }
  }


  const syncDirection = projectTypeFromPrompt === 'airdrop' ? responses.syncDirection : undefined;
  const devrevObjects = Array.isArray(responses.devrevObjects) ? responses.devrevObjects : [];

  let connectionDetails: any;
  if (needsExternalSystem && responses.connectionType) { // Ensure connectionType was prompted and answered
    if (responses.connectionType === "oauth2") {
      const oauthResponses = await prompts([
        { type: "text", name: "clientIdEnvVar", message: "Environment variable name for OAuth client ID:", initial: `${slugify(responses.externalSystemSlug).toUpperCase().replace(/-/g, '_')}_CLIENT_ID` },
        { type: "text", name: "clientSecretEnvVar", message: "Environment variable name for OAuth client secret:", initial: `${slugify(responses.externalSystemSlug).toUpperCase().replace(/-/g, '_')}_CLIENT_SECRET` },
        { type: "text", name: "authorizeUrl", message: "OAuth authorization URL:", initial: `${responses.apiBaseUrl}/oauth/authorize` },
        { type: "text", name: "tokenUrl", message: "OAuth token URL:", initial: `${responses.apiBaseUrl}/oauth/token` },
        { type: "text", name: "scope", message: "OAuth scope (space-separated):", initial: "read write api" },
      ]);
      if (typeof oauthResponses.clientIdEnvVar === 'undefined') { // Check if OAuth prompts were cancelled
        logger.error("OAuth2 configuration was not completed. Aborting.");
        process.exit(0);
      }
      connectionDetails = {
        type: "oauth2", id: `${responses.externalSystemSlug}-oauth-connection`,
        clientId: `process.env.${oauthResponses.clientIdEnvVar}`, clientSecret: `process.env.${oauthResponses.clientSecretEnvVar}`,
        authorize: { url: oauthResponses.authorizeUrl, tokenUrl: oauthResponses.tokenUrl, grantType: "authorization_code", scope: oauthResponses.scope, scopeDelimiter: " " },
        refresh: { url: oauthResponses.tokenUrl, method: "POST" }, revoke: { url: `${responses.apiBaseUrl}/oauth/revoke`, method: "POST" },
      };
    } else { // Secret-based
      const secretResponses = await prompts([
        { type: "text", name: "tokenEnvVar", message: "Environment variable name for API token/secret:", initial: `${slugify(responses.externalSystemSlug).toUpperCase().replace(/-/g, '_')}_TOKEN` },
        { type: "confirm", name: "isSubdomain", message: "Does this API connection involve a customer-specific subdomain?", initial: false },
      ]);
      if (typeof secretResponses.tokenEnvVar === 'undefined') { // Check if Secret prompts were cancelled
        logger.error("Secret-based connection configuration was not completed. Aborting.");
        process.exit(0);
      }
      connectionDetails = {
        type: "secret", id: `${responses.externalSystemSlug}-secret-connection`,
        tokenEnvVarName: secretResponses.tokenEnvVar, // Store the ENV VAR NAME here
        isSubdomain: secretResponses.isSubdomain, secretTransform: ".token",
        tokenVerification: { url: responses.testEndpoint, method: "GET" },
        fields: [{ id: "token", name: "API Token/Secret", description: `Your ${responses.externalSystemName} API Token/Secret` }],
      };
    }
  }

  let externalSyncUnitsList = (needsExternalSystem && responses.externalSyncUnits)
                               ? (
                                  Array.isArray(responses.externalSyncUnits)
                                    ? responses.externalSyncUnits.map((s: string) => s.trim()).filter(Boolean)
                                    : (responses.externalSyncUnits || "").split(',').map((s: string) => s.trim()).filter(Boolean)
                                 ).filter(unit => unit.length > 0) // Ensure empty strings after split are removed
                               : []; // Default to empty array if not needed or no response

  // Additional check for the case where externalSyncUnits is an empty string from the prompt
  if (needsExternalSystem && responses.externalSyncUnits === "") {
    externalSyncUnitsList = [];
  }

  return {
    projectName, projectTypeFromPrompt, airdropProjectName, snapInBaseName, selectedSnapInTemplateName,
    projectType: projectTypeFromPrompt,
    syncDirection: syncDirection,
    devrevObjects: devrevObjects,
    externalSyncUnits: externalSyncUnitsList,
    externalSystem: needsExternalSystem && responses.externalSystemName // ensure responses.externalSystemName is present
      ? {
          name: responses.externalSystemName,
          slug: slugify(responses.externalSystemSlug),
          apiBaseUrl: responses.apiBaseUrl,
          testEndpoint: responses.testEndpoint,
          supportedObjects: externalSyncUnitsList || [], // Default to empty array if externalSyncUnitsList is undefined
        }
      : undefined,
    connection: needsExternalSystem && connectionDetails ? connectionDetails : undefined,
    devrevPatEnvVarName: "DEVREV_PAT",
    devrevOrgEnvVarName: "DEVREV_ORG",
  };
}

/**
 * Create a default airdrop configuration for silent mode
 */
function createDefaultAirdropConfig(): AirdropProjectConfig {
  return {
    projectType: "airdrop",
    syncDirection: "two-way",
    devrevObjects: ["dm", "revu", "tag"],
    externalSyncUnits: ["tickets", "conversations"],
    externalSystem: {
      name: "External System",
      slug: "external-system",
      apiBaseUrl: "https://api.example.com",
      testEndpoint: "https://api.example.com/user",
      supportedObjects: ["tickets", "conversations"],
    },
    connection: {
      type: "oauth2",
      id: "external-system-oauth-connection",
      clientId: "process.env.EXTERNAL_SYSTEM_CLIENT_ID",
      clientSecret: "process.env.EXTERNAL_SYSTEM_CLIENT_SECRET",
      authorize: {
        url: "https://api.example.com/oauth/authorize",
        tokenUrl: "https://api.example.com/oauth/token",
        grantType: "authorization_code",
        scope: "read_api api",
        scopeDelimiter: " ",
      },
      refresh: {
        url: "https://api.example.com/oauth/token",
        method: "POST",
      },
      revoke: {
        url: "https://api.example.com/oauth/revoke",
        method: "POST",
      },
    },
  }
}

/**
 * Extract environment variable placeholders from config
 */
function extractEnvVarsFromConfig(config: AirdropProjectConfig): Record<string, string> {
  const envVars: Record<string, string> = {};
  
  if (config.connection) {
    if (config.connection.type === "oauth2") {
      if (typeof config.connection.clientId === 'string') {
        const clientIdMatch = config.connection.clientId.match(/process\.env\.([A-Z_]+)/);
        if (clientIdMatch) {
          envVars[clientIdMatch[1]] = "your-client-id-here";
        }
      }
      if (typeof config.connection.clientSecret === 'string') {
        const clientSecretMatch = config.connection.clientSecret.match(/process\.env\.([A-Z_]+)/);
        if (clientSecretMatch) {
          envVars[clientSecretMatch[1]] = "your-client-secret-here";
        }
      }
    } else if (config.connection.type === "secret") {
      const secretConnection = config.connection as SecretConnection; // Type assertion
      if (secretConnection.tokenEnvVarName) {
        envVars[secretConnection.tokenEnvVarName] = "your-api-token-here";
      }
    }
  }

  // Add DevRev PAT and Org slug environment variables directly
  // These names are now fixed due to changes in gatherAirdropConfiguration
  envVars["DEVREV_PAT"] = "your-devrev-pat-here";
  envVars["DEVREV_ORG"] = "your-devrev-org-slug-here";

  return envVars;
}

async function updateManifestYaml(
  cwd: string,
  projectConfig: AirdropProjectConfig,
  airdropConfigResultFromPrompts: AirdropProjectConfig & { projectName?: string; projectTypeFromPrompt?: 'airdrop' | 'snap-in'; airdropProjectName?: string; snapInBaseName?: string; selectedSnapInTemplateName?: string; }
): Promise<void> {
  const PLACEHOLDERS_TO_REPLACE = ["Todo", "TODO", "example", "Example"];
  const placeholderRegex = new RegExp(PLACEHOLDERS_TO_REPLACE.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');

  const { projectType, externalSystem, connection } = projectConfig;
  const { snapInBaseName, airdropProjectName, projectName: promptProjectNameVariable, selectedSnapInTemplateName } = airdropConfigResultFromPrompts;
  const initConf = getInitConfig();
  const selectedTemplate = selectedSnapInTemplateName ? initConf.snapInTemplates.find(t => t.name === selectedSnapInTemplateName) : undefined;

  let manifestName = '';
  if (projectType === 'snap-in') {
    manifestName = snapInBaseName || promptProjectNameVariable || 'My Snap-in';
  } else { // airdrop
    manifestName = externalSystem?.name || airdropProjectName || promptProjectNameVariable || 'My Airdrop';
  }

  let manifestDescriptionPlaceholderTarget = externalSystem?.name || manifestName;
  const serviceAccountBotName = `${manifestDescriptionPlaceholderTarget} Bot`;

  let projectSlugForManifest = '';
  if (projectType === 'snap-in') {
      projectSlugForManifest = slugify(snapInBaseName || manifestName);
  } else { // airdrop
      projectSlugForManifest = externalSystem?.slug || slugify(manifestName.replace(/^airdrop-/i, ''));
  }

  let connectionTypeForManifest: string | undefined = undefined;
  let connectionIdForManifest: string | undefined = undefined;
  let tokenVerificationUrlForManifest: string | undefined = undefined;

  if (connection && externalSystem) {
    connectionTypeForManifest = connection.type;
    connectionIdForManifest = connection.id;

    if (connection.type === 'secret') {
      const secretConnection = connection as SecretConnection;
      if (secretConnection.tokenVerification) {
        tokenVerificationUrlForManifest = secretConnection.tokenVerification.url;
      }
    } else if (connection.type === 'oauth2') {
      tokenVerificationUrlForManifest = externalSystem.testEndpoint;
    }
  }

  const externalSystemSlugForManifestKeyring = externalSystem?.slug;

  const manifestPath = path.join(cwd, 'manifest.yaml');
  let yamlData: any = {};
  try {
    if (await fs.pathExists(manifestPath)) {
      const fileContents = await fs.readFile(manifestPath, 'utf8');
      yamlData = yaml.load(fileContents) as object || {};
    } else {
      logger.warn(`manifest.yaml not found at ${manifestPath}. A new one will be created with default values if applicable, or this step might be skipped if template doesn't include it.`);
      // Initialize yamlData if file doesn't exist to avoid errors on property access
      // This allows creation of a new manifest if a template didn't provide one.
    }
  } catch (e: any) {
    logger.error(`Could not read or parse existing manifest.yaml: ${e.message}. Update attempt will proceed with minimal data or fail.`);
    // Depending on strictness, could return or throw here. For now, allow potential overwrite/creation.
    yamlData = {}; // Reset if parsing failed to avoid further errors
  }

  // Root level updates
  yamlData.name = manifestName;
  if (typeof yamlData.description === 'string') {
    yamlData.description = yamlData.description.replace(placeholderRegex, manifestDescriptionPlaceholderTarget);
  } else if (!yamlData.description && selectedTemplate?.description) { // If no description, use template's
    yamlData.description = selectedTemplate.description.replace(placeholderRegex, manifestDescriptionPlaceholderTarget);
  } else { // Fallback if no description from template or existing manifest
    yamlData.description = manifestDescriptionPlaceholderTarget;
  }

  // Explicitly delete type, slug, and connection from the root of yamlData
  delete yamlData.type;
  delete yamlData.slug;
  delete yamlData.connection;

  // The rest of the function continues, but these fields (type, slug, connection)
  // should not be reintroduced at the root level.


  // Service account update
  if (yamlData.service_account && typeof yamlData.service_account.display_name === 'string') {
    yamlData.service_account.display_name = serviceAccountBotName;
  } else if (yamlData.service_account) { // if service_account object exists but no display_name
     yamlData.service_account.display_name = serviceAccountBotName;
  }


  // Functions update
  if (Array.isArray(yamlData.functions)) {
    yamlData.functions.forEach((func: any) => {
      if (func && typeof func.description === 'string') {
        func.description = func.description.replace(placeholderRegex, manifestDescriptionPlaceholderTarget);
      }
    });
  }

  // Keyring_types update
  if (projectConfig.connection && externalSystem && Array.isArray(yamlData.keyring_types)) {
    if (yamlData.keyring_types.length > 0) {
      const keyringEntry = yamlData.keyring_types[0];
      if (keyringEntry) {
        keyringEntry.id = connectionIdForManifest;
        if (typeof keyringEntry.name === 'string') {
          keyringEntry.name = keyringEntry.name.replace(placeholderRegex, manifestDescriptionPlaceholderTarget);
        } else {
          keyringEntry.name = manifestDescriptionPlaceholderTarget; // Set if not present
        }
        if (typeof keyringEntry.description === 'string') {
          keyringEntry.description = keyringEntry.description.replace(placeholderRegex, manifestDescriptionPlaceholderTarget);
        } else {
           keyringEntry.description = `Keyring for ${manifestDescriptionPlaceholderTarget}`; // Set if not present
        }
        keyringEntry.external_system_name = manifestDescriptionPlaceholderTarget;
        keyringEntry.slug = externalSystemSlugForManifestKeyring;
        keyringEntry.kind = connectionTypeForManifest;

        if (connectionTypeForManifest === 'secret' && tokenVerificationUrlForManifest) {
           if (!keyringEntry.token_verification) keyringEntry.token_verification = {};
           keyringEntry.token_verification.url = tokenVerificationUrlForManifest;
        } else if (connectionTypeForManifest === 'oauth2' && tokenVerificationUrlForManifest) {
           // For OAuth2, token_verification might not be standard, but if template has it:
           if (keyringEntry.token_verification) { // Only update if block exists
             keyringEntry.token_verification.url = tokenVerificationUrlForManifest;
           }
        }
      }
    } else if (connectionIdForManifest) { // keyring_types is empty array, but we have connection info
        yamlData.keyring_types.push({
            id: connectionIdForManifest,
            name: manifestDescriptionPlaceholderTarget,
            description: `Keyring for ${manifestDescriptionPlaceholderTarget}`,
            external_system_name: manifestDescriptionPlaceholderTarget,
            slug: externalSystemSlugForManifestKeyring,
            kind: connectionTypeForManifest,
            token_verification: tokenVerificationUrlForManifest ? { url: tokenVerificationUrlForManifest } : undefined,
        });
    }
  } else if (!projectConfig.connection && Array.isArray(yamlData.keyring_types)) {
    // No connection defined in snapin.config.mjs, ensure keyring_types is empty or removed
    yamlData.keyring_types = [];
  }


  // Imports update
  if (Array.isArray(yamlData.imports)) {
    yamlData.imports.forEach((imp: any) => {
      if (imp) {
        imp.slug = projectSlugForManifest; // Use the main project slug here
        if (typeof imp.display_name === 'string') {
          imp.display_name = imp.display_name.replace(placeholderRegex, manifestDescriptionPlaceholderTarget);
        } else {
          imp.display_name = manifestDescriptionPlaceholderTarget; // Set if not present
        }
        if (typeof imp.description === 'string') {
          imp.description = imp.description.replace(placeholderRegex, manifestDescriptionPlaceholderTarget);
        } else {
          imp.description = `Import for ${manifestDescriptionPlaceholderTarget}`; // Set if not present
        }
        if (projectConfig.connection && connectionIdForManifest) {
          imp.allowed_connection_types = [connectionIdForManifest];
        } else {
          imp.allowed_connection_types = [];
        }
      }
    });
  }

  try {
    await fs.writeFile(manifestPath, yaml.dump(yamlData), 'utf8');
    logger.info(`manifest.yaml updated successfully at ${manifestPath}`);
  } catch (e: any) {
    logger.error(`Failed to write manifest.yaml: ${e.message}`);
    // Consider if this should be a fatal error that stops the init process
  }
}
