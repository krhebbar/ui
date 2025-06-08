import { Command } from "commander";
import { z } from "zod";
import axios from "axios";
import { readFile, access } from "fs/promises";
import { join } from "path";
import { constants } from "fs";
import { logger } from "../utils/logger";
import { spinner } from "../utils/spinner";
// Dynamic imports to avoid heavy dependencies
// import { getProjectInfo } from "../utils/get-project-info";
// import { readExistingSnapinConfig } from "../utils/project-config";

// =============================================================================
// Lightweight Helper Functions
// =============================================================================

/**
 * Check if current directory is a valid airdrop project
 */
async function isValidAirdropProject(cwd: string): Promise<boolean> {
  const snapinConfigPath = join(cwd, "snapin.config.mjs");
  const manifestPath = join(cwd, "manifest.yaml");
  
  try {
    await access(snapinConfigPath, constants.F_OK);
    return true;
  } catch {
    try {
      await access(manifestPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Read snapin config file dynamically
 */
async function readSnapinConfigFile(cwd: string): Promise<any> {
  const snapinConfigPath = join(cwd, "snapin.config.mjs");
  
  try {
    await access(snapinConfigPath, constants.F_OK);
  } catch {
    return null;
  }

  try {
    // Use dynamic import to load the config
    const configModule = await import(snapinConfigPath);
    return configModule.default || configModule;
  } catch (error) {
    console.error(`Failed to load snapin.config.mjs: ${error}`);
    return null;
  }
}

// =============================================================================
// Types and Schemas
// =============================================================================

const connectionTypeSchema = z.enum(["oauth2", "secret"]);
type ConnectionType = z.infer<typeof connectionTypeSchema>;

interface OAuth2Credentials {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  authUrl?: string;
  scopes: string;
}

interface SecretCredentials {
  apiKey?: string;
  token?: string;
  [key: string]: string | undefined;
}

interface TestConnectionOptions {
  type: ConnectionType;
  verbose?: boolean;
  cwd?: string;
}

interface ConnectionTestResult {
  success: boolean;
  statusCode?: number;
  message: string;
  responseData?: any;
  error?: any;
}

// =============================================================================
// OAuth2 Connection Testing
// =============================================================================

/**
 * Test OAuth2 connection using client credentials flow
 */
async function testOAuth2Connection(
  credentials: OAuth2Credentials,
  testApiUrl: string,
  customHeaders: Record<string, string> = {},
  verbose: boolean = false
): Promise<ConnectionTestResult> {
  try {
    // Import simple-oauth2 dynamically
    const { ClientCredentials } = await import("simple-oauth2");

    const config = {
      client: {
        id: credentials.clientId,
        secret: credentials.clientSecret,
      },
      auth: {
        tokenHost: new URL(credentials.tokenUrl).origin,
        tokenPath: new URL(credentials.tokenUrl).pathname,
      },
    };

    logger.info("🔐 Attempting OAuth2 authentication...");
    
    const client = new ClientCredentials(config);
    
    // Get access token using client credentials
    const tokenParams = {
      scope: credentials.scopes,
    };

    const accessToken = await client.getToken(tokenParams);
    
    if (!accessToken.token.access_token) {
      return {
        success: false,
        message: "Failed to obtain access token from OAuth2 provider",
        error: "No access token in response"
      };
    }

    logger.success("✅ OAuth2 token obtained successfully");

    // Test the API with the token
    logger.info(`🧪 Testing API endpoint: ${testApiUrl}`);
    
    // Merge custom headers with default headers
    const headers = {
      'Authorization': `Bearer ${accessToken.token.access_token}`,
      'Content-Type': 'application/json',
      ...customHeaders, // Custom headers override defaults
    };

    if (verbose && Object.keys(customHeaders).length > 0) {
      logger.info(`🔧 Using custom headers: ${JSON.stringify(customHeaders, null, 2)}`);
    }
    
    const response = await axios.get(testApiUrl, {
      headers,
      timeout: 10000,
    });

    return {
      success: true,
      statusCode: response.status,
      message: `OAuth2 connection successful (${response.status} ${response.statusText})`,
      responseData: verbose ? response.data : undefined,
    };

  } catch (error: any) {
    let errorMessage = "OAuth2 connection failed";
    let statusCode: number | undefined;

    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `OAuth2 API call failed (${error.response.status} ${error.response.statusText})`;
    } else if (error.message?.includes("getaddrinfo ENOTFOUND")) {
      errorMessage = "OAuth2 connection failed - hostname not found (check URLs in config)";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "OAuth2 connection failed - connection refused (check if service is running)";
    } else if (error.message) {
      errorMessage = `OAuth2 connection failed - ${error.message}`;
    }

    return {
      success: false,
      statusCode,
      message: errorMessage,
      error: verbose ? error : error.message,
    };
  }
}

// =============================================================================
// Secret-Based Connection Testing
// =============================================================================

/**
 * Test secret-based connection using API key or token
 */
async function testSecretConnection(
  credentials: SecretCredentials,
  testApiUrl: string,
  secretTransform: string = "Bearer {token}",
  customHeaders: Record<string, string> = {},
  verbose: boolean = false
): Promise<ConnectionTestResult> {
  try {
    // Determine which credential to use
    let authValue: string;
    
    if (credentials.token) {
      authValue = secretTransform.replace("{token}", credentials.token);
    } else if (credentials.apiKey) {
      authValue = secretTransform.replace("{token}", credentials.apiKey);
    } else {
      // Try to find any credential that might work
      const credentialKeys = Object.keys(credentials).filter(key => credentials[key]);
      if (credentialKeys.length === 0) {
        return {
          success: false,
          message: "No valid credentials found in environment variables",
        };
      }
      
      const firstCredential = credentials[credentialKeys[0]]!;
      authValue = secretTransform.replace("{token}", firstCredential);
    }

    logger.info(`🧪 Testing API endpoint: ${testApiUrl}`);
    
    // Merge custom headers with default headers
    const headers = {
      'Authorization': authValue,
      'Content-Type': 'application/json',
      ...customHeaders, // Custom headers override defaults
    };

    if (verbose && Object.keys(customHeaders).length > 0) {
      logger.info(`🔧 Using custom headers: ${JSON.stringify(customHeaders, null, 2)}`);
    }

    const response = await axios.get(testApiUrl, {
      headers,
      timeout: 10000,
    });

    return {
      success: true,
      statusCode: response.status,
      message: `Secret-based connection successful (${response.status} ${response.statusText})`,
      responseData: verbose ? response.data : undefined,
    };

  } catch (error: any) {
    let errorMessage = "Secret-based connection failed";
    let statusCode: number | undefined;

    if (error.response) {
      statusCode = error.response.status;
      if (error.response.status === 401) {
        errorMessage = "Secret-based connection failed - unauthorized (check your API key/token)";
      } else if (error.response.status === 403) {
        errorMessage = "Secret-based connection failed - forbidden (check permissions)";
      } else {
        errorMessage = `Secret-based connection failed (${error.response.status} ${error.response.statusText})`;
      }
    } else if (error.message?.includes("getaddrinfo ENOTFOUND")) {
      errorMessage = "Secret-based connection failed - hostname not found (check API URL in config)";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "Secret-based connection failed - connection refused (check if service is running)";
    } else if (error.message) {
      errorMessage = `Secret-based connection failed - ${error.message}`;
    }

    return {
      success: false,
      statusCode,
      message: errorMessage,
      error: verbose ? error : error.message,
    };
  }
} // =============================================================================
// Configuration Loading
// =============================================================================

/**
 * Load OAuth2 credentials from environment variables
 */
function loadOAuth2Credentials(envVars: Record<string, string>): OAuth2Credentials | null {
  // Try common OAuth2 environment variable patterns
  const patterns = [
    { clientId: "CLIENT_ID", clientSecret: "CLIENT_SECRET", tokenUrl: "TOKEN_URL", authUrl: "AUTH_URL", scopes: "SCOPES" },
    { clientId: "OAUTH_CLIENT_ID", clientSecret: "OAUTH_CLIENT_SECRET", tokenUrl: "OAUTH_TOKEN_URL", authUrl: "OAUTH_AUTH_URL", scopes: "OAUTH_SCOPES" },
  ];

  // Also try system-specific patterns based on env var names
  const envKeys = Object.keys(envVars);
  const systemPrefixes = new Set<string>();
  
  envKeys.forEach(key => {
    const match = key.match(/^([A-Z_]+)_(CLIENT_ID|CLIENT_SECRET|TOKEN_URL|AUTH_URL|SCOPES)$/);
    if (match) {
      systemPrefixes.add(match[1]);
    }
  });

  // Add system-specific patterns
  systemPrefixes.forEach(prefix => {
    patterns.push({
      clientId: `${prefix}_CLIENT_ID`,
      clientSecret: `${prefix}_CLIENT_SECRET`, 
      tokenUrl: `${prefix}_TOKEN_URL`,
      authUrl: `${prefix}_AUTH_URL`,
      scopes: `${prefix}_SCOPES`,
    });
  });

  for (const pattern of patterns) {
    const clientId = envVars[pattern.clientId];
    const clientSecret = envVars[pattern.clientSecret];
    const tokenUrl = envVars[pattern.tokenUrl];
    const scopes = envVars[pattern.scopes] || "read";

    if (clientId && clientSecret && tokenUrl) {
      return {
        clientId,
        clientSecret,
        tokenUrl,
        authUrl: envVars[pattern.authUrl],
        scopes,
      };
    }
  }

  return null;
}

/**
 * Load secret credentials from environment variables
 */
function loadSecretCredentials(envVars: Record<string, string>): SecretCredentials {
  const credentials: SecretCredentials = {};
  
  // Common secret patterns
  const secretPatterns = [
    "API_KEY", "TOKEN", "SECRET", "ACCESS_TOKEN", "AUTH_TOKEN",
  ];

  // System-specific patterns
  const envKeys = Object.keys(envVars);
  envKeys.forEach(key => {
    if (key.includes("TOKEN") || key.includes("KEY") || key.includes("SECRET")) {
      const value = envVars[key];
      if (value && !value.includes("your-") && !value.includes("example")) {
        credentials[key.toLowerCase()] = value;
      }
    }
  });

  // Standard patterns
  secretPatterns.forEach(pattern => {
    const value = envVars[pattern];
    if (value && !value.includes("your-") && !value.includes("example")) {
      credentials[pattern.toLowerCase()] = value;
    }
  });

  return credentials;
}

/**
 * Load environment variables from .env file
 */
async function loadEnvVars(cwd: string): Promise<Record<string, string>> {
  const envPath = join(cwd, ".env");
  
  try {
    await access(envPath, constants.F_OK);
  } catch {
    throw new Error(`.env file not found at ${envPath}`);
  }

  const envContent = await readFile(envPath, "utf8");
  const envVars: Record<string, string> = {};

  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join("=").trim();
      }
    }
  });

  return envVars;
}

// =============================================================================
// Main Command Logic
// =============================================================================

/**
 * Execute the test connection command
 */
async function executeTestConnection(options: TestConnectionOptions): Promise<void> {
  const cwd = options.cwd || process.cwd();
  const testSpinner = spinner("Initializing connection test...").start();

  try {
    // Validate connection type
    const connectionType = connectionTypeSchema.parse(options.type);
    testSpinner.text = `Testing ${connectionType} connection...`;

    // Load project configuration
    const isValidProject = await isValidAirdropProject(cwd);
    if (!isValidProject) {
      testSpinner.fail("❌ Not in a valid airdrop project directory");
      return;
    }

    const snapinConfig = await readSnapinConfigFile(cwd);
    if (!snapinConfig) {
      testSpinner.fail("❌ snapin.config.mjs not found or invalid");
      return;
    }

    const externalSystem = snapinConfig.externalSystem;
    if (!externalSystem) {
      testSpinner.fail("❌ No external system configuration found in snapin.config.mjs");
      return;
    }

    // Use tokenVerification.url as the test endpoint
    const connection = externalSystem.connection;
    let testApiUrl: string;
    
    if (connection && connection.type === "secret" && connection.tokenVerification?.url) {
      testApiUrl = connection.tokenVerification.url;
    } else if (connection && connection.type === "oauth2") {
      // For OAuth2, we could use a test endpoint from the config, but for now default to authorize URL
      testApiUrl = connection.authorize?.url || externalSystem.apiBaseUrl;
    } else {
      testSpinner.fail("❌ No valid test endpoint found in connection configuration");
      return;
    }

    // Load environment variables
    const envVars = await loadEnvVars(cwd);
    
    testSpinner.text = `Loading ${connectionType} credentials...`;

    let result: ConnectionTestResult;

    if (connectionType === "oauth2") {
      const credentials = loadOAuth2Credentials(envVars);
      if (!credentials) {
        testSpinner.fail("❌ OAuth2 credentials not found in .env file");
        logger.error("Required variables: CLIENT_ID, CLIENT_SECRET, TOKEN_URL");
        logger.info("Also tried system-specific patterns like SYSTEM_CLIENT_ID, etc.");
        return;
      }

      const customHeaders = (externalSystem.connection as any)?.headers || {};
      testSpinner.text = "Testing OAuth2 connection...";
      result = await testOAuth2Connection(credentials, testApiUrl, customHeaders, options.verbose);
    } else {
      const credentials = loadSecretCredentials(envVars);
      if (Object.keys(credentials).length === 0) {
        testSpinner.fail("❌ No secret credentials found in .env file");
        logger.error("Required: API_KEY, TOKEN, or similar secret-based credentials");
        return;
      }

      const secretTransform = (externalSystem.connection as any)?.secretTransform || "Bearer {token}";
      const customHeaders = (externalSystem.connection as any)?.headers || {};
      testSpinner.text = "Testing secret-based connection...";
      result = await testSecretConnection(credentials, testApiUrl, secretTransform, customHeaders, options.verbose);
    }

    // Display results
    if (result.success) {
      testSpinner.succeed(`✅ ${result.message}`);
      if (options.verbose && result.responseData) {
        logger.info("📋 API Response:");
        console.log(JSON.stringify(result.responseData, null, 2));
      }
    } else {
      testSpinner.fail(`❌ ${result.message}`);
      if (result.statusCode) {
        logger.error(`Status Code: ${result.statusCode}`);
      }
      if (options.verbose && result.error) {
        logger.error("🔍 Error Details:");
        console.error(result.error);
      }
    }

  } catch (error: any) {
    testSpinner.fail("❌ Connection test failed");
    logger.error(`Error: ${error.message}`);
    if (options.verbose) {
      console.error(error);
    }
  }
}

// =============================================================================
// Command Definition
// =============================================================================

export const testConnection = new Command()
  .name("connection-test")
  .description("Test OAuth2 or secret-based API connections")
  .option("--type <type>", "connection type (oauth2 or secret)", (value) => {
    const result = connectionTypeSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid connection type: ${value}. Must be 'oauth2' or 'secret'`);
    }
    return result.data;
  })
  .option("--verbose", "show detailed response information", false)
  .option("--cwd <cwd>", "the working directory (defaults to current directory)", process.cwd())
  .action(async (options) => {
    if (!options.type) {
      logger.error("❌ Connection type is required");
      logger.info("Usage:");
      logger.info("  shadcn test-connection --type=oauth2 --verbose");
      logger.info("  shadcn test-connection --type=secret");
      logger.info("");
      logger.info("Connection types:");
      logger.info("  oauth2  - Test OAuth 2.0 client credentials flow");
      logger.info("  secret  - Test secret/token-based authentication");
      logger.info("");
      logger.info("Requirements:");
      logger.info("  • .env file with credentials");
      logger.info("  • snapin.config.mjs with testEndpoint configured");
      logger.info("  • For OAuth2: CLIENT_ID, CLIENT_SECRET, TOKEN_URL");
      logger.info("  • For Secret: API_KEY, TOKEN, or similar credentials");
      return;
    }

    await executeTestConnection(options);
  });