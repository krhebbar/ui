import { z } from "zod";
import prompts from "prompts";
import { AirdropProjectConfig, OAuth2Connection, SecretConnection, SUPPORTED_DEVREV_OBJECTS } from "../../types/snapin-config";
import { initOptionsSchema } from "../init";
import { 
  createDefaultAirdropConfig, 
  autoDetectProjectType, 
  isProjectInitialized, 
  readExistingManifest, 
  mergeExistingConfigurations 
} from "../../utils/project-utils";
import { getInitConfig } from "../../utils/project-templates";
import { readExistingSnapinConfig } from "../../utils/project-config";
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
    existingSnapInConfig = await readExistingSnapinConfig(options.cwd);
  }

  if (options.silent || options.yes) {
    // Return configuration for silent mode
    const projectType = autoDetectedType || existingManifestConfig?.projectType || existingSnapInConfig?.projectType || 'snap-in';
    const defaultConfig = createDefaultAirdropConfig(projectType);
    
    // Merge existing configurations if available
    const mergedConfig = isInitialized 
      ? mergeExistingConfigurations(existingManifestConfig, existingSnapInConfig, defaultConfig)
      : defaultConfig;
    
    // For airdrop type, we need template name for cloning
    let selectedSnapInTemplateName: string | undefined;
    if (projectType === 'snap-in' && !isInitialized) {
      // Use default template for new snap-in projects in silent mode
      const initConf = getInitConfig();
      selectedSnapInTemplateName = initConf.snapInTemplates[0]?.name;
    }
    
    return {
      ...mergedConfig,
      projectName: undefined,
      projectTypeFromPrompt: projectType,
      selectedSnapInTemplateName,
      devrevPatEnvVarName: "DEVREV_PAT",
      devrevOrgEnvVarName: "DEVREV_ORG",
    };
  }

  console.log("Let's configure your project:");

  // Determine project type, giving precedence to the --projectType flag
  let projectType: 'airdrop' | 'snap-in';

  if (options.projectType) {
    projectType = options.projectType as 'airdrop' | 'snap-in';
    logger.info(`Project type determined by --projectType flag: ${projectType}`);
  } else if (isInitialized && (existingManifestConfig?.projectType || existingSnapInConfig?.projectType)) {
    // Use existing project type for initialized projects
    projectType = existingManifestConfig?.projectType || existingSnapInConfig?.projectType || 'snap-in';
    logger.info(`Detected existing ${projectType} project. Continuing with update flow...`);
  } else if (autoDetectedType) {
    // Auto-detected project type
    projectType = autoDetectedType;
    logger.info(`Auto-detected project type: ${projectType} (based on folder name)`);
    
    // For auto-detected type, confirm unless --yes is passed
    if (!options.yes) {
      const { confirmType } = await prompts({
        type: "confirm",
        name: "confirmType",
        message: `Auto-detected project type as "${projectType}". Is this correct?`,
        initial: true,
      });
      
      if (!confirmType) {
        // Fallback to manual selection if auto-detection is not confirmed
        const response = await prompts({
          type: "select",
          name: "projectType",
          message: "What type of project are you creating?",
          choices: [
            { title: "Airdrop Project (from template)", value: "airdrop" },
            { title: "Snap-in Project (from template)", value: "snap-in" },
          ],
          initial: projectType === 'airdrop' ? 0 : 1, // Default to current auto-detected or 'airdrop'
        });
        projectType = response.projectType;
      }
      // If options.yes is true with autoDetectedType, we proceed with autoDetectedType
    }
  } else {
    // Manual project type selection if no flag, not initialized, and no auto-detection
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
    return await gatherAirdropProjectConfiguration(options, existingManifestConfig, existingSnapInConfig); // Pass options here
  } else {
    return await gatherSnapInProjectConfiguration(options, existingManifestConfig, existingSnapInConfig, isInitialized); // Pass options here for snap-in as well
  }
}

/**
 * Gather configuration for Airdrop projects
 */
async function gatherAirdropProjectConfiguration(
  options: z.infer<typeof initOptionsSchema>, // Added options here
  existingManifestConfig?: Partial<AirdropProjectConfig> | null,
  existingSnapInConfig?: Partial<AirdropProjectConfig> | null
): Promise<AirdropProjectConfig & { 
  projectName?: string; 
  projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
  airdropProjectName?: string; 
}> {
  // Project name
  let airdropProjectNameResolved: string;
  if (options.projectName) {
    airdropProjectNameResolved = options.projectName;
    logger.info(`Using Airdrop project name from --projectName flag: ${airdropProjectNameResolved}`);
  } else {
    const { airdropProjectName: promptedName } = await prompts({
      type: "text",
      name: "airdropProjectName",
      message: "Enter a name for your Airdrop project (e.g., airdrop-notion):",
      initial: existingSnapInConfig?.externalSystem?.name || existingManifestConfig?.externalSystem?.name || "airdrop-",
      validate: (value) => value.trim().length > 0 || "Project name is required",
    });
    airdropProjectNameResolved = promptedName;
  }

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
    initial: existingSnapInConfig?.externalSystem?.name || existingManifestConfig?.externalSystem?.name || "Enter your external system name",
    validate: (value) => value.trim().length > 0 || "External system name is required",
  });

  const { externalSystemSlug } = await prompts({
    type: "text",
    name: "externalSystemSlug",
    message: "External system slug (machine-readable, kebab-case):",
    initial: existingSnapInConfig?.externalSystem?.slug || existingManifestConfig?.externalSystem?.slug || `airdrop-${externalSystemName.toLowerCase().replace(/\s+/g, "-")}`,
    validate: (value) => /^[a-z0-9-]+$/.test(value) || "Slug must be kebab-case (lowercase, hyphens only)",
  });

  // Access method
  const { accessMethod } = await prompts({
    type: "select",
    name: "accessMethod",
    message: "How will this system be accessed?",
    choices: [
      { title: "API", value: "api" },
      { title: "SDK", value: "sdk" },
    ],
    initial: existingSnapInConfig?.externalSystem?.accessMethod === "sdk" || existingManifestConfig?.externalSystem?.accessMethod === "sdk" ? 1 : 0,
  });

  // Documentation URL
  const { documentationUrl } = await prompts({
    type: "text",
    name: "documentationUrl",
    message: "Documentation URL for the external system (optional):",
    initial: existingSnapInConfig?.externalSystem?.documentationUrl || existingManifestConfig?.externalSystem?.documentationUrl || "https://docs.example.com",
    validate: (value) => !value || /^https?:\/\/.+/.test(value) || "Must be a valid URL or empty",
  });

  let apiBaseUrl: string | undefined;
  let testEndpoint: string | undefined;
  let sdkBaseUrl: string | undefined;
  let sdkPackages: string[] = [];

  if (accessMethod === "api") {
    const { promptedApiBaseUrl } = await prompts({
      type: "text",
      name: "promptedApiBaseUrl",
      message: "API base URL for the external system:",
      initial: existingSnapInConfig?.externalSystem?.apiBaseUrl || existingManifestConfig?.externalSystem?.apiBaseUrl || "https://api.example.com/v1",
      validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
    });
    apiBaseUrl = promptedApiBaseUrl;

    const { promptedTestEndpoint } = await prompts({
      type: "text",
      name: "promptedTestEndpoint",
      message: "Test endpoint for connection verification (relative to API base URL or absolute):",
      initial: existingSnapInConfig?.externalSystem?.testEndpoint || existingManifestConfig?.externalSystem?.testEndpoint || "https://api.example.com/v1/me",
      validate: (value) => value.trim().length > 0 || "Test endpoint is required",
    });
    testEndpoint = promptedTestEndpoint;
  } else if (accessMethod === "sdk") {
    const { promptedSdkBaseUrl } = await prompts({
      type: "text",
      name: "promptedSdkBaseUrl",
      message: "SDK base URL for the external system (optional, can be same as API base if applicable):",
      initial: existingSnapInConfig?.externalSystem?.sdkBaseUrl || existingManifestConfig?.externalSystem?.sdkBaseUrl || "https://api.example.com/v1",
      validate: (value) => !value || /^https?:\/\/.+/.test(value) || "Must be a valid URL or empty",
    });
    sdkBaseUrl = promptedSdkBaseUrl;

    const { sdkPackagesString } = await prompts({
      type: "text",
      name: "sdkPackagesString",
      message: "Enter SDK package names (e.g., @scope/package-name, another-package, comma-separated):",
      initial: existingSnapInConfig?.externalSystem?.sdkPackages?.join(", ") || existingManifestConfig?.externalSystem?.sdkPackages?.join(", ") || "",
    });
    sdkPackages = sdkPackagesString ? sdkPackagesString.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  }

  const { externalObjectsString } = await prompts({
    type: "text",
    name: "externalObjectsString",
    message: "Enter external system object types (e.g., tickets, conversations, comma-separated):",
    initial: existingSnapInConfig?.externalSystem?.externalObjects?.join(", ") || existingManifestConfig?.externalSystem?.externalObjects?.join(", ") || "",
  });

  const externalObjects = externalObjectsString ? externalObjectsString.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  // Connection type
  let connectionTypeResolved: 'oauth2' | 'secret';
  const existingConnectionType = existingSnapInConfig?.externalSystem?.connection?.type || existingManifestConfig?.externalSystem?.connection?.type;

  if (options.authType) {
    connectionTypeResolved = options.authType === 'oauth' ? 'oauth2' : 'secret';
    logger.info(`Connection type determined by --authType flag: ${options.authType} (resolved to ${connectionTypeResolved})`);
  } else {
    const { connectionType: promptedConnectionType } = await prompts({
      type: "select",
      name: "connectionType",
      message: "What type of connection will the Airdrop project use?", // Clarified message for Airdrop
      choices: [
        { title: "OAuth2", value: "oauth2" },
        { title: "API Token/Secret", value: "secret" },
      ],
      initial: existingConnectionType === "secret" ? 1 : 0,
    });
    connectionTypeResolved = promptedConnectionType;
  }

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

  if (connectionTypeResolved === "oauth2") {
    connection = await gatherOAuth2Configuration(externalSystemSlug, existingSnapInConfig?.externalSystem?.connection, existingManifestConfig?.externalSystem?.connection, options);
  } else {
    connection = await gatherSecretConfiguration(externalSystemSlug, existingSnapInConfig?.externalSystem?.connection, existingManifestConfig?.externalSystem?.connection, options);
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
      accessMethod,
      documentationUrl,
      apiBaseUrl: accessMethod === "api" ? apiBaseUrl! : "https://api.example.com/v1",
      testEndpoint: accessMethod === "api" ? testEndpoint! : "https://api.example.com/v1/me",
      sdkBaseUrl: accessMethod === "sdk" ? sdkBaseUrl : undefined,
      sdkPackages: accessMethod === "sdk" ? sdkPackages : undefined,
      externalObjects: externalObjects,
      connection: connection, // Connection object is now nested
    },
    devrevObjects,
    projectName: airdropProjectNameResolved, // This is often used for directory creation
    projectTypeFromPrompt: "airdrop",
    airdropProjectName: airdropProjectNameResolved, // Specific attribute if needed
  };

  return config;
}

/**
 * Gather configuration for Snap-in projects
 */
async function gatherSnapInProjectConfiguration(
  options: z.infer<typeof initOptionsSchema>, // Added options here
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

  if (isInitialized) {
    logger.info("Existing snap-in project detected. Skipping template selection.");
    selectedSnapInTemplateName = undefined; // Will not clone template for existing projects
  } else if (options.templateName) {
    const isValidTemplate = initConf.snapInTemplates.some(template => template.name === options.templateName);
    if (isValidTemplate) {
      selectedSnapInTemplateName = options.templateName;
      logger.info(`Using Snap-in template from --templateName flag: ${selectedSnapInTemplateName}`);
    } else {
      logger.warn(`Invalid template name '${options.templateName}' provided via --templateName flag. Falling back to interactive selection.`);
      // Fall through to prompt by not setting selectedSnapInTemplateName here
    }
  }

  // Prompt for template only if not initialized, and no valid templateName flag was provided
  if (!isInitialized && !selectedSnapInTemplateName) {
    const response = await prompts({
      type: "select",
      name: "selectedSnapInTemplateName",
      message: "Choose a Snap-in template:",
      choices: initConf.snapInTemplates.map(template => ({
        title: `${template.name} - ${template.description || "No description"}`,
        value: template.name,
      })),
      initial: 0, // You might want to find a better initial if possible or leave as 0
    });
    selectedSnapInTemplateName = response.selectedSnapInTemplateName;
  }

  // Snap-in base name
  let snapInBaseNameResolved: string;
  if (options.projectName) {
    snapInBaseNameResolved = options.projectName;
    logger.info(`Using Snap-in base name from --projectName flag: ${snapInBaseNameResolved}`);
  } else {
    const existingName = existingSnapInConfig?.externalSystem?.name || existingManifestConfig?.externalSystem?.name;
    const { snapInBaseName: promptedName } = await prompts({
      type: "text",
      name: "snapInBaseName",
      message: "Enter a base name for your Snap-in:",
      initial: existingName || "my-snapin",
      validate: (value) => value.trim().length > 0 || "Snap-in name is required",
    });
    snapInBaseNameResolved = promptedName;
  }

  const projectName = isInitialized ? undefined : generateAirdropSnapInFolderName(snapInBaseNameResolved);

  // Use existing config as base or create default
  const defaultConfig = createDefaultAirdropConfig('snap-in');
  const mergedConfig = isInitialized 
    ? mergeExistingConfigurations(existingManifestConfig || {}, existingSnapInConfig || {}, defaultConfig)
    : defaultConfig;

  const config: AirdropProjectConfig & { 
    projectName?: string; 
    projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
    snapInBaseName?: string; 
    selectedSnapInTemplateName?: string; 
  } = {
    ...mergedConfig,
    projectName, // This is the directory name
    projectTypeFromPrompt: "snap-in",
    snapInBaseName: snapInBaseNameResolved, // This is the conceptual name
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
  existingManifestConnection?: OAuth2Connection | SecretConnection,
  options?: z.infer<typeof initOptionsSchema> // Added options here, optional
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
  existingManifestConnection?: OAuth2Connection | SecretConnection,
  options?: z.infer<typeof initOptionsSchema> // Added options here, optional
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