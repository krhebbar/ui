import { AirdropProjectConfig, OAuth2Connection, SecretConnection } from "../../types/airdrop-config";

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