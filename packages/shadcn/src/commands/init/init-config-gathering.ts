import { z } from "zod";
import prompts from "prompts";
import { AirdropProjectConfig, OAuth2Connection, SecretConnection, SUPPORTED_DEVREV_OBJECTS } from "../../types/airdrop-config";
import { initOptionsSchema } from "../init";
import { 
  createDefaultAirdropConfig, 
  autoDetectProjectType, 
  isProjectInitialized, 
  readExistingManifest, 
  readExistingSnapInConfig, 
  mergeExistingConfigurations 
} from "./init-utils";
import { getInitConfig } from "../../utils/init-config";
import { generateAirdropSnapInFolderName } from "../../utils/naming";
import { logger } from "../../utils/logger";

/**
 * Gather airdrop configuration from user prompts
 */
export async function gatherAirdropConfiguration(
  options: z.infer<typeof initOptionsSchema>
): Promise<AirdropProjectConfig & { 
  projectName?: string; 
  projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
  airdropProjectName?: string; 
  snapInBaseName?: string; 
  selectedSnapInTemplateName?: string; 
  devrevPatEnvVarName?: string; 
  devrevOrgEnvVarName?: string; 
}> {
  // Check if project is already initialized
  const isInitialized = await isProjectInitialized(options.cwd);
  
  // Auto-detect project type based on folder name
  const autoDetectedType = autoDetectProjectType(options.cwd);
  
  // Read existing configurations if project is initialized
  let existingManifestConfig: Partial<AirdropProjectConfig> | null = null;
  let existingSnapInConfig: Partial<AirdropProjectConfig> | null = null;
  
  if (isInitialized) {
    logger.info("Existing project detected. Reading current configuration...");
    existingManifestConfig = await readExistingManifest(options.cwd);
    existingSnapInConfig = await readExistingSnapInConfig(options.cwd);
  }

  if (options.silent || options.yes) {
    // Return configuration for silent mode
    const projectType = autoDetectedType || existingManifestConfig?.projectType || existingSnapInConfig?.projectType || 'snap-in';
    const defaultConfig = createDefaultAirdropConfig(projectType);
    
    // Merge existing configurations if available
    const mergedConfig = isInitialized 
      ? mergeExistingConfigurations(existingManifestConfig, existingSnapInConfig, defaultConfig)
      : defaultConfig;
    
    return {
      ...mergedConfig,
      // Don't set projectName for empty directories - we want to clone directly into current directory
      projectName: options.isNewProject ? undefined : 'default-project',
      projectTypeFromPrompt: projectType,
      devrevPatEnvVarName: "DEVREV_PAT",
      devrevOrgEnvVarName: "DEVREV_ORG",
    };
  }

  console.log("Let's configure your project:");

  // Determine if we should skip project type selection
  let projectType: 'airdrop' | 'snap-in';
  
  if (isInitialized && (existingManifestConfig?.projectType || existingSnapInConfig?.projectType)) {
    // Use existing project type for initialized projects
    projectType = existingManifestConfig?.projectType || existingSnapInConfig?.projectType || 'snap-in';
    logger.info(`Detected existing ${projectType} project. Continuing with update flow...`);
  } else if (autoDetectedType) {
    // Auto-detected project type
    projectType = autoDetectedType;
    logger.info(`Auto-detected project type: ${projectType} (based on folder name)`);
    
    if (!options.yes) {
      const { confirmType } = await prompts({
        type: "confirm",
        name: "confirmType",
        message: `Auto-detected project type as "${projectType}". Is this correct?`,
        initial: true,
      });
      
      if (!confirmType) {
        // Fallback to manual selection
        const response = await prompts({
          type: "select",
          name: "projectType",
          message: "What type of project are you creating?",
          choices: [
            { title: "Airdrop Project (from template)", value: "airdrop" },
            { title: "Snap-in Project (from template)", value: "snap-in" },
          ],
          initial: projectType === 'airdrop' ? 0 : 1,
        });
        projectType = response.projectType;
      }
    }
  } else {
    // Manual project type selection
    const response = await prompts({
      type: "select",
      name: "projectType",
      message: "What type of project are you creating?",
      choices: [
        { title: "Airdrop Project (from template)", value: "airdrop" },
        { title: "Snap-in Project (from template)", value: "snap-in" },
      ],
      initial: 0,
    });
    projectType = response.projectType;
  }

  if (projectType === "airdrop") {
    return await gatherAirdropProjectConfiguration(existingManifestConfig, existingSnapInConfig);
  } else {
    return await gatherSnapInProjectConfiguration(existingManifestConfig, existingSnapInConfig, isInitialized);
  }
}

/**
 * Gather configuration for Airdrop projects
 */
async function gatherAirdropProjectConfiguration(
  existingManifestConfig?: Partial<AirdropProjectConfig> | null,
  existingSnapInConfig?: Partial<AirdropProjectConfig> | null
): Promise<AirdropProjectConfig & { 
  projectName?: string; 
  projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
  airdropProjectName?: string; 
}> {
  // Project name
  const { airdropProjectName } = await prompts({
    type: "text",
    name: "airdropProjectName",
    message: "Enter a name for your Airdrop project (e.g., airdrop-my-connector):",
    initial: existingSnapInConfig?.externalSystem?.name || existingManifestConfig?.externalSystem?.name || "airdrop-my-connector",
    validate: (value) => value.trim().length > 0 || "Project name is required",
  });

  // Sync direction
  const { syncDirection } = await prompts({
    type: "select",
    name: "syncDirection",
    message: "What sync direction do you need for this Airdrop project?",
    choices: [
      { title: "Two-way sync", value: "two-way" },
      { title: "One-way sync", value: "one-way" },
    ],
    initial: existingSnapInConfig?.syncDirection === "one-way" || existingManifestConfig?.syncDirection === "one-way" ? 1 : 0,
  });

  // External system details
  const { externalSystemName } = await prompts({
    type: "text",
    name: "externalSystemName",
    message: "What is the name of your external system (e.g., Notion, Jira)?",
    initial: existingSnapInConfig?.externalSystem?.name || existingManifestConfig?.externalSystem?.name || "My External System",
    validate: (value) => value.trim().length > 0 || "External system name is required",
  });

  const { externalSystemSlug } = await prompts({
    type: "text",
    name: "externalSystemSlug",
    message: "External system slug (machine-readable, kebab-case):",
    initial: existingSnapInConfig?.externalSystem?.slug || existingManifestConfig?.externalSystem?.slug || `airdrop-${externalSystemName.toLowerCase().replace(/\s+/g, "-")}`,
    validate: (value) => /^[a-z0-9-]+$/.test(value) || "Slug must be kebab-case (lowercase, hyphens only)",
  });

  const { apiBaseUrl } = await prompts({
    type: "text",
    name: "apiBaseUrl",
    message: "API base URL for the external system:",
    initial: existingSnapInConfig?.externalSystem?.apiBaseUrl || existingManifestConfig?.externalSystem?.apiBaseUrl || "https://api.example.com/v1",
    validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
  });

  const { testEndpoint } = await prompts({
    type: "text",
    name: "testEndpoint",
    message: "Test endpoint for connection verification (relative to API base URL or absolute):",
    initial: existingSnapInConfig?.externalSystem?.testEndpoint || existingManifestConfig?.externalSystem?.testEndpoint || "https://api.example.com/v1/me",
    validate: (value) => value.trim().length > 0 || "Test endpoint is required",
  });

  const { objectTypesString } = await prompts({
    type: "text",
    name: "objectTypesString",
    message: "Enter external system object types (e.g., tickets, conversations, comma-separated):",
    initial: existingSnapInConfig?.externalSystem?.supportedObjects?.join(", ") || existingManifestConfig?.externalSystem?.supportedObjects?.join(", ") || "",
  });

  const objectTypes = objectTypesString ? objectTypesString.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  // Connection type
  const existingConnectionType = existingSnapInConfig?.connection?.type || existingManifestConfig?.connection?.type;
  const { connectionType } = await prompts({
    type: "select",
    name: "connectionType",
    message: "What type of connection will the snap-in use?",
    choices: [
      { title: "OAuth2", value: "oauth2" },
      { title: "API Token/Secret", value: "secret" },
    ],
    initial: existingConnectionType === "secret" ? 1 : 0,
  });

  // DevRev objects
  const existingDevRevObjects = existingSnapInConfig?.devrevObjects || existingManifestConfig?.devrevObjects || ["account"];
  const { devrevObjects } = await prompts({
    type: "multiselect",
    name: "devrevObjects",
    message: "Select DevRev objects to sync/interact with (space to select, enter to confirm):",
    choices: SUPPORTED_DEVREV_OBJECTS.map(obj => ({ 
      title: obj, 
      value: obj, 
      selected: existingDevRevObjects.includes(obj) 
    })),
    min: 1,
  });

  let connection: OAuth2Connection | SecretConnection;

  if (connectionType === "oauth2") {
    connection = await gatherOAuth2Configuration(externalSystemSlug, existingSnapInConfig?.connection, existingManifestConfig?.connection);
  } else {
    connection = await gatherSecretConfiguration(externalSystemSlug, existingSnapInConfig?.connection, existingManifestConfig?.connection);
  }

  const config: AirdropProjectConfig & { 
    projectName?: string; 
    projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
    airdropProjectName?: string; 
  } = {
    projectType: "airdrop",
    syncDirection,
    externalSystem: {
      name: externalSystemName,
      slug: externalSystemSlug,
      apiBaseUrl,
      testEndpoint,
      supportedObjects: objectTypes,
    },
    connection,
    devrevObjects,
    projectName: airdropProjectName,
    projectTypeFromPrompt: "airdrop",
    airdropProjectName,
  };

  return config;
}

/**
 * Gather configuration for Snap-in projects
 */
async function gatherSnapInProjectConfiguration(
  existingManifestConfig?: Partial<AirdropProjectConfig> | null,
  existingSnapInConfig?: Partial<AirdropProjectConfig> | null,
  isInitialized: boolean = false
): Promise<AirdropProjectConfig & { 
  projectName?: string; 
  projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
  snapInBaseName?: string; 
  selectedSnapInTemplateName?: string; 
}> {
  const initConf = getInitConfig();

  let selectedSnapInTemplateName: string | undefined;
  
  // Skip template selection for existing projects
  if (isInitialized) {
    logger.info("Existing snap-in project detected. Skipping template selection...");
    selectedSnapInTemplateName = undefined; // Will not clone template for existing projects
  } else {
    // Template selection for new projects only
    const response = await prompts({
      type: "select",
      name: "selectedSnapInTemplateName",
      message: "Choose a Snap-in template:",
      choices: initConf.snapInTemplates.map(template => ({
        title: `${template.name} - ${template.description || "No description"}`,
        value: template.name,
      })),
      initial: 0,
    });
    selectedSnapInTemplateName = response.selectedSnapInTemplateName;
  }

  // Snap-in base name
  const existingName = existingSnapInConfig?.externalSystem?.name || existingManifestConfig?.externalSystem?.name;
  const { snapInBaseName } = await prompts({
    type: "text",
    name: "snapInBaseName",
    message: "Enter a base name for your Snap-in:",
    initial: existingName || "my-snapin",
    validate: (value) => value.trim().length > 0 || "Snap-in name is required",
  });

  const projectName = isInitialized ? undefined : generateAirdropSnapInFolderName(snapInBaseName);

  // Use existing config as base or create default
  const defaultConfig = createDefaultAirdropConfig('snap-in');
  const mergedConfig = isInitialized 
    ? mergeExistingConfigurations(existingManifestConfig, existingSnapInConfig, defaultConfig)
    : defaultConfig;

  const config: AirdropProjectConfig & { 
    projectName?: string; 
    projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
    snapInBaseName?: string; 
    selectedSnapInTemplateName?: string; 
  } = {
    ...mergedConfig,
    projectName,
    projectTypeFromPrompt: "snap-in",
    snapInBaseName,
    selectedSnapInTemplateName,
  };

  return config;
}

/**
 * Gather OAuth2 connection configuration
 */
async function gatherOAuth2Configuration(
  systemSlug: string, 
  existingSnapInConnection?: OAuth2Connection | SecretConnection, 
  existingManifestConnection?: OAuth2Connection | SecretConnection
): Promise<OAuth2Connection> {
  const existingOAuth = (existingSnapInConnection?.type === 'oauth2' ? existingSnapInConnection : 
                        existingManifestConnection?.type === 'oauth2' ? existingManifestConnection : null) as OAuth2Connection | null;
  
  const clientIdEnvVar = `${systemSlug.toUpperCase().replace(/-/g, "_")}_CLIENT_ID`;
  const clientSecretEnvVar = `${systemSlug.toUpperCase().replace(/-/g, "_")}_CLIENT_SECRET`;

  const { clientIdEnvVarName } = await prompts({
    type: "text",
    name: "clientIdEnvVarName",
    message: "Environment variable name for OAuth client ID:",
    initial: existingOAuth?.clientId?.toString().match(/process\.env\.([A-Z_0-9]+)/)?.[1] || clientIdEnvVar,
    validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
  });

  const { clientSecretEnvVarName } = await prompts({
    type: "text",
    name: "clientSecretEnvVarName",
    message: "Environment variable name for OAuth client secret:",
    initial: existingOAuth?.clientSecret?.toString().match(/process\.env\.([A-Z_0-9]+)/)?.[1] || clientSecretEnvVar,
    validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
  });

  const { authorizationUrl } = await prompts({
    type: "text",
    name: "authorizationUrl",
    message: "OAuth authorization URL:",
    initial: existingOAuth?.authorize?.url || "https://api.example.com/v1/oauth/authorize",
    validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
  });

  const { tokenUrl } = await prompts({
    type: "text",
    name: "tokenUrl",
    message: "OAuth token URL:",
    initial: existingOAuth?.authorize?.tokenUrl || "https://api.example.com/v1/oauth/token",
    validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
  });

  const { scope } = await prompts({
    type: "text",
    name: "scope",
    message: "OAuth scope (space-separated):",
    initial: existingOAuth?.authorize?.scope || "read write api",
    validate: (value) => value.trim().length > 0 || "Scope is required",
  });

  return {
    type: "oauth2",
    id: `${systemSlug}-oauth2`,
    clientId: `process.env.${clientIdEnvVarName}`,
    clientSecret: `process.env.${clientSecretEnvVarName}`,
    authorize: {
      url: authorizationUrl,
      tokenUrl,
      grantType: "authorization_code",
      scope,
      scopeDelimiter: " ",
    },
    refresh: {
      url: tokenUrl,
      method: "POST",
    },
    revoke: {
      url: tokenUrl.replace("/token", "/revoke"),
      method: "POST",
    },
  };
}

/**
 * Gather secret connection configuration
 */
async function gatherSecretConfiguration(
  systemSlug: string,
  existingSnapInConnection?: OAuth2Connection | SecretConnection, 
  existingManifestConnection?: OAuth2Connection | SecretConnection
): Promise<SecretConnection> {
  const existingSecret = (existingSnapInConnection?.type === 'secret' ? existingSnapInConnection : 
                         existingManifestConnection?.type === 'secret' ? existingManifestConnection : null) as SecretConnection | null;
  
  const tokenEnvVar = `${systemSlug.toUpperCase().replace(/-/g, "_")}_TOKEN`;

  const { tokenEnvVarName } = await prompts({
    type: "text",
    name: "tokenEnvVarName",
    message: "Environment variable name for API token:",
    initial: existingSecret?.tokenEnvVarName || tokenEnvVar,
    validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
  });

  return {
    type: "secret",
    id: `${systemSlug}-secret`,
    secretTransform: "Bearer {token}",
    tokenVerification: {
      url: existingSecret?.tokenVerification?.url || "https://api.example.com/v1/me",
      method: "GET",
    },
    fields: [
      {
        id: "token",
        name: "API Token",
        description: "Your API token for the external system",
      },
    ],
    tokenEnvVarName,
  };
} 