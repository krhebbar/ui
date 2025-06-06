import fs from "fs/promises";
import path from "path";
import { AirdropProjectConfig, airdropConfigSchema } from "../types/snapin-config";
import { ZodError } from "zod";
import { logger } from "./logger";

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface ConfigReadResult {
  validatedConfig: AirdropProjectConfig | null;
  rawConfig: any | null;
  error?: ZodError | Error;
}

// =============================================================================
// Constants
// =============================================================================

const CONFIG_FILENAME = "snapin.config.mjs";

// =============================================================================
// Config Reading Operations
// =============================================================================

/**
 * Read and validate snapin configuration from file
 * 
 * @param cwd - Working directory path
 * @returns Configuration read result with validation status
 */
export async function readSnapinConfig(cwd: string): Promise<ConfigReadResult> {
  try {
    const configPath = path.join(cwd, CONFIG_FILENAME);
    
    // Check if file exists
    try {
      await fs.access(configPath);
    } catch (accessError) {
      return { 
        validatedConfig: null, 
        rawConfig: null, 
        error: new Error("snapin.config.mjs not found.") 
      };
    }

    // Dynamic import with cache-busting to ensure fresh content
    const configModule = await import(`${configPath}?update=${Date.now()}`);
    const rawConfig = configModule.default;

    if (!rawConfig) {
      return { 
        validatedConfig: null, 
        rawConfig: null, 
        error: new Error("snapin.config.mjs does not have a default export.") 
      };
    }

    // Validate configuration
    try {
      const validatedConfig = airdropConfigSchema.parse(rawConfig);
      return { validatedConfig, rawConfig, error: undefined };
    } catch (validationError) {
      return { 
        validatedConfig: null, 
        rawConfig, 
        error: validationError as ZodError 
      };
    }
  } catch (generalError: any) {
    logger.error(`Failed to read or import snapin.config.mjs: ${generalError.message}`);
    return { 
      validatedConfig: null, 
      rawConfig: null, 
      error: generalError 
    };
  }
}

/**
 * Check if snapin configuration file exists
 * 
 * @param cwd - Working directory path
 * @returns True if config file exists
 */
export async function hasSnapinConfig(cwd: string): Promise<boolean> {
  try {
    const configPath = path.join(cwd, CONFIG_FILENAME);
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read existing snapin config and return as partial config (legacy compatibility)
 * 
 * @param cwd - Working directory path
 * @returns Partial configuration or null if not found
 */
export async function readExistingSnapinConfig(cwd: string): Promise<Partial<AirdropProjectConfig> | null> {
  try {
    const configResult = await readSnapinConfig(cwd);
    if (configResult.validatedConfig) {
      logger.info("Found existing snapin.config.mjs, extracted configuration.");
      return configResult.validatedConfig;
    } else if (configResult.rawConfig) {
      logger.info("Found snapin.config.mjs but validation failed, using raw config as fallback.");
      return configResult.rawConfig;
    }
  } catch (error) {
    // No snapin.config.mjs found or error reading it
  }
  
  return null;
}

// =============================================================================
// Config Management Operations  
// =============================================================================

/**
 * Add DevRev objects to the snapin configuration
 * 
 * @param cwd - Working directory path
 * @param objects - Array of DevRev object names to add
 */
export async function addDevRevObjectsToSnapinConfig(
  cwd: string,
  objects: string[]
): Promise<void> {
  const { updateSnapinConfigFile } = await import("./updaters/update-snapin-config-mjs");
  
  const configResult = await readSnapinConfig(cwd);
  const config = configResult.validatedConfig;
  if (!config) {
    const errorDetail = configResult.error ? `: ${configResult.error.message}` : '';
    throw new Error(`No valid snapin configuration found to add DevRev objects${errorDetail}`);
  }

  const existingObjects = new Set(config.devrevObjects || []);
  const newObjects = objects.filter(obj => !existingObjects.has(obj));
  
  if (newObjects.length > 0) {
    await updateSnapinConfigFile(cwd, { 
      devrevObjects: [...(config.devrevObjects || []), ...newObjects]
    }, { createIfMissing: false, validate: true });
    logger.info(`Added DevRev objects: ${newObjects.join(", ")}`);
  }
}

/**
 * Add external sync units to the snapin configuration
 * 
 * @param cwd - Working directory path
 * @param units - Array of external sync unit names to add
 */
export async function addExternalSyncUnitsToSnapinConfig(
  cwd: string,
  units: string[]
): Promise<void> {
  const { updateSnapinConfigFile } = await import("./updaters/update-snapin-config-mjs");
  
  const configResult = await readSnapinConfig(cwd);
  const config = configResult.validatedConfig;
  if (!config) {
    const errorDetail = configResult.error ? `: ${configResult.error.message}` : '';
    throw new Error(`No valid snapin configuration found to add external sync units${errorDetail}`);
  }

  const existingUnits = new Set(config.externalSyncUnits || []);
  const newUnits = units.filter(unit => !existingUnits.has(unit));
  
  if (newUnits.length > 0) {
    await updateSnapinConfigFile(cwd, { 
      externalSyncUnits: [...(config.externalSyncUnits || []), ...newUnits]
    }, { createIfMissing: false, validate: true });
    logger.info(`Added external sync units: ${newUnits.join(", ")}`);
  }
} 