import { AirdropProjectConfig, OAuth2Connection, SecretConnection } from "../../types/airdrop-config";
import path from "path";
import fs from "fs-extra";
import yaml from "yaml";
import { getSnapInConfig } from "../../utils/airdrop-config";
import { logger } from "../../utils/logger";

/**
 * Extract core configuration for file generation
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
 * Read existing manifest.yaml file and extract configuration
 */
export async function readExistingManifest(cwd: string): Promise<Partial<AirdropProjectConfig> | null> {
  const manifestPathYaml = path.join(cwd, "manifest.yaml");
  const manifestPathYml = path.join(cwd, "manifest.yml");
  
  let manifestPath: string;
  if (await fs.pathExists(manifestPathYaml)) {
    manifestPath = manifestPathYaml;
  } else if (await fs.pathExists(manifestPathYml)) {
    manifestPath = manifestPathYml;
  } else {
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
        supportedObjects: []
      };
    } else if (manifestData.keyring_types && manifestData.keyring_types[0]) {
      const keyringType = manifestData.keyring_types[0];
      config.externalSystem = {
        name: keyringType.external_system_name || manifestData.name || "External System",
        slug: manifestData.name?.toLowerCase().replace(/\s+/g, '-') || "external-system",
        apiBaseUrl: keyringType.api_base_url || "https://api.example.com/v1",
        testEndpoint: keyringType.token_verification?.url || "https://api.example.com/v1/me",
        supportedObjects: []
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
 * Read existing snap-in.config.mjs and extract configuration
 */
export async function readExistingSnapInConfig(cwd: string): Promise<Partial<AirdropProjectConfig> | null> {
  try {
    const configResult = await getSnapInConfig(cwd);
    if (configResult.validatedConfig) {
      logger.info("Found existing snap-in.config.mjs, extracted configuration.");
      return configResult.validatedConfig;
    } else if (configResult.rawConfig) {
      logger.info("Found snap-in.config.mjs but validation failed, using raw config as fallback.");
      return configResult.rawConfig;
    }
  } catch (error) {
    // No snap-in.config.mjs found or error reading it
  }
  
  return null;
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
 * Create default configuration for airdrop/snap-in projects
 */
export function createDefaultAirdropConfig(projectType: 'airdrop' | 'snap-in' = 'airdrop'): AirdropProjectConfig {
  const baseConfig: AirdropProjectConfig = {
    projectType: projectType,
    externalSystem: {
      name: projectType === 'snap-in' ? "External System" : "My External System",
      slug: projectType === 'snap-in' ? "external-system" : "airdrop-my-external-system",
      apiBaseUrl: "https://api.example.com/v1",
      testEndpoint: "https://api.example.com/v1/me",
      supportedObjects: [],
    },
    connection: {
      type: "secret",
      id: "external-system-secret",
      secretTransform: "Bearer {token}",
      tokenVerification: {
        url: "https://api.example.com/v1/me",
        method: "GET",
      },
      fields: [
        {
          id: "token",
          name: "API Token",
          description: "Your API token for the external system",
        },
      ],
      tokenEnvVarName: "EXTERNAL_SYSTEM_TOKEN",
    } as SecretConnection,
    devrevObjects: ["account"],
  };

  if (projectType === 'airdrop') {
    baseConfig.syncDirection = "two-way";
    baseConfig.connection = {
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
    } as OAuth2Connection;
  }

  return baseConfig;
}

/**
 * Extract environment variables from configuration
 */
export function extractEnvVarsFromConfig(config: AirdropProjectConfig): Record<string, string> {
  const envVars: Record<string, string> = {};

  if (config.connection?.type === "oauth2") {
    const oauthConnection = config.connection;
    if (typeof oauthConnection.clientId === 'string') {
      const clientIdMatch = oauthConnection.clientId.match(/process\.env\.([A-Z_0-9]+)/);
      if (clientIdMatch && clientIdMatch[1]) {
        envVars[clientIdMatch[1]] = "your-client-id-here";
      }
    }
    if (typeof oauthConnection.clientSecret === 'string') {
      const clientSecretMatch = oauthConnection.clientSecret.match(/process\.env\.([A-Z_0-9]+)/);
      if (clientSecretMatch && clientSecretMatch[1]) {
        envVars[clientSecretMatch[1]] = "your-client-secret-here";
      }
    }
  } else if (config.connection?.type === "secret") {
    const secretConnection = config.connection as SecretConnection;
    if (secretConnection.tokenEnvVarName) {
      envVars[secretConnection.tokenEnvVarName] = "your-api-token-here";
    }
  }

  return envVars;
} 