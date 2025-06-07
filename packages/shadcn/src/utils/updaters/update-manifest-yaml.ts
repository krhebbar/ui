import path from "path";
import fs from "fs-extra";
import yaml from "yaml";
import { AirdropProjectConfig } from "../../types/snapin-config";
import { logger } from "../logger";
import { toKebabCase } from "../naming";

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface UpdateOptions {
  force?: boolean;
  createIfMissing?: boolean;
}

// =============================================================================
// Manifest File Operations
// =============================================================================

/**
 * Update or create manifest.yaml file with project configuration
 * 
 * @param cwd - Working directory path
 * @param config - Project configuration object
 * @param options - Update options for behavior control
 * 
 * Input: Directory path, project configuration, options
 * Output: Updated manifest.yaml file (idempotent operation)
 */
export async function updateManifestFile(
  cwd: string,
  config: AirdropProjectConfig,
  options: UpdateOptions = {}
): Promise<void> {
  const manifestPath = await findManifestFile(cwd);
  
  if (!manifestPath) {
    if (options.createIfMissing) {
      await createManifestFile(cwd, config);
    } else {
      logger.warn("No manifest file found and createIfMissing is false");
    }
    return;
  }

  try {
    const existingContent = await fs.readFile(manifestPath, "utf8");
    
    // Perform surgical updates - modify only specific fields while preserving everything else
    const updatedContent = applySurgicalUpdates(existingContent, config);
    
    // Check if there are actual changes to avoid unnecessary writes
    const hasChanges = existingContent !== updatedContent;
    
    if (hasChanges || options.force) {
      await fs.writeFile(manifestPath, updatedContent, "utf8");
      logger.info(`Manifest updated at ${manifestPath} (preserving comments and formatting)`);
    } else {
      logger.info("Manifest is already up to date");
    }
  } catch (error) {
    logger.warn(`Failed to update existing manifest: ${error}. Keeping original.`);
  }
}

/**
 * Create a new manifest file with basic project structure
 * 
 * @param cwd - Working directory path
 * @param config - Project configuration object
 * 
 * Input: Directory path, project configuration
 * Output: New manifest.yaml file created
 */
async function createManifestFile(cwd: string, config: AirdropProjectConfig): Promise<void> {
  const basicManifest = generateBasicManifest(config);
  const newManifestPath = path.join(cwd, "manifest.yaml");
  await fs.writeFile(newManifestPath, basicManifest, "utf8");
  logger.info(`Created new manifest at ${newManifestPath}`);
}

/**
 * Find existing manifest file (supports both .yml and .yaml extensions)
 * 
 * @param cwd - Working directory path
 * 
 * Input: Directory path
 * Output: Path to manifest file or null if not found
 */
async function findManifestFile(cwd: string): Promise<string | null> {
  const manifestPath = path.join(cwd, "manifest.yaml");
  if (await fs.pathExists(manifestPath)) {
    return manifestPath;
  } 
  return null;
}



/**
 * Apply surgical updates to manifest content - preserves comments, formatting, and structure
 * 
 * @param manifestContent - Raw manifest file content as string
 * @param config - Project configuration object
 * 
 * Input: Raw manifest content, project configuration
 * Output: Updated manifest content with only targeted changes
 */
function applySurgicalUpdates(manifestContent: string, config: AirdropProjectConfig): string {
  let updatedContent = manifestContent;
  const systemName = config.externalSystem?.name || 'External System';
  const systemSlug = config.externalSystem?.slug || 'my-snapin';
  const connectionId = toKebabCase(systemName) + '-connection';
  
  // 0. Clean up incorrectly inserted entries first
  // Remove the "- id: example-pat-connection" and its associated content
  updatedContent = updatedContent.replace(
    /\s*-\s*id:\s*example-pat-connection[\s\S]*?(?=\n\S|\n*$)/,
    ''
  );
  
  // 1. Update name field (only if different)
  if (config.externalSystem?.slug) {
    updatedContent = updateYamlField(updatedContent, 'name', config.externalSystem.slug.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()));
  }
  
  // 2. Update description field (smart replacement)
  if (config.externalSystem?.name) {
    const newDescription = config.projectType === 'airdrop' 
      ? `An Airdrop snap-in for syncing data between ${systemName} and DevRev`
      : `${systemName} integration created with DevRev CLI`;
    
    // Only update if current description contains placeholders or is generic
    const currentDescription = extractYamlFieldValue(updatedContent, 'description');
    if (!currentDescription || 
        currentDescription.includes('Todo') || 
        currentDescription.includes('DevRev CLI') ||
        currentDescription.includes('Integration created')) {
      updatedContent = updateYamlField(updatedContent, 'description', newDescription);
    }
  }
  
  // 3. Replace "Todo" in function descriptions (only within functions section)
  if (config.externalSystem?.name) {
    // Find the functions section and update only within it
    const functionsRegex = /(functions:\s*\n)((?:\s+-[\s\S]*?)*)(?=\n[a-zA-Z_][a-zA-Z0-9_]*:|$)/;
    const functionsMatch = updatedContent.match(functionsRegex);
    
    if (functionsMatch) {
      const functionsContent = functionsMatch[2];
      const updatedFunctionsContent = functionsContent.replace(
        /(description:\s*["']?)[^"'\n]*Todo[^"'\n]*(["']?)/g,
        (match, prefix, suffix) => {
          if (config.projectType === 'airdrop') {
            return `${prefix}Airdrop extraction function for ${systemName}${suffix}`;
          } else {
            return `${prefix}Example function for ${systemName}${suffix}`;
          }
        }
      );
      
      updatedContent = updatedContent.replace(functionsMatch[0], functionsMatch[1] + updatedFunctionsContent);
    }
  }
  
  // 4. Fix any corruption in service_account.display_name first
  if (config.externalSystem?.name) {
    // Fix corrupted patterns like "Gong"ng Bot" -> "Gong Bot"
    updatedContent = updatedContent.replace(
      /(display_name:\s*)(["']?)([^"'\n]*"ng Bot[^"'\n]*)(["']?)/g,
      `$1$2${systemName} Bot$4`
    );
    
    // Then update service_account.display_name if it exists with template text
    const serviceAccountMatch = updatedContent.match(/service_account:\s*\n/);
    if (serviceAccountMatch) {
      updatedContent = updateYamlNestedField(
        updatedContent, 
        'service_account', 
        'display_name', 
        `${systemName} Bot`
      );
    }
  }
  
  // 5. Smart keyring_types updates (only if section exists)
  if (config.externalSystem?.connection && config.externalSystem && updatedContent.includes('keyring_types:')) {
    updatedContent = updateKeyringTypes(updatedContent, config, connectionId);
  }
  
  // 6. Smart imports updates (only for airdrop projects and if section exists)
  if (config.projectType === 'airdrop' && 
      config.externalSystem && 
      updatedContent.includes('imports:')) {
    updatedContent = updateImportsSection(updatedContent, config, connectionId);
  }
  
  return updatedContent;
}

/**
 * Update a simple YAML field value while preserving formatting
 */
function updateYamlField(content: string, fieldName: string, newValue: string): string {
  // Escape special regex characters in fieldName
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // More precise regex that handles quotes and preserves existing formatting
  const regex = new RegExp(`(^${escapedFieldName}:\\s*)(["']?)([^"'\\n\\r]*)(\\2)`, 'm');
  const match = content.match(regex);
  
  if (match) {
    // Only replace if the current value contains template placeholders
    const currentValue = match[3];
    if (currentValue.includes('Todo') || currentValue.includes('DevRev CLI') || currentValue.includes('Example') || currentValue === '') {
      const quote = match[2] || '"';
      return content.replace(regex, `$1${quote}${newValue}${quote}`);
    }
  }
  
  return content;
}

/**
 * Extract a YAML field value for comparison
 */
function extractYamlFieldValue(content: string, fieldName: string): string | null {
  const regex = new RegExp(`${fieldName}:\\s*["']?([^"'\\n]+)["']?`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Update a nested YAML field (e.g., service_account.display_name)
 */
function updateYamlNestedField(content: string, parentField: string, childField: string, newValue: string): string {
  // Escape special regex characters
  const escapedParentField = parentField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedChildField = childField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const parentRegex = new RegExp(`(${escapedParentField}:\\s*\\n)((?:\\s{2,}[^\\n]*\\n)*)`, 'g');
  
  return content.replace(parentRegex, (match, parentPrefix, childrenContent) => {
    const childRegex = new RegExp(`(\\s+${escapedChildField}:\\s*)(["']?)([^"'\\n]*)(\\2)`);
    const childMatch = childrenContent.match(childRegex);
    
    if (childMatch) {
      // Only update if the current value contains template placeholders or corrupted text
      const currentValue = childMatch[3];
      if (currentValue.includes('Todo') || currentValue.includes('DevRev CLI') || currentValue.includes('"ng Bot"') || currentValue === '') {
        const quote = childMatch[2] || '"';
        const updatedChildren = childrenContent.replace(childRegex, `$1${quote}${newValue}${quote}`);
        return parentPrefix + updatedChildren;
      }
    } else {
      // Add new field with proper indentation
      const indentation = childrenContent.match(/^(\s+)/)?.[1] || '  ';
      return parentPrefix + childrenContent + `${indentation}${childField}: "${newValue}"\n`;
    }
    
    return match; // No changes needed
  });
}

/**
 * Update keyring_types section with correct structure based on connection type
 */
function updateKeyringTypes(content: string, config: AirdropProjectConfig, connectionId: string): string {
  // Generate the complete keyring_types block based on connection type
  const newKeyringTypesBlock = generateKeyringTypesBlock(config, connectionId);
  
  // Check if keyring_types section already exists
  const keyringTypesRegex = /(keyring_types:\s*(?:#[^\n]*\n)?)((?:\s+[^\n]*\n)*?)(?=\n[a-zA-Z_][a-zA-Z0-9_]*:\s|\n*$)/;
  const match = content.match(keyringTypesRegex);
  
  if (match) {
    // Replace only the keyring_types content, preserving the header  
    const beforeKeyring = content.substring(0, match.index!);
    const afterKeyring = content.substring(match.index! + match[0].length);
    
    return beforeKeyring + 'keyring_types:\n' + newKeyringTypesBlock + '\n' + afterKeyring;
  }
  
  // If keyring_types section doesn't exist, add it before imports section if it exists
  const importsIndex = content.indexOf('\nimports:');
  if (importsIndex !== -1) {
    const beforeImports = content.substring(0, importsIndex);
    const afterImports = content.substring(importsIndex);
    return beforeImports + '\nkeyring_types:\n' + newKeyringTypesBlock + afterImports;
  }
  
  // Otherwise add at the end
  return content + '\nkeyring_types:\n' + newKeyringTypesBlock;
}

/**
 * Generate complete keyring_types block based on connection configuration
 */
function generateKeyringTypesBlock(config: AirdropProjectConfig, connectionId: string): string {
  const systemName = config.externalSystem?.name || 'External System';
  const connectionType = config.externalSystem?.connection?.type || 'secret';
  const systemSlug = toKebabCase(systemName);
  
  if (connectionType === 'oauth2') {
    return generateOAuth2KeyringBlock(config, connectionId, systemName, systemSlug);
  } else {
    return generateSecretKeyringBlock(config, connectionId, systemName, systemSlug);
  }
}

/**
 * Generate OAuth2 keyring_types block
 */
function generateOAuth2KeyringBlock(config: AirdropProjectConfig, connectionId: string, systemName: string, systemSlug: string): string {
  const connection = config.externalSystem?.connection as any; // OAuth2Connection type
  const authUrl = connection.authorize?.url || `https://${systemSlug}.com/oauth/authorize`;
  const tokenUrl = connection.authorize?.tokenUrl || `https://${systemSlug}.com/oauth/token`;
  const scope = connection.authorize?.scope || 'read_api api';
  const scopeDelimiter = connection.authorize?.scopeDelimiter || ' ';
  
  return `  - id: ${connectionId}
    name: ${systemName} Connection
    description: ${systemName} connection
    kind: "Oauth2"
    scopes: # Scopes that the connection can request, add more scopes if needed for your use case
      - name: read
        description: Read access
        value: "read_api"
      - name: api
        description: API access
        value: "api"
    scope_delimiter: "${scopeDelimiter}" # Space separated scopes
    oauth_secret: ${systemSlug}-oauth-secret # developer keyring that contains OAuth2 client ID and client secret
    authorize: # The authorize section is used to get the authorization code from the user and exchange it for an access token
      type: "config"
      auth_url: "${authUrl}"
      token_url: "${tokenUrl}"
      grant_type: "authorization_code"
      auth_query_parameters:
        "client_id": "[CLIENT_ID]"
        "scope": "[SCOPES]"
        "response_type": "code"
      token_query_parameters:
        "client_id": "[CLIENT_ID]"
        "client_secret": "[CLIENT_SECRET]"
    refresh: # The refresh section is used to refresh the access token using the refresh token
      type: "config"
      url: "${tokenUrl}"
      method: "POST"
      query_parameters:
        "client_id": "[CLIENT_ID]"
        "client_secret": "[CLIENT_SECRET]"
        "refresh_token": "[REFRESH_TOKEN]"
      headers:
        "Content-type": "application/x-www-form-urlencoded"
    revoke: # The revoke section is used to revoke the access token
      type: "config"
      url: "${authUrl.replace('/authorize', '/revoke')}"
      method: "POST"
      headers:
        "Content-type": "application/x-www-form-urlencoded"
      query_parameters:
        "client_id": "[CLIENT_ID]"
        "client_secret": "[CLIENT_SECRET]"
        "token": "[ACCESS_TOKEN]"`;
}

/**
 * Generate Secret keyring_types block
 */
function generateSecretKeyringBlock(config: AirdropProjectConfig, connectionId: string, systemName: string, systemSlug: string): string {
  const connection = config.externalSystem?.connection as any; // SecretConnection type
  const secretTransform = connection.secretTransform || 'Bearer {token}';
  const testEndpoint = `https://api.${systemSlug}.com/v1/me`;
  const isSubdomain = config.externalSystem?.apiBaseUrl?.includes('[SUBDOMAIN]') || false;
  
  // Extract the base64 encoding pattern if it exists
  const isBase64Transform = secretTransform.includes('@base64');
  const transformPattern = isBase64Transform ? '".token+":X" | @base64' : '"Bearer " + .token';
  
  return `  - id: ${connectionId}
    name: ${systemName} Connection
    description: ${systemName} connection
    kind: "Secret"${isSubdomain ? '\n    is_subdomain: true # The is_subdomain field is used to indicate that the subdomain is part of the URL' : ''}
    secret_config: # The secret_config section is used to define the fields in the secret
      secret_transform: ${transformPattern} # Transform data from input fields into the secret value
      fields: # Data that the user shall provide in the input form when creating the connection
        - id: token
          name: Token
          description: ${systemName} API token
      token_verification: # The token_verification section is used to verify the token provided by the user
        url: "${testEndpoint}"
        method: "GET"
        headers:
          Authorization: "${secretTransform.replace('{token}', '[API_KEY]')}"`;
}

/**
 * Generate imports block with correct configuration
 */
function generateImportsBlock(config: AirdropProjectConfig, connectionId: string): string {
  const systemName = config.externalSystem?.name || 'External System';
  const systemSlug = config.externalSystem?.slug || 'my-snapin';
  
  return `  - slug: ${systemSlug}
    display_name: ${systemName}
    description: Import data from ${systemName} using Airdrop
    extractor_function: extraction
    # TODO: Uncomment the loader function once you have implemented loading.
    #loader_function: loading
    allowed_connection_types:
      - ${connectionId}`;
}

/**
 * Update imports section using templating approach (like keyring_types)
 */
function updateImportsSection(content: string, config: AirdropProjectConfig, connectionId: string): string {
  const systemName = config.externalSystem?.name || 'External System';
  const systemSlug = config.externalSystem?.slug || 'my-snapin';
  
  // Generate the complete imports block
  const newImportsBlock = generateImportsBlock(config, connectionId);
  
  // Find and replace the entire imports section while preserving comments
  const importsRegex = /(imports:\s*(?:#[^\n]*\n)?)((?:\s+[^\n]*\n)*?)(?=\n[a-zA-Z_][a-zA-Z0-9_]*:\s|\n*$)/;
  const match = content.match(importsRegex);
  
  if (match) {
    // Replace only the imports content, preserving the header and comments
    const beforeImports = content.substring(0, match.index!);
    const afterImports = content.substring(match.index! + match[0].length);
    
    return beforeImports + match[1] + newImportsBlock + '\n' + afterImports;
  }
  
  // If imports section doesn't exist, add it at the end
  return content + '\nimports:\n' + newImportsBlock;
}

/**
 * Generate basic manifest content based on project configuration
 * 
 * @param config - Project configuration object
 * 
 * Input: Project configuration
 * Output: Manifest YAML content string
 */
function generateBasicManifest(config: AirdropProjectConfig): string {
  const systemName = config.externalSystem?.name || 'External System';
  const systemSlug = config.externalSystem?.slug || 'my-snapin';
  const connectionId = toKebabCase(systemName) + '-connection';
  
  // Create a basic manifest structure with placeholder content
  const baseManifestContent = `version: "2"
name: "my-snapin"
description: "Integration created with DevRev CLI"

app:
  - name: main

functions:
  - name: ${config.projectType === 'airdrop' ? 'extraction' : 'example_function'}
    description: "${config.projectType === 'airdrop' ? 'Airdrop extraction function for Todo' : 'Example function'}"
`;

  // Apply surgical updates to replace placeholders with actual values
  const updatedManifest = applySurgicalUpdates(baseManifestContent, config);
  
  return updatedManifest;
} 