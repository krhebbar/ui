import path from "path";
import fs from "fs-extra";
import yaml from "yaml";
import { AirdropProjectConfig, OAuth2Connection, SecretConnection } from "../types/snapin-config";
import { readExistingSnapinConfig as readSnapinConfigFromFile } from "./project-config";
import { logger } from "./logger";

/**
 * Auto-detect project type based on folder name patterns
 */
export function autoDetectProjectType(cwd: string): 'airdrop' | 'snap-in' | null {
  const folderName = path.basename(cwd);
  
  // Check for airdrop pattern
  if (folderName.startsWith('airdrop-')) {
    return 'airdrop';
  }
  
  // Check for snap-in pattern
  if (folderName.endsWith('-snap-in')) {
    return 'snap-in';
  }
  
  return null;
}

/**
 * Check if project is already initialized (has manifest.yaml)
 */
export async function isProjectInitialized(cwd: string): Promise<boolean> {
  const manifestPathYaml = path.join(cwd, "manifest.yaml");
  const manifestPathYml = path.join(cwd, "manifest.yml");
  
  return (await fs.pathExists(manifestPathYaml)) || (await fs.pathExists(manifestPathYml));
}

/**
 * Find manifest file (supports both .yml and .yaml)
 */
export async function findManifestFile(cwd: string): Promise<string | null> {
  const manifestPathYaml = path.join(cwd, "manifest.yaml");
  const manifestPathYml = path.join(cwd, "manifest.yml");
  
  if (await fs.pathExists(manifestPathYaml)) {
    return manifestPathYaml;
  } else if (await fs.pathExists(manifestPathYml)) {
    return manifestPathYml;
  }
  
  return null;
}

/**
 * Read existing manifest.yaml file and extract configuration
 */
export async function readExistingManifest(cwd: string): Promise<Partial<AirdropProjectConfig> | null> {
  const manifestPath = await findManifestFile(cwd);
  if (!manifestPath) {
    return null;
  }

  try {
    const manifestContent = await fs.readFile(manifestPath, "utf8");
    const manifestData = yaml.parse(manifestContent);
    
    // Extract relevant configuration from manifest
    const config: Partial<AirdropProjectConfig> = {};
    
    // Try to determine project type from manifest structure
    if (manifestData.type === 'airdrop' || manifestData.imports) {
      config.projectType = 'airdrop';
      config.syncDirection = manifestData.sync_direction || "two-way";
    } else {
      config.projectType = 'snap-in';
    }

    // Extract external system info from imports or keyring_types
    if (manifestData.imports && manifestData.imports[0]) {
      const importItem = manifestData.imports[0];
      config.externalSystem = {
        name: importItem.display_name || manifestData.name || "External System",
        slug: importItem.slug || "external-system",
        apiBaseUrl: "https://api.example.com/v1",
        testEndpoint: "https://api.example.com/v1/me",
        externalObjects: [],
        accessMethod: "api" as const,
        connection: {
          type: "secret",
          id: "external-system-secret",
          secretTransform: "Bearer {token}",
          tokenVerification: {
            url: "https://api.example.com/v1/me",
            method: "GET",
          },
          fields: [],
        }
      };
    } else if (manifestData.keyring_types && manifestData.keyring_types[0]) {
      const keyringType = manifestData.keyring_types[0];
      config.externalSystem = {
        name: keyringType.name || manifestData.name || "External System",
        slug: manifestData.name?.toLowerCase().replace(/\s+/g, '-') || "external-system",
        apiBaseUrl: "https://api.example.com/v1", // No longer in keyring_type
        testEndpoint: keyringType.secret_config?.token_verification?.url || "https://api.example.com/v1/me",
        externalObjects: [],
        accessMethod: "api" as const,
        connection: {
          type: "secret",
          id: "external-system-secret",
          secretTransform: "Bearer {token}",
          tokenVerification: {
            url: keyringType.secret_config?.token_verification?.url || "https://api.example.com/v1/me",
            method: "GET",
          },
          fields: [],
        }
      };
    }

    // Extract DevRev objects (this is harder to determine from manifest alone)
    config.devrevObjects = ["account"]; // Default fallback

    logger.info(`Found existing manifest at ${manifestPath}, extracted configuration.`);
    return config;
  } catch (error) {
    logger.warn(`Failed to parse existing manifest: ${error}`);
    return null;
  }
}


/**
 * Merge existing configurations with precedence: snap-in.config > manifest > defaults
 */
export function mergeExistingConfigurations(
  manifestConfig: Partial<AirdropProjectConfig> | null,
  snapInConfig: Partial<AirdropProjectConfig> | null,
  defaultConfig: AirdropProjectConfig
): AirdropProjectConfig {
  // Start with defaults, then overlay manifest, then snap-in config
  return {
    ...defaultConfig,
    ...(manifestConfig || {}),
    ...(snapInConfig || {}),
  };
}

/**
 * Get comprehensive project state and configuration
 */
export async function getProjectState(cwd: string): Promise<{
  isInitialized: boolean;
  autoDetectedType: 'airdrop' | 'snap-in' | null;
  existingManifestConfig: Partial<AirdropProjectConfig> | null;
  existingSnapInConfig: Partial<AirdropProjectConfig> | null;
  manifestPath: string | null;
  hasSnapInConfig: boolean;
}> {
  const isInitialized = await isProjectInitialized(cwd);
  const autoDetectedType = autoDetectProjectType(cwd);
  const manifestPath = await findManifestFile(cwd);
  
  let existingManifestConfig: Partial<AirdropProjectConfig> | null = null;
  let existingSnapInConfig: Partial<AirdropProjectConfig> | null = null;
  
  if (isInitialized) {
    existingManifestConfig = await readExistingManifest(cwd);
    existingSnapInConfig = await readSnapinConfigFromFile(cwd);
  }

  // Check for snap-in config
  const snapInConfigPath = path.join(cwd, "snapin.config.mjs");
  const hasSnapInConfig = await fs.pathExists(snapInConfigPath);
  
  return {
    isInitialized,
    autoDetectedType,
    existingManifestConfig,
    existingSnapInConfig,
    manifestPath,
    hasSnapInConfig,
  };
}

// Manifest operations have been moved to the unified updaters module
// See: src/utils/updaters/update-manifest-file.ts



/**
 * Create minimal configuration for snap-in projects
 * Only includes projectType and empty/default structure
 */
export function createMinimalSnapInConfig(): AirdropProjectConfig {
  return {
    projectType: "snap-in",
    devrevObjects: [],
    externalSystem: {
      name: "",
      slug: "",
      apiBaseUrl: "",
      testEndpoint: "",
      externalObjects: [],
      accessMethod: "api" as const,
      connection: {
        type: "secret",
        id: "",
        secretTransform: "",
        tokenVerification: {
          url: "",
          method: "GET",
        },
        fields: [],
      } as SecretConnection,
    },
  };
}

/**
 * Create default configuration for airdrop/snap-in projects
 */
export function createDefaultAirdropConfig(projectType: 'airdrop' | 'snap-in' = 'airdrop'): AirdropProjectConfig {
  // For snap-ins, use minimal config by default unless we're merging with existing
  if (projectType === 'snap-in') {
    return createMinimalSnapInConfig();
  }

  // For airdrop projects, create a more complete default config
  const baseConfig: AirdropProjectConfig = {
    projectType: projectType,
    syncDirection: "two-way",
    externalSystem: {
      name: "My External System",
      slug: "airdrop-my-external-system",
      apiBaseUrl: "https://api.example.com/v1",
      testEndpoint: "https://api.example.com/v1/me",
      externalObjects: [],
      accessMethod: "api" as const,
      connection: {
        type: "oauth2",
        id: "airdrop-oauth2",
        clientId: "process.env.AIRDROP_MY_EXTERNAL_SYSTEM_CLIENT_ID",
        clientSecret: "process.env.AIRDROP_MY_EXTERNAL_SYSTEM_CLIENT_SECRET",
        authorize: {
          url: "https://api.example.com/v1/oauth/authorize",
          tokenUrl: "https://api.example.com/v1/oauth/token",
          grantType: "authorization_code",
          scope: "read write api",
          scopeDelimiter: " ",
        },
        refresh: {
          url: "https://api.example.com/v1/oauth/token",
          method: "POST",
        },
        revoke: {
          url: "https://api.example.com/v1/oauth/revoke",
          method: "POST",
        },
      } as OAuth2Connection,
    },
    devrevObjects: ["account"],
  };

  return baseConfig;
}

/**
 * Extract core configuration for file generation (removes UI-specific fields)
 */
export function extractCoreConfigForGeneration(
  augmentedConfig: AirdropProjectConfig & { 
    projectName?: string; 
    projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
    airdropProjectName?: string; 
    snapInBaseName?: string; 
    selectedSnapInTemplateName?: string; 
  }
): AirdropProjectConfig {
  const { projectName, projectTypeFromPrompt, airdropProjectName, snapInBaseName, selectedSnapInTemplateName, ...coreConfig } = augmentedConfig;
  return coreConfig;
} 