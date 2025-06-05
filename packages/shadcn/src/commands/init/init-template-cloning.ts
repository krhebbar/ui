import path from "path";
import fs from "fs-extra";
import { AirdropProjectConfig } from "../../types/airdrop-config";
import { cloneTemplate } from "../../utils/git";
import { getInitConfig } from "../../utils/init-config";
import { airdropTemplates } from "../../utils/init-config";
import { logger } from "../../utils/logger";
import { highlighter } from "../../utils/highlighter";

/**
 * Clone template for new projects (both interactive and silent modes)
 */
export async function cloneProjectTemplate(
  projectType: 'airdrop' | 'snap-in',
  targetPath: string,
  selectedSnapInTemplateName?: string
): Promise<boolean> {
  logger.info(`Initializing ${projectType} project with template...`);

  if (projectType === "airdrop") {
    return await cloneAirdropTemplate(targetPath);
  } else {
    return await cloneSnapInTemplate(targetPath, selectedSnapInTemplateName);
  }
}

/**
 * Clone Airdrop project template
 */
async function cloneAirdropTemplate(targetPath: string): Promise<boolean> {
  logger.info(`Cloning Airdrop project template...`);
  
  const airdropTemplateToUse = airdropTemplates && airdropTemplates.length > 0 
    ? airdropTemplates[0] 
    : undefined;
    
  if (!airdropTemplateToUse) {
    logger.error("No Airdrop templates found in configuration. Cannot proceed with cloning. Please define airdrop templates in init-config.ts.");
    return false;
  }

  logger.info(`Cloning Airdrop project from template: ${airdropTemplateToUse.name}`);
  
  const cloneSuccess = await cloneTemplate({
    repoUrl: airdropTemplateToUse.url,
    targetPath,
    branch: airdropTemplateToUse.branch,
    path: airdropTemplateToUse.path
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
async function cloneSnapInTemplate(targetPath: string, selectedSnapInTemplateName?: string): Promise<boolean> {
  const initConf = getInitConfig();
  
  // Determine which template to use
  let templateToUse;
  if (selectedSnapInTemplateName) {
    templateToUse = initConf.snapInTemplates.find(t => t.name === selectedSnapInTemplateName);
    if (!templateToUse) {
      logger.error(`Selected Snap-in template '${selectedSnapInTemplateName}' not found.`);
      return false;
    }
    logger.info(`Using selected Snap-in template: ${templateToUse.name}`);
  } else {
    // Use default template for silent/yes mode
    templateToUse = initConf.snapInTemplates.find(t => t.name === initConf.defaultSnapInTemplateName);
    if (!templateToUse) {
      logger.error(`Default Snap-in template '${initConf.defaultSnapInTemplateName}' not found.`);
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
    logger.error(`Failed to clone Snap-in template${selectedSnapInTemplateName ? '' : ' in silent/yes mode'}.`);
    return false;
  }

  logger.info(`Snap-in template cloned${selectedSnapInTemplateName ? '' : ' (silent/yes mode)'}.`);
  return true;
}

/**
 * Create project directory and handle path management
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