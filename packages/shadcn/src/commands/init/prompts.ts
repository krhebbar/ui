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

  if (options.silent) {
    // Return configuration for silent mode (but not --yes mode, which should still process flags)
    // Give precedence to explicit --project-type flag, then auto-detection, then existing config
    const projectTypeFromFlag = options.projectType === 'snapin' ? 'snap-in' : options.projectType as 'airdrop' | 'snap-in' | undefined;
    const projectType = projectTypeFromFlag || autoDetectedType || existingManifestConfig?.projectType || existingSnapInConfig?.projectType || 'snap-in';
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
    };
  }

  console.log("Let's configure your project:");

  // Determine project type, giving precedence to the --projectType flag
  let projectType: 'airdrop' | 'snap-in';

  if (options.projectType) {
    // Handle both "snapin" and "snap-in" for backward compatibility
    const projectTypeInput = options.projectType;
    projectType = projectTypeInput === 'snapin' ? 'snap-in' : projectTypeInput as 'airdrop' | 'snap-in';
    logger.info(`Project type determined by --project-type flag: ${projectType}`);
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
  } else if (options.yes) {
    // Default to 'airdrop' when --yes is used without explicit project type
    projectType = 'airdrop';
    logger.info(`Defaulting to airdrop project type with --yes flag`);
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
  // Project name - auto-generate from external system name if provided
  let airdropProjectNameResolved: string;
  if (options.externalSystemName) {
    airdropProjectNameResolved = `airdrop-${options.externalSystemName.toLowerCase().replace(/\s+/g, "-")}`;
    logger.info(`Auto-generated Airdrop project name from --external-system-name flag: ${airdropProjectNameResolved}`);
  } else if (options.projectName) {
    airdropProjectNameResolved = options.projectName;
    logger.info(`Using Airdrop project name from --project-name flag: ${airdropProjectNameResolved}`);
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
  let syncDirection: "one-way" | "two-way";
  if (options.syncDirection) {
    syncDirection = options.syncDirection;
    logger.info(`Using sync direction from --sync-direction flag: ${syncDirection}`);
  } else {
    const { syncDirection: promptedSyncDirection } = await prompts({
      type: "select",
      name: "syncDirection",
      message: "What sync direction do you need for this Airdrop project?",
      choices: [
        { title: "Two-way sync", value: "two-way" },
        { title: "One-way sync", value: "one-way" },
      ],
      initial: existingSnapInConfig?.syncDirection === "one-way" || existingManifestConfig?.syncDirection === "one-way" ? 1 : 0,
    });
    syncDirection = promptedSyncDirection;
  }

  // External system details
  let externalSystemName: string;
  if (options.externalSystemName) {
    externalSystemName = options.externalSystemName;
    logger.info(`Using external system name from --external-system-name flag: ${externalSystemName}`);
  } else {
    const { externalSystemName: promptedName } = await prompts({
      type: "text",
      name: "externalSystemName",
      message: "What is the name of your external system (e.g., Notion, Jira)?",
      initial: existingSnapInConfig?.externalSystem?.name || existingManifestConfig?.externalSystem?.name || "Enter your external system name",
      validate: (value) => value.trim().length > 0 || "External system name is required",
    });
    externalSystemName = promptedName;
  }

  // Auto-generate slug from external system name when using --yes flag
  let externalSystemSlug: string;
  if (options.yes || options.silent) {
    externalSystemSlug = existingSnapInConfig?.externalSystem?.slug || existingManifestConfig?.externalSystem?.slug || `airdrop-${externalSystemName.toLowerCase().replace(/\s+/g, "-")}`;
    logger.info(`Auto-generated external system slug: ${externalSystemSlug}`);
  } else {
    const { externalSystemSlug: promptedSlug } = await prompts({
      type: "text",
      name: "externalSystemSlug",
      message: "External system slug (machine-readable, kebab-case):",
      initial: existingSnapInConfig?.externalSystem?.slug || existingManifestConfig?.externalSystem?.slug || `airdrop-${externalSystemName.toLowerCase().replace(/\s+/g, "-")}`,
      validate: (value) => /^[a-z0-9-]+$/.test(value) || "Slug must be kebab-case (lowercase, hyphens only)",
    });
    externalSystemSlug = promptedSlug;
  }

  // Access method
  let accessMethod: "api" | "sdk";
  if (options.accessMethod) {
    accessMethod = options.accessMethod;
    logger.info(`Using access method from --access-method flag: ${accessMethod}`);
  } else {
    const { accessMethod: promptedAccessMethod } = await prompts({
      type: "select",
      name: "accessMethod",
      message: "How will this system be accessed?",
      choices: [
        { title: "API", value: "api" },
        { title: "SDK", value: "sdk" },
      ],
      initial: existingSnapInConfig?.externalSystem?.accessMethod === "sdk" || existingManifestConfig?.externalSystem?.accessMethod === "sdk" ? 1 : 0,
    });
    accessMethod = promptedAccessMethod;
  }

  // Documentation URL
  let documentationUrl: string;
  if (options.documentationUrl) {
    documentationUrl = options.documentationUrl;
    logger.info(`Using documentation URL from --documentation-url flag: ${documentationUrl}`);
  } else {
    const { documentationUrl: promptedDocUrl } = await prompts({
      type: "text",
      name: "documentationUrl",
      message: "Documentation URL for the external system (optional):",
      initial: existingSnapInConfig?.externalSystem?.documentationUrl || existingManifestConfig?.externalSystem?.documentationUrl || "https://docs.example.com",
      validate: (value) => !value || /^https?:\/\/.+/.test(value) || "Must be a valid URL or empty",
    });
    documentationUrl = promptedDocUrl;
  }

  let apiBaseUrl: string | undefined;

  let sdkBaseUrl: string | undefined;
  let sdkPackages: string[] = [];

  if (accessMethod === "api") {
    if (options.yes || options.silent) {
      apiBaseUrl = existingSnapInConfig?.externalSystem?.apiBaseUrl || existingManifestConfig?.externalSystem?.apiBaseUrl || "https://api.example.com/v1";
      logger.info(`Using API base URL: ${apiBaseUrl}`);
    } else {
      const { promptedApiBaseUrl } = await prompts({
        type: "text",
        name: "promptedApiBaseUrl",
        message: "API base URL for the external system:",
        initial: existingSnapInConfig?.externalSystem?.apiBaseUrl || existingManifestConfig?.externalSystem?.apiBaseUrl || "https://api.example.com/v1",
        validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
      });
      apiBaseUrl = promptedApiBaseUrl;
    }


  } else if (accessMethod === "sdk") {
    if (options.yes || options.silent) {
      sdkBaseUrl = existingSnapInConfig?.externalSystem?.sdkBaseUrl || existingManifestConfig?.externalSystem?.sdkBaseUrl || "https://api.example.com/v1";
      sdkPackages = existingSnapInConfig?.externalSystem?.sdkPackages || existingManifestConfig?.externalSystem?.sdkPackages || [];
      logger.info(`Using SDK base URL: ${sdkBaseUrl}`);
      logger.info(`Using SDK packages: ${sdkPackages.length > 0 ? sdkPackages.join(", ") : "none"}`);
    } else {
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
  }

  // Auto-generate empty external objects when using --yes flag
  let externalObjects: string[] = [];
  if (options.yes || options.silent) {
    const existingObjects = existingSnapInConfig?.externalSystem?.externalObjects || existingManifestConfig?.externalSystem?.externalObjects || [];
    externalObjects = existingObjects;
    logger.info(`Using existing external objects: ${externalObjects.length > 0 ? externalObjects.join(", ") : "none"}`);
  } else {
    const { externalObjectsString } = await prompts({
      type: "text",
      name: "externalObjectsString",
      message: "Enter external system object types (e.g., tickets, conversations, comma-separated):",
      initial: existingSnapInConfig?.externalSystem?.externalObjects?.join(", ") || existingManifestConfig?.externalSystem?.externalObjects?.join(", ") || "",
    });
    externalObjects = externalObjectsString ? externalObjectsString.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  }

  // Connection type
  let connectionTypeResolved: 'oauth2' | 'secret';
  const existingConnectionType = existingSnapInConfig?.externalSystem?.connection?.type || existingManifestConfig?.externalSystem?.connection?.type;

  if (options.connectionType) {
    connectionTypeResolved = options.connectionType === 'oauth' ? 'oauth2' : 'secret';
    logger.info(`Connection type determined by --connection-type flag: ${options.connectionType} (resolved to ${connectionTypeResolved})`);
  } else if (options.authType) {
    connectionTypeResolved = options.authType === 'oauth' ? 'oauth2' : 'secret';
    logger.info(`Connection type determined by --auth-type flag: ${options.authType} (resolved to ${connectionTypeResolved})`);
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
  const existingDevRevObjects = existingSnapInConfig?.devrevObjects || existingManifestConfig?.devrevObjects || [];
  let devrevObjects: string[] = [];
  if (options.yes || options.silent) {
    devrevObjects = existingDevRevObjects;
    logger.info(`Using existing DevRev objects: ${devrevObjects.length > 0 ? devrevObjects.join(", ") : "none"}`);
  } else {
    const { devrevObjects: promptedDevrevObjects } = await prompts({
      type: "multiselect",
      name: "devrevObjects",
      message: "Select DevRev objects to sync/interact with (space to select, enter to confirm):",
      choices: SUPPORTED_DEVREV_OBJECTS.map(obj => ({ 
        title: obj, 
        value: obj, 
        selected: existingDevRevObjects.includes(obj) 
      })),
      min: 0, // Allow empty selection
    });
    devrevObjects = promptedDevrevObjects;
  }

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

  // Snap-in base name / External system name
  let snapInBaseNameResolved: string;
  if (options.externalSystemName) {
    snapInBaseNameResolved = options.externalSystemName;
    logger.info(`Using external system name from --external-system-name flag: ${snapInBaseNameResolved}`);
  } else if (options.projectName) {
    snapInBaseNameResolved = options.projectName;
    logger.info(`Using Snap-in base name from --project-name flag: ${snapInBaseNameResolved}`);
  } else {
    const existingName = existingSnapInConfig?.externalSystem?.name || existingManifestConfig?.externalSystem?.name;
    const { snapInBaseName: promptedName } = await prompts({
      type: "text",
      name: "snapInBaseName",
      message: "Enter the external system name for your Snap-in:",
      initial: existingName || "my-system",
      validate: (value) => value.trim().length > 0 || "External system name is required",
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

  let clientIdEnvVarName: string;
  let clientSecretEnvVarName: string;
  let authorizationUrl: string;
  let tokenUrl: string;
  let scope: string;

  if (options?.yes || options?.silent) {
    // Use default values when --yes flag is used
    clientIdEnvVarName = existingOAuth?.clientId?.toString().match(/process\.env\.([A-Z_0-9]+)/)?.[1] || clientIdEnvVar;
    clientSecretEnvVarName = existingOAuth?.clientSecret?.toString().match(/process\.env\.([A-Z_0-9]+)/)?.[1] || clientSecretEnvVar;
    authorizationUrl = existingOAuth?.authorize?.url || "https://api.example.com/v1/oauth/authorize";
    tokenUrl = existingOAuth?.authorize?.tokenUrl || "https://api.example.com/v1/oauth/token";
    scope = existingOAuth?.authorize?.scope || "read write api";
    
    logger.info(`Using OAuth configuration with --yes flag:`);
    logger.info(`  Client ID env var: ${clientIdEnvVarName}`);
    logger.info(`  Client Secret env var: ${clientSecretEnvVarName}`);
    logger.info(`  Authorization URL: ${authorizationUrl}`);
    logger.info(`  Token URL: ${tokenUrl}`);
    logger.info(`  Scope: ${scope}`);
  } else {
    // Interactive prompts
    const clientIdResponse = await prompts({
      type: "text",
      name: "clientIdEnvVarName",
      message: "Environment variable name for OAuth client ID:",
      initial: existingOAuth?.clientId?.toString().match(/process\.env\.([A-Z_0-9]+)/)?.[1] || clientIdEnvVar,
      validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
    });
    clientIdEnvVarName = clientIdResponse.clientIdEnvVarName;

    const clientSecretResponse = await prompts({
      type: "text",
      name: "clientSecretEnvVarName",
      message: "Environment variable name for OAuth client secret:",
      initial: existingOAuth?.clientSecret?.toString().match(/process\.env\.([A-Z_0-9]+)/)?.[1] || clientSecretEnvVar,
      validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
    });
    clientSecretEnvVarName = clientSecretResponse.clientSecretEnvVarName;

    const authUrlResponse = await prompts({
      type: "text",
      name: "authorizationUrl",
      message: "OAuth authorization URL:",
      initial: existingOAuth?.authorize?.url || "https://api.example.com/v1/oauth/authorize",
      validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
    });
    authorizationUrl = authUrlResponse.authorizationUrl;

    const tokenUrlResponse = await prompts({
      type: "text",
      name: "tokenUrl",
      message: "OAuth token URL:",
      initial: existingOAuth?.authorize?.tokenUrl || "https://api.example.com/v1/oauth/token",
      validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
    });
    tokenUrl = tokenUrlResponse.tokenUrl;

    const scopeResponse = await prompts({
      type: "text",
      name: "scope",
      message: "OAuth scope (space-separated):",
      initial: existingOAuth?.authorize?.scope || "read write api",
      validate: (value) => value.trim().length > 0 || "Scope is required",
    });
    scope = scopeResponse.scope;
  }

  return {
    type: "oauth2",
    id: `${systemSlug}-oauth2`,
    clientId: `process.env.${clientIdEnvVarName}`,
    clientSecret: `process.env.${clientSecretEnvVarName}`,
    headers: {},
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
    tokenEnvVarName: "", // OAuth doesn't use token env var name
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

  let tokenEnvVarName: string;

  if (options?.yes || options?.silent) {
    // Use default value when --yes flag is used
    tokenEnvVarName = existingSecret?.tokenEnvVarName || tokenEnvVar;
    logger.info(`Using Secret configuration with --yes flag:`);
    logger.info(`  Token env var: ${tokenEnvVarName}`);
  } else {
    // Interactive prompt
    const tokenResponse = await prompts({
      type: "text",
      name: "tokenEnvVarName",
      message: "Environment variable name for API token:",
      initial: existingSecret?.tokenEnvVarName || tokenEnvVar,
      validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
    });
    tokenEnvVarName = tokenResponse.tokenEnvVarName;
  }

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