import { AirdropProjectConfig } from "../../types/snapin-config";
import { logger } from "../logger";
import { updateEnvFile, validateEnvFile, ValidationResult } from "./update-env";
import { updateManifestFile } from "./update-manifest-yaml";
import { updateSnapinConfigFile, writeSnapinConfigFile } from "./update-snapin-config-mjs";

/**
 * Unified interface for batch configuration file operations
 * Coordinates updates across multiple file types
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface ProjectUpdates {
  env?: Record<string, string>;
  manifest?: AirdropProjectConfig;
  snapinConfig?: Partial<AirdropProjectConfig>;
  devrevEnvVars?: {
    pat?: string;
    org?: string;
  };
}

export interface UpdateOptions {
  force?: boolean;
  validate?: boolean;
  createIfMissing?: boolean;
}

// Re-export ValidationResult for convenience
export type { ValidationResult } from "./update-env";

// =============================================================================
// Unified Batch Operations
// =============================================================================

/**
 * Update multiple configuration files in a single operation
 * 
 * @param cwd - Working directory path
 * @param updates - Object containing updates for different file types
 * @param options - Update options for behavior control
 * 
 * Input: Directory path, batch updates object, options
 * Output: Array of validation results for processed files
 */
export async function updateAllConfigFiles(
  cwd: string,
  updates: ProjectUpdates,
  options: UpdateOptions = { createIfMissing: true, validate: false }
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Update environment file
    if (updates.env) {
      await updateEnvFile(cwd, updates.env, options);
    }

    // Update manifest file
    if (updates.manifest) {
      await updateManifestFile(cwd, updates.manifest, options);
    }

    // Update snapin config file
    if (updates.snapinConfig) {
      await updateSnapinConfigFile(cwd, updates.snapinConfig, options);
    }

    // Validate all files if manifest config is provided
    if (updates.manifest && options.validate) {
      const envValidation = await validateEnvFile(cwd, updates.manifest, updates.devrevEnvVars);
      results.push(envValidation);
    }

    logger.info("All configuration files updated successfully");
  } catch (error) {
    logger.error(`Failed to update configuration files: ${error}`);
    throw error;
  }

  return results;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Log validation results to console with appropriate levels
 * 
 * @param results - Array of validation results to log
 * 
 * Input: Array of validation results
 * Output: Console output with errors and warnings
 */
export function logValidationResults(results: ValidationResult[]): void {
  results.forEach(result => {
    if (result.errors.length > 0) {
      logger.error("Configuration errors found:");
      result.errors.forEach(error => logger.error(`  - ${error}`));
    }
    if (result.warnings.length > 0) {
      logger.warn("Configuration warnings:");
      result.warnings.forEach(warning => logger.warn(`  - ${warning}`));
    }
  });
}

// Re-export individual updater functions for convenience
export { updateEnvFile, validateEnvFile, extractEnvVarsFromConfig } from "./update-env";
export { updateManifestFile } from "./update-manifest-yaml";
export { updateSnapinConfigFile, writeSnapinConfigFile } from "./update-snapin-config-mjs"; 