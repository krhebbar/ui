import path from "path";
import fs from "fs-extra";
import { AirdropProjectConfig, OAuth2Connection, SecretConnection } from "../../types/airdrop-config";
import { logger } from "../../utils/logger";

/**
 * Update or create .env file with environment variables
 */
export async function updateEnvFile(cwd: string, envVars: Record<string, string>): Promise<void> {
  if (Object.keys(envVars).length === 0) {
    return;
  }

  const envFilePath = path.join(cwd, ".env");
  let existingContent = "";

  try {
    existingContent = await fs.readFile(envFilePath, "utf8");
  } catch {
    // File doesn't exist, will create new one
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

  // Add new variables that don't exist
  let hasChanges = false;
  for (const [key, value] of Object.entries(envVars)) {
    if (!(key in existingVars)) {
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
    logger.info(`Environment variables written to ${envFilePath}`);
  }
}

/**
 * Validate environment variables and show placeholder warnings
 */
export async function validateAndWarnEnvVars(
  cwd: string,
  config: AirdropProjectConfig,
  devrevPatEnvVarName?: string,
  devrevOrgEnvVarName?: string
): Promise<void> {
  const envFilePath = path.join(cwd, ".env");
  let finalEnvContent = "";
  
  try {
    finalEnvContent = await fs.readFile(envFilePath, "utf8");
  } catch {
    // .env file might not exist
    return;
  }

  const finalEnvValues: Record<string, string> = {};
  finalEnvContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        finalEnvValues[key.trim()] = valueParts.join("=").trim();
      } else if (key) {
        finalEnvValues[key.trim()] = ""; // Handle empty values
      }
    }
  });

  const patEnvVarName = devrevPatEnvVarName || "DEVREV_PAT";
  const orgEnvVarName = devrevOrgEnvVarName || "DEVREV_ORG";

  const placeholderMessages: string[] = [];

  // Check PAT variable
  if (finalEnvValues[patEnvVarName] === undefined || 
      finalEnvValues[patEnvVarName] === "your-devrev-pat-here" || 
      finalEnvValues[patEnvVarName] === "") {
    placeholderMessages.push(`- ${patEnvVarName} is missing or has a placeholder value.`);
  }

  // Check Org variable
  if (finalEnvValues[orgEnvVarName] === undefined || 
      finalEnvValues[orgEnvVarName] === "your-devrev-org-slug-here" || 
      finalEnvValues[orgEnvVarName] === "") {
    placeholderMessages.push(`- ${orgEnvVarName} is missing or has a placeholder value.`);
  }

  // Add check for OAuth variables if connection is OAuth2
  if (config.connection?.type === "oauth2") {
    const oauthConnection = config.connection;
    if (typeof oauthConnection.clientId === 'string') {
      const clientIdMatch = oauthConnection.clientId.match(/process\.env\.([A-Z_0-9]+)/);
      if (clientIdMatch && clientIdMatch[1]) {
        const clientIdEnvVar = clientIdMatch[1];
        if (finalEnvValues[clientIdEnvVar] === undefined || 
            finalEnvValues[clientIdEnvVar] === "your-client-id-here" || 
            finalEnvValues[clientIdEnvVar] === "") {
          placeholderMessages.push(`- ${clientIdEnvVar} (OAuth Client ID) is missing or has a placeholder value.`);
        }
      }
    }
    if (typeof oauthConnection.clientSecret === 'string') {
      const clientSecretMatch = oauthConnection.clientSecret.match(/process\.env\.([A-Z_0-9]+)/);
      if (clientSecretMatch && clientSecretMatch[1]) {
        const clientSecretEnvVar = clientSecretMatch[1];
        if (finalEnvValues[clientSecretEnvVar] === undefined || 
            finalEnvValues[clientSecretEnvVar] === "your-client-secret-here" || 
            finalEnvValues[clientSecretEnvVar] === "") {
          placeholderMessages.push(`- ${clientSecretEnvVar} (OAuth Client Secret) is missing or has a placeholder value.`);
        }
      }
    }
  } else if (config.connection?.type === "secret") {
    const secretConnection = config.connection as SecretConnection;
    if (secretConnection.tokenEnvVarName) {
      const tokenEnvVar = secretConnection.tokenEnvVarName;
      if (finalEnvValues[tokenEnvVar] === undefined || 
          finalEnvValues[tokenEnvVar] === "your-api-token-here" || 
          finalEnvValues[tokenEnvVar] === "") {
        placeholderMessages.push(`- ${tokenEnvVar} (API Token) is missing or has a placeholder value.`);
      }
    }
  }

  if (placeholderMessages.length > 0) {
    logger.warn("\nPlease update the following placeholder values in your .env file:");
    placeholderMessages.forEach(msg => logger.warn(msg));
    logger.break();
  }
} 