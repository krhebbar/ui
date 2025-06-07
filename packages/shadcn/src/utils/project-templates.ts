import path from "path";
import fs from "fs-extra";
import { cloneTemplate } from "./git";
import { logger } from "./logger";
import { highlighter } from "./highlighter";

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface SnapInTemplate {
  name: string;
  description: string;
  url: string;
  branch?: string;
  path?: string;
}

export interface AirdropTemplate {
  name: string;
  description: string;
  url: string;
  branch?: string;
  path?: string;
}

export interface TemplatesConfig {
  defaultApiBaseUrl: string;
  defaultTestEndpoint: string;
  defaultSnapInTemplateName: string;
  snapInTemplates: SnapInTemplate[];
  airdropTemplates: AirdropTemplate[];
}

// =============================================================================
// Template Configuration
// =============================================================================

const templatesConfig: TemplatesConfig = {
  defaultApiBaseUrl: "https://api.example.com/v1",
  defaultTestEndpoint: "/me",
  defaultSnapInTemplateName: "default-snapin-template",
  snapInTemplates: [
    {
      name: "default-snapin-template",
      description: "Default Snap-in template",
      url: "https://github.com/devrev/snap-in-examples.git",
      branch: "main",
      path: "1-starter",
    },
    {
      name: "custom-webhook-snapin-template",
      description: "Custom Webhook Snap-in template",
      url: "https://github.com/devrev/snap-in-examples.git",
      branch: "main",
      path: "5-custom-webhook",
    },
  ],
  airdropTemplates: [
    {
      name: "default-airdrop-template",
      description: "Default Airdrop project template",
      url: "https://github.com/devrev/airdrop-template",
      branch: "main",
    },
  ],
};

// =============================================================================
// Template Access Functions
// =============================================================================



export function getDefaultSnapInTemplate(): SnapInTemplate | null {
  return templatesConfig.snapInTemplates.find(t => t.name === templatesConfig.defaultSnapInTemplateName) || null;
}

export function getDefaultAirdropTemplate(): AirdropTemplate | null {
  return templatesConfig.airdropTemplates[0] || null;
}

// Legacy compatibility for init-config
export function getInitConfig(): {
  defaultApiBaseUrl: string;
  defaultTestEndpoint: string; 
  defaultSnapInTemplateName: string;
  snapInTemplates: SnapInTemplate[];
} {
  return {
    defaultApiBaseUrl: templatesConfig.defaultApiBaseUrl,
    defaultTestEndpoint: templatesConfig.defaultTestEndpoint,
    defaultSnapInTemplateName: templatesConfig.defaultSnapInTemplateName,
    snapInTemplates: templatesConfig.snapInTemplates,
  };
}

// =============================================================================
// Template Cloning Operations
// =============================================================================

/**
 * Clone template for new projects
 * 
 * @param projectType - Type of project (airdrop or snap-in)
 * @param targetPath - Directory to clone template into
 * @param selectedTemplateName - Specific template name (optional for snap-ins)
 * @returns Success status
 */
export async function cloneProjectTemplate(
  projectType: 'airdrop' | 'snap-in',
  targetPath: string,
  selectedTemplateName?: string
): Promise<boolean> {
  logger.info(`Initializing ${projectType} project with template...`);

  if (projectType === "airdrop") {
    return await cloneAirdropTemplate(targetPath);
  } else {
    return await cloneSnapInTemplate(targetPath, selectedTemplateName);
  }
}

/**
 * Clone Airdrop project template
 */
async function cloneAirdropTemplate(targetPath: string): Promise<boolean> {
  logger.info(`Cloning Airdrop project template...`);
  
  const template = getDefaultAirdropTemplate();
  if (!template) {
    logger.error("No Airdrop templates found in configuration. Cannot proceed with cloning.");
    return false;
  }

  logger.info(`Cloning Airdrop project from template: ${template.name}`);
  
  const cloneSuccess = await cloneTemplate({
    repoUrl: template.url,
    targetPath,
    branch: template.branch,
    path: template.path
  });

  if (!cloneSuccess) {
    logger.error("Failed to clone Airdrop project template.");
    return false;
  }

  logger.info(`Airdrop project template cloned successfully into ${highlighter.info(targetPath)}.`);
  return true;
}

/**
 * Clone Snap-in template
 */
async function cloneSnapInTemplate(targetPath: string, selectedTemplateName?: string): Promise<boolean> {
  // Determine which template to use
  let templateToUse: SnapInTemplate | null = null;
  
  if (selectedTemplateName) {
    templateToUse = templatesConfig.snapInTemplates.find(t => t.name === selectedTemplateName) || null;
    if (!templateToUse) {
      logger.error(`Selected Snap-in template '${selectedTemplateName}' not found.`);
      return false;
    }
    logger.info(`Using selected Snap-in template: ${templateToUse.name}`);
  } else {
    templateToUse = getDefaultSnapInTemplate();
    if (!templateToUse) {
      logger.error(`Default Snap-in template '${templatesConfig.defaultSnapInTemplateName}' not found.`);
      return false;
    }
    logger.info(`Using default Snap-in template: ${templateToUse.name} (silent/yes mode)`);
  }

  const cloneSuccess = await cloneTemplate({
    repoUrl: templateToUse.url,
    targetPath,
    branch: templateToUse.branch,
    path: templateToUse.path
  });

  if (!cloneSuccess) {
    logger.error(`Failed to clone Snap-in template${selectedTemplateName ? '' : ' in silent/yes mode'}.`);
    return false;
  }

  logger.info(`Snap-in template cloned${selectedTemplateName ? '' : ' (silent/yes mode)'}.`);
  return true;
}

// =============================================================================
// Directory Management
// =============================================================================

/**
 * Create project directory and handle path management
 * 
 * @param basePath - Base directory path
 * @param projectName - Name of the project directory to create
 * @returns Full path to created project directory
 */
export async function createProjectDirectory(
  basePath: string,
  projectName: string
): Promise<string> {
  const projectPath = path.join(basePath, projectName);
  
  // Check if the project directory already exists
  if (await fs.pathExists(projectPath)) {
    logger.error(`A directory with the name ${highlighter.info(projectName)} already exists at ${highlighter.info(basePath)}.`);
    logger.error("Please choose a different name or remove the existing directory.");
    throw new Error(`Directory ${projectName} already exists`);
  }

  logger.info(`Creating new project directory: ${highlighter.info(projectPath)}`);
  await fs.ensureDir(projectPath);
  logger.info(`Project directory created: ${highlighter.info(projectPath)}`);
  
  return projectPath;
} 