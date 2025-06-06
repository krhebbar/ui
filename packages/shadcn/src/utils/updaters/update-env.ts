import path from "path";
import fs from "fs-extra";
import { AirdropProjectConfig, OAuth2Connection, SecretConnection } from "../../types/snapin-config";
import { logger } from "../logger";

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface UpdateOptions {
  force?: boolean;
  createIfMissing?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

// =============================================================================
// Environment File Operations
// =============================================================================

/**
 * Update or create .env file with environment variables
 * 
 * @param cwd - Working directory path
 * @param envVars - Record of environment variables to add/update
 * @param options - Update options for behavior control
 * 
 * Input: Directory path, environment variables, options
 * Output: Updated .env file (idempotent operation)
 */
export async function updateEnvFile(
  cwd: string, 
  envVars: Record<string, string>,
  options: UpdateOptions = {}
): Promise<void> {
  if (Object.keys(envVars).length === 0) {
    return;
  }

  const envFilePath = path.join(cwd, ".env");
  let existingContent = "";

  try {
    existingContent = await fs.readFile(envFilePath, "utf8");
  } catch {
    // File doesn't exist, will create new one
    if (!options.createIfMissing) {
      logger.warn(`${envFilePath} does not exist and createIfMissing is false`);
      return;
    }
  }

  const existingVars: Record<string, string> = {};
  const lines = existingContent.split("\n");

  // Parse existing variables
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key) {
        existingVars[key.trim()] = valueParts.join("=").trim();
      }
    }
  });

  // Add new variables that don't exist (idempotent)
  let hasChanges = false;
  for (const [key, value] of Object.entries(envVars)) {
    if (!(key in existingVars) || options.force) {
      existingVars[key] = value;
      hasChanges = true;
    }
  }

  // Always add default DevRev variables if not present
  if (!("DEVREV_PAT" in existingVars)) {
    existingVars["DEVREV_PAT"] = "your-devrev-pat-here";
    hasChanges = true;
  }
  if (!("DEVREV_ORG" in existingVars)) {
    existingVars["DEVREV_ORG"] = "your-devrev-org-slug-here";
    hasChanges = true;
  }

  if (hasChanges) {
    // Generate new content
    const newContent = Object.entries(existingVars)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    await fs.writeFile(envFilePath, newContent);
    logger.info(`Environment variables updated in ${envFilePath}`);
  }
}

/**
 * Validate environment file and check for placeholder values
 * 
 * @param cwd - Working directory path
 * @param config - Project configuration for connection-specific validation
 * @param requiredVars - Custom names for DevRev environment variables
 * 
 * Input: Directory path, project config, required variable names
 * Output: Validation result with warnings and errors
 */
export async function validateEnvFile(
  cwd: string,
  config: AirdropProjectConfig,
  requiredVars: { pat?: string; org?: string } = {}
): Promise<ValidationResult> {
  const envFilePath = path.join(cwd, ".env");
  const result: ValidationResult = {
    isValid: true,
    warnings: [],
    errors: []
  };

  let envContent = "";
  try {
    envContent = await fs.readFile(envFilePath, "utf8");
  } catch {
    result.errors.push("Environment file (.env) not found");
    result.isValid = false;
    return result;
  }

  const envValues: Record<string, string> = {};
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        envValues[key.trim()] = valueParts.join("=").trim();
      } else if (key) {
        envValues[key.trim()] = "";
      }
    }
  });

  const patEnvVarName = requiredVars.pat || "DEVREV_PAT";
  const orgEnvVarName = requiredVars.org || "DEVREV_ORG";

  // Check required DevRev variables
  if (!envValues[patEnvVarName] || 
      envValues[patEnvVarName] === "your-devrev-pat-here" || 
      envValues[patEnvVarName] === "") {
    result.warnings.push(`${patEnvVarName} is missing or has a placeholder value`);
  }

  if (!envValues[orgEnvVarName] || 
      envValues[orgEnvVarName] === "your-devrev-org-slug-here" || 
      envValues[orgEnvVarName] === "") {
    result.warnings.push(`${orgEnvVarName} is missing or has a placeholder value`);
  }

  // Check connection-specific variables
  if (config.connection?.type === "oauth2") {
    const oauthConnection = config.connection;
    if (typeof oauthConnection.clientId === 'string') {
      const clientIdMatch = oauthConnection.clientId.match(/process\.env\.([A-Z_0-9]+)/);
      if (clientIdMatch?.[1]) {
        const clientIdEnvVar = clientIdMatch[1];
        if (!envValues[clientIdEnvVar] || 
            envValues[clientIdEnvVar] === "your-client-id-here" || 
            envValues[clientIdEnvVar] === "") {
          result.warnings.push(`${clientIdEnvVar} (OAuth Client ID) is missing or has a placeholder value`);
        }
      }
    }
    if (typeof oauthConnection.clientSecret === 'string') {
      const clientSecretMatch = oauthConnection.clientSecret.match(/process\.env\.([A-Z_0-9]+)/);
      if (clientSecretMatch?.[1]) {
        const clientSecretEnvVar = clientSecretMatch[1];
        if (!envValues[clientSecretEnvVar] || 
            envValues[clientSecretEnvVar] === "your-client-secret-here" || 
            envValues[clientSecretEnvVar] === "") {
          result.warnings.push(`${clientSecretEnvVar} (OAuth Client Secret) is missing or has a placeholder value`);
        }
      }
    }
  } else if (config.connection?.type === "secret") {
    const secretConnection = config.connection as SecretConnection;
    if (secretConnection.tokenEnvVarName) {
      const tokenEnvVar = secretConnection.tokenEnvVarName;
      if (!envValues[tokenEnvVar] || 
          envValues[tokenEnvVar] === "your-api-token-here" || 
          envValues[tokenEnvVar] === "") {
        result.warnings.push(`${tokenEnvVar} (API Token) is missing or has a placeholder value`);
      }
    }
  }

  return result;
}

/**
 * Extract environment variables from project configuration
 * 
 * @param config - Project configuration
 * 
 * Input: Project configuration object
 * Output: Record of environment variable names to placeholder values
 */
export function extractEnvVarsFromConfig(config: AirdropProjectConfig): Record<string, string> {
  const envVars: Record<string, string> = {};

  if (config.connection?.type === "oauth2") {
    const oauthConnection = config.connection;
    if (typeof oauthConnection.clientId === 'string') {
      const clientIdMatch = oauthConnection.clientId.match(/process\.env\.([A-Z_0-9]+)/);
      if (clientIdMatch?.[1]) {
        envVars[clientIdMatch[1]] = "your-client-id-here";
      }
    }
    if (typeof oauthConnection.clientSecret === 'string') {
      const clientSecretMatch = oauthConnection.clientSecret.match(/process\.env\.([A-Z_0-9]+)/);
      if (clientSecretMatch?.[1]) {
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