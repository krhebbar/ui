/**
 * Unified updaters module - Public API
 * 
 * This module provides a single interface for updating all project configuration files
 * with consistency, idempotency, and extensibility across different file types.
 */

// Environment file operations
export {
  updateEnvFile,
  validateEnvFile,
  extractEnvVarsFromConfig,
} from "./update-env";

export type {
  UpdateOptions as EnvUpdateOptions,
  ValidationResult,
} from "./update-env";

// Manifest file operations
export {
  updateManifestFile,
} from "./update-manifest-yaml";

export type {
  UpdateOptions as ManifestUpdateOptions,
} from "./update-manifest-yaml";

// Snapin configuration file operations
export {
  updateSnapinConfigFile,
  writeSnapinConfigFile,
} from "./update-snapin-config-mjs";

export type {
  UpdateOptions as SnapinUpdateOptions,
} from "./update-snapin-config-mjs";

// Batch operations and coordination
export {
  updateAllConfigFiles,
  logValidationResults,
} from "./update-config-files";

export type {
  ProjectUpdates,
  UpdateOptions,
} from "./update-config-files";

// Legacy file updaters (for non-config files)
export {
  updateFiles,
  resolveFilePath,
  findCommonRoot,
  resolveNestedFilePath,
  getNormalizedFileContent,
  resolvePageTarget,
  resolveModuleByProbablePath,
  toAliasedImport,
} from "./update-files";

export {
  updateDependencies,
} from "./update-dependencies"; 