import { z } from "zod";
import prompts from "prompts";
import { AirdropProjectConfig, OAuth2Connection, SecretConnection, SUPPORTED_DEVREV_OBJECTS } from "../../types/airdrop-config";
import { initOptionsSchema } from "../init";
import { createDefaultAirdropConfig } from "./init-utils";
import { getInitConfig } from "../../utils/init-config";
import { generateAirdropSnapInFolderName } from "../../utils/naming";

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
  if (options.silent || options.yes) {
    // Return default configuration for silent mode
    // Always default to snap-in for --yes mode since that's the most common use case
    const projectType = 'snap-in';
    return {
      ...createDefaultAirdropConfig(projectType),
      // Don't set projectName for empty directories - we want to clone directly into current directory
      projectName: options.isNewProject ? undefined : 'default-project',
      projectTypeFromPrompt: projectType,
      devrevPatEnvVarName: "DEVREV_PAT",
      devrevOrgEnvVarName: "DEVREV_ORG",
    };
  }

  console.log("Let's configure your project:");

  // Project type selection
  const { projectType } = await prompts({
    type: "select",
    name: "projectType",
    message: "What type of project are you creating?",
    choices: [
      { title: "Airdrop Project (from template)", value: "airdrop" },
      { title: "Snap-in Project (from template)", value: "snap-in" },
    ],
    initial: 0,
  });

  if (projectType === "airdrop") {
    return await gatherAirdropProjectConfiguration();
  } else {
    return await gatherSnapInProjectConfiguration();
  }
}

/**
 * Gather configuration for Airdrop projects
 */
async function gatherAirdropProjectConfiguration(): Promise<AirdropProjectConfig & { 
  projectName?: string; 
  projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
  airdropProjectName?: string; 
}> {
  // Project name
  const { airdropProjectName } = await prompts({
    type: "text",
    name: "airdropProjectName",
    message: "Enter a name for your Airdrop project (e.g., airdrop-my-connector):",
    initial: "airdrop-my-connector",
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
    initial: 0,
  });

  // External system details
  const { externalSystemName } = await prompts({
    type: "text",
    name: "externalSystemName",
    message: "What is the name of your external system (e.g., Notion, Jira)?",
    initial: "My External System",
    validate: (value) => value.trim().length > 0 || "External system name is required",
  });

  const { externalSystemSlug } = await prompts({
    type: "text",
    name: "externalSystemSlug",
    message: "External system slug (machine-readable, kebab-case):",
    initial: `airdrop-${externalSystemName.toLowerCase().replace(/\s+/g, "-")}`,
    validate: (value) => /^[a-z0-9-]+$/.test(value) || "Slug must be kebab-case (lowercase, hyphens only)",
  });

  const { apiBaseUrl } = await prompts({
    type: "text",
    name: "apiBaseUrl",
    message: "API base URL for the external system:",
    initial: "https://api.example.com/v1",
    validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
  });

  const { testEndpoint } = await prompts({
    type: "text",
    name: "testEndpoint",
    message: "Test endpoint for connection verification (relative to API base URL or absolute):",
    initial: "https://api.example.com/v1/me",
    validate: (value) => value.trim().length > 0 || "Test endpoint is required",
  });

  const { objectTypesString } = await prompts({
    type: "text",
    name: "objectTypesString",
    message: "Enter external system object types (e.g., tickets, conversations, comma-separated):",
    initial: "",
  });

  const objectTypes = objectTypesString ? objectTypesString.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  // Connection type
  const { connectionType } = await prompts({
    type: "select",
    name: "connectionType",
    message: "What type of connection will the snap-in use?",
    choices: [
      { title: "OAuth2", value: "oauth2" },
      { title: "API Token/Secret", value: "secret" },
    ],
    initial: 0,
  });

  // DevRev objects
  const { devrevObjects } = await prompts({
    type: "multiselect",
    name: "devrevObjects",
    message: "Select DevRev objects to sync/interact with (space to select, enter to confirm):",
    choices: SUPPORTED_DEVREV_OBJECTS.map(obj => ({ title: obj, value: obj, selected: obj === "account" })),
    min: 1,
  });

  let connection: OAuth2Connection | SecretConnection;

  if (connectionType === "oauth2") {
    connection = await gatherOAuth2Configuration(externalSystemSlug);
  } else {
    connection = await gatherSecretConfiguration(externalSystemSlug);
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
async function gatherSnapInProjectConfiguration(): Promise<AirdropProjectConfig & { 
  projectName?: string; 
  projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
  snapInBaseName?: string; 
  selectedSnapInTemplateName?: string; 
}> {
  const initConf = getInitConfig();

  // Template selection
  const { selectedSnapInTemplateName } = await prompts({
    type: "select",
    name: "selectedSnapInTemplateName",
    message: "Choose a Snap-in template:",
    choices: initConf.snapInTemplates.map(template => ({
      title: `${template.name} - ${template.description || "No description"}`,
      value: template.name,
    })),
    initial: 0,
  });

  // Snap-in base name
  const { snapInBaseName } = await prompts({
    type: "text",
    name: "snapInBaseName",
    message: "Enter a base name for your Snap-in:",
    initial: "my-snapin",
    validate: (value) => value.trim().length > 0 || "Snap-in name is required",
  });

  const projectName = generateAirdropSnapInFolderName(snapInBaseName);

  // Use default config for snap-in
  const defaultConfig = createDefaultAirdropConfig('snap-in');

  const config: AirdropProjectConfig & { 
    projectName?: string; 
    projectTypeFromPrompt?: 'airdrop' | 'snap-in'; 
    snapInBaseName?: string; 
    selectedSnapInTemplateName?: string; 
  } = {
    ...defaultConfig,
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
async function gatherOAuth2Configuration(systemSlug: string): Promise<OAuth2Connection> {
  const clientIdEnvVar = `${systemSlug.toUpperCase().replace(/-/g, "_")}_CLIENT_ID`;
  const clientSecretEnvVar = `${systemSlug.toUpperCase().replace(/-/g, "_")}_CLIENT_SECRET`;

  const { clientIdEnvVarName } = await prompts({
    type: "text",
    name: "clientIdEnvVarName",
    message: "Environment variable name for OAuth client ID:",
    initial: clientIdEnvVar,
    validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
  });

  const { clientSecretEnvVarName } = await prompts({
    type: "text",
    name: "clientSecretEnvVarName",
    message: "Environment variable name for OAuth client secret:",
    initial: clientSecretEnvVar,
    validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
  });

  const { authorizationUrl } = await prompts({
    type: "text",
    name: "authorizationUrl",
    message: "OAuth authorization URL:",
    initial: "https://api.example.com/v1/oauth/authorize",
    validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
  });

  const { tokenUrl } = await prompts({
    type: "text",
    name: "tokenUrl",
    message: "OAuth token URL:",
    initial: "https://api.example.com/v1/oauth/token",
    validate: (value) => /^https?:\/\/.+/.test(value) || "Must be a valid URL",
  });

  const { scope } = await prompts({
    type: "text",
    name: "scope",
    message: "OAuth scope (space-separated):",
    initial: "read write api",
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
async function gatherSecretConfiguration(systemSlug: string): Promise<SecretConnection> {
  const tokenEnvVar = `${systemSlug.toUpperCase().replace(/-/g, "_")}_TOKEN`;

  const { tokenEnvVarName } = await prompts({
    type: "text",
    name: "tokenEnvVarName",
    message: "Environment variable name for API token:",
    initial: tokenEnvVar,
    validate: (value) => /^[A-Z_][A-Z0-9_]*$/.test(value) || "Must be a valid environment variable name",
  });

  return {
    type: "secret",
    id: `${systemSlug}-secret`,
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
    tokenEnvVarName,
  };
} 