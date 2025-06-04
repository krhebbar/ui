import path from "path"
import { preFlightInit } from "@/src/preflights/preflight-init"
import { addComponents } from "@/src/utils/add-item"
import { createProject } from "@/src/utils/create-project"
import * as ERRORS from "@/src/utils/errors"
import {
  getConfig,
  resolveConfigPaths,
} from "@/src/utils/get-config"
import {
  getProjectInfo,
} from "@/src/utils/get-project-info"
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
  SUPPORTED_DEVREV_OBJECTS
} from "@/src/type/airdrop-config"
import { getInitConfig, getDefaultSnapInTemplate, airdropTemplates } from "@/src/utils/init-config";
import { slugify, isValidAirdropProjectName, generateAirdropSnapInFolderName, toKebabCase } from "@/src/utils/naming";
import { cloneTemplate } from "@/src/utils/git";
import fs from "fs-extra";

const AIRDROP_TEMPLATE_URL = "https://github.com/devrev/airdrop-template";
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
  let projectInfoFromGetProjectInfo; // Stores result from original getProjectInfo
  let airdropConfigResult: AirdropProjectConfig & { projectName?: string; projectTypeFromPrompt?: 'airdrop' | 'snap-in'; airdropProjectName?: string; snapInBaseName?: string; selectedSnapInTemplateName?: string; }; // Added selectedSnapInTemplateName

  // Handling for new projects in silent (-s) or yes (-y) mode
  // Check if manifest.yml or manifest.yaml exists to determine if it's truly a new project setup area
  if ((options.silent || options.yes) && !(await fs.pathExists(path.join(options.cwd, "manifest.yml"))) && !(await fs.pathExists(path.join(options.cwd, "manifest.yaml")))) {
      // For silent/yes mode, we must create a default config and determine project name
      const defaultConfigCore = createDefaultAirdropConfig();
      const projectTypeForNaming = defaultConfigCore.projectType || 'airdrop';

      let tempProjectName = projectTypeForNaming === 'snap-in'
            ? generateAirdropSnapInFolderName(defaultConfigCore.externalSystem?.name || "default-snapin")
            : `airdrop-${defaultConfigCore.externalSystem?.slug || "default-project"}`;

      // If options.cwd already ends with the determined project name, don't append it again.
      // This handles cases where user might do `mkdir my-proj && cd my-proj && airdrop init -y`
      if (path.basename(options.cwd) !== tempProjectName) {
        options.cwd = path.resolve(options.cwd, tempProjectName);
      }

      airdropConfigResult = {
          ...defaultConfigCore,
          projectTypeFromPrompt: projectTypeForNaming as 'airdrop' | 'snap-in',
          projectName: path.basename(options.cwd), // Use the final path's basename as projectName
      };

      await fs.ensureDir(options.cwd);
      logger.info(`Project directory determined/created: ${highlighter.info(options.cwd)} (silent/yes mode)`);
      options.isNewProject = true;

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
        // For silent/yes mode, still use default Snap-in template
        const templateToUse = initConf.snapInTemplates.find(t => t.name === initConf.defaultSnapInTemplateName);
        if (!templateToUse) {
            logger.error(`Default Snap-in template '${initConf.defaultSnapInTemplateName}' not found. Aborting.`);
            process.exit(1);
        }
        logger.info(`Using default Snap-in template: ${templateToUse.name} (silent/yes mode)`);
        // Clone logic using templateToUse
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
  }

  // Interactive new project flow or preflight for existing projects
  if (!options.isNewProject) { // if not already handled by silent/yes new project
    if (!options.skipPreflight) {
      const preflight = await preFlightInit(options);
      // Check if the directory is empty or doesn't exist, and it's not a forced or silent operation
      if (preflight.errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] && !options.yes && !options.force) {
        // This is an interactive new project setup
        airdropConfigResult = await gatherAirdropConfiguration(options); // Gather all details including names

        // If options.cwd already ends with the determined project name from prompts, don't append.
        if (path.basename(options.cwd) !== airdropConfigResult.projectName) {
            options.cwd = path.resolve(options.cwd, airdropConfigResult.projectName || "");
        }

        await fs.ensureDir(options.cwd);
        logger.info(`Created project directory: ${highlighter.info(options.cwd)}`);
        options.isNewProject = true; // Mark as new project

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
          let templateToUse;
          // Use selectedSnapInTemplateName from airdropConfigResult for interactive mode
          if (airdropConfigResult.selectedSnapInTemplateName) {
            templateToUse = initConf.snapInTemplates.find(t => t.name === airdropConfigResult.selectedSnapInTemplateName);
            if (!templateToUse) {
                logger.error(`Selected Snap-in template '${airdropConfigResult.selectedSnapInTemplateName}' not found. Aborting.`);
                process.exit(1);
            }
            logger.info(`Using selected Snap-in template: ${templateToUse.name}`);
          } else {
            // This else block should ideally not be reached if prompts are correctly handled for interactive snap-in selection.
            // It serves as a fallback or indicates an unexpected state if selectedSnapInTemplateName is missing in interactive mode for a snap-in.
            // (Silent/yes mode is handled earlier and does not rely on selectedSnapInTemplateName)
            logger.error("No Snap-in template selected or found (selectedSnapInTemplateName missing). Aborting.");
            process.exit(1);
          }

          // The rest of the cloning logic remains the same, using templateToUse:
          const cloneSuccess = await cloneTemplate({
            repoUrl: templateToUse.url,
            targetPath: options.cwd,
            branch: templateToUse.branch,
            path: templateToUse.path
          });
          if (!cloneSuccess) {
            logger.error("Failed to clone Snap-in template. Aborting initialization.");
            process.exit(1);
          }
          logger.info(`Snap-in template cloned into ${highlighter.info(options.cwd)}.`);
        }
      } else {
        // Directory is not empty, or it's a forced/silent operation on an existing dir.
        // getProjectInfo would have been called by preflight or needs to be called if preflight was skipped.
        projectInfoFromGetProjectInfo = preflight.projectInfo || await getProjectInfo(options.cwd);
      }
    } else if (options.skipPreflight) {
        // Preflight skipped, try to get project info directly if it's an existing project context
        // This path might need careful review depending on how skipPreflight is used
        if (await fs.pathExists(path.join(options.cwd, "manifest.yml")) || await fs.pathExists(path.join(options.cwd, "manifest.yaml"))) {
            projectInfoFromGetProjectInfo = await getProjectInfo(options.cwd);
        }
    }
  }

  // Gather configuration if not already done (e.g. for existing projects or if preflight didn't result in new project path)
  // This typically runs for existing projects or if the new project path was already set (e.g. user cd'd into an empty dir)
  if (!airdropConfigResult!) {
    airdropConfigResult = await gatherAirdropConfiguration(options);
     // If projectName was gathered and options.cwd doesn't reflect it (e.g. init in existing empty dir)
    // This specific scenario (interactive init in an existing *empty* dir that's not the project name) is tricky.
    // The current gatherAirdropConfiguration doesn't assume it creates the dir, runInit does.
    // For now, we assume options.cwd is the correct root for config files.
  }

  // Final check for manifest file after potential directory creation and cloning
  const configFromManifest = await getConfig(options.cwd); // This should point to the final project CWD
  if (!configFromManifest && airdropConfigResult.projectTypeFromPrompt === 'airdrop') { // Snap-ins might not have it initially
    logger.error(`Failed to read manifest file at ${highlighter.info(options.cwd)}. Ensure a manifest.yml/yaml exists for Airdrop projects.`);
    // For Snap-ins, a manifest might be part of the template, or created later.
    // If it's an Airdrop project, it's more critical at this stage.
    // Consider if we need to throw an error or just warn for snap-ins.
    if (airdropConfigResult.projectTypeFromPrompt === 'airdrop') {
        throw new Error("Manifest file not found after project setup for Airdrop project.");
    } else {
        logger.warn(`Manifest file not found at ${highlighter.info(options.cwd)}. This might be expected for a new Snap-in if the template doesn't include it.`);
    }
  }


  // Check for existing snapin.config.mjs in the final options.cwd
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
  
  const coreConfig = extractCoreConfigForGeneration(airdropConfigResult); // Renamed function call

  const configSpinner = spinner(`Creating project configuration (snapin.config.mjs)...`).start(); // Updated message
  await writeSnapInConfig(options.cwd, coreConfig); // Renamed function call
  
  const envVars = extractEnvVarsFromConfig(coreConfig); // Use updated coreConfig variable
  if (Object.keys(envVars).length > 0) {
    await updateEnvFile(options.cwd, envVars);
  }
  
  await copyConfigTypes(options.cwd);
  await generateTypeDefinitions(options.cwd, coreConfig); // Use updated coreConfig variable
  configSpinner.succeed(`Project configuration created successfully in ${highlighter.info(options.cwd)}.`); // Updated message

  if (options.components?.length) {
    // Re-fetch config after writing, to ensure components are added based on the *new* configuration
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
): Promise<AirdropProjectConfig & { projectName?: string; projectTypeFromPrompt?: 'airdrop' | 'snap-in'; airdropProjectName?: string; snapInBaseName?: string; selectedSnapInTemplateName?: string; }> {
  if (options.silent || options.yes) {
    // Return default configuration for silent mode
    // Add projectName and projectTypeFromPrompt for consistency, though not directly used by default config path
    // No selectedSnapInTemplateName in silent mode, it will use default
    return {
      ...createDefaultAirdropConfig(),
      projectName: 'default-project',
      projectTypeFromPrompt: 'airdrop'
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
        { title: "Airdrop Project", value: "airdrop" },
        { title: "Snap-in (from template)", value: "snap-in" },
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
    projectName = generateAirdropSnapInFolderName(snapInBaseName); // This will be the folder name

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
        initial: "tickets,conversations",
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
    // For `devrevObjects` specifically, if it's the only one and cancelled, responses.devrevObjects would be undefined
    if (promptsList.some(p => p.name === 'devrevObjects') && typeof responses.devrevObjects === 'undefined') {
        logger.error("Project configuration was not completed. Aborting.");
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
        isSubdomain: secretResponses.isSubdomain, secretTransform: ".token",
        tokenVerification: { url: responses.testEndpoint, method: "GET" },
        fields: [{ id: "token", name: "API Token/Secret", description: `Your ${responses.externalSystemName} API Token/Secret` }],
      };
    }
  }

  const externalSyncUnitsList = (needsExternalSystem && responses.externalSyncUnits)
                               ? (Array.isArray(responses.externalSyncUnits) ? responses.externalSyncUnits : (responses.externalSyncUnits || "").split(',').map((s: string) => s.trim()).filter(Boolean))
                               : undefined;

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
  const envVars: Record<string, string> = {}
  
  if (config.connection.type === "oauth2") {
    const clientIdMatch = config.connection.clientId.match(/process\.env\.([A-Z_]+)/)
    const clientSecretMatch = config.connection.clientSecret.match(/process\.env\.([A-Z_]+)/)
    
    if (clientIdMatch) {
      envVars[clientIdMatch[1]] = "your-client-id-here"
    }
    if (clientSecretMatch) {
      envVars[clientSecretMatch[1]] = "your-client-secret-here"
    }
  }
  
  return envVars
}
