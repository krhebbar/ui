import path from "path";
import fs from "fs-extra";
import { AirdropProjectConfig, airdropConfigSchema } from "../../types/snapin-config";
import { logger } from "../logger";

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface UpdateOptions {
  force?: boolean;
  validate?: boolean;
  createIfMissing?: boolean;
}

// =============================================================================
// Snapin Configuration File Operations
// =============================================================================

/**
 * Update existing snapin.config.mjs file with partial configuration
 * 
 * @param cwd - Working directory path
 * @param patch - Partial configuration to merge with existing config
 * @param options - Update options for behavior control
 * 
 * Input: Directory path, partial configuration, options
 * Output: Updated snapin.config.mjs file (idempotent operation)
 */
export async function updateSnapinConfigFile(
  cwd: string,
  patch: Partial<AirdropProjectConfig>,
  options: UpdateOptions = {}
): Promise<void> {
  const configPath = path.join(cwd, "snapin.config.mjs");
  
  try {
    // Try to read existing config
    const existingConfig = await readSnapinConfig(cwd);
    
    if (!existingConfig && !options.createIfMissing) {
      logger.warn("No snapin.config.mjs found and createIfMissing is false");
      return;
    }

    const updatedConfig = existingConfig ? { ...existingConfig, ...patch } : patch as AirdropProjectConfig;
    
    // Validate the updated config if requested
    if (options.validate) {
      airdropConfigSchema.parse(updatedConfig);
    }
    
    await writeSnapinConfigFile(cwd, updatedConfig);
    
  } catch (error) {
    const errorDetail = error instanceof Error ? `: ${error.message}` : '';
    if (options.createIfMissing && !await fs.pathExists(configPath)) {
      // Create new config file
      if (airdropConfigSchema.safeParse(patch).success) {
        await writeSnapinConfigFile(cwd, patch as AirdropProjectConfig);
      } else {
        throw new Error(`Cannot create snapin.config.mjs - invalid configuration${errorDetail}`);
      }
    } else {
      throw new Error(`Failed to update snapin.config.mjs${errorDetail}`);
    }
  }
}

/**
 * Write complete snapin.config.mjs file with full configuration
 * 
 * @param cwd - Working directory path
 * @param config - Complete project configuration object
 * 
 * Input: Directory path, complete project configuration
 * Output: New snapin.config.mjs file created/overwritten
 */
export async function writeSnapinConfigFile(
  cwd: string,
  config: AirdropProjectConfig
): Promise<void> {
  const configPath = path.join(cwd, "snapin.config.mjs");
  const configContent = generateSnapinConfigContent(config);
  
  await fs.writeFile(configPath, configContent, "utf8");
  logger.info(`Snapin configuration written to ${configPath}`);
}

/**
 * Read and parse existing snapin.config.mjs file
 * 
 * @param cwd - Working directory path
 * 
 * Input: Directory path
 * Output: Parsed configuration object or null if not found/invalid
 */
async function readSnapinConfig(cwd: string): Promise<AirdropProjectConfig | null> {
  try {
    const configPath = path.join(cwd, "snapin.config.mjs");
    await fs.access(configPath);
    
    const configModule = await import(`${configPath}?update=${Date.now()}`);
    const rawConfig = configModule.default;
    
    if (!rawConfig) {
      return null;
    }

    const validationResult = airdropConfigSchema.safeParse(rawConfig);
    return validationResult.success ? validationResult.data : rawConfig;
  } catch {
    return null;
  }
}

/**
 * Generate snapin.config.mjs file content from configuration object
 * 
 * @param config - Complete project configuration object
 * 
 * Input: Project configuration
 * Output: JavaScript module content string
 */
function generateSnapinConfigContent(config: AirdropProjectConfig): string {
  return `/** @type {import('./types/snapin-config').AirdropProjectConfig} */
export default ${JSON.stringify(config, null, 2).replace(
    /"(process\.env\.[A-Z_]+)"/g,
    "$1"
  )}
`;
} 