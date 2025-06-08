import { execa } from "execa";
import { logger } from "./logger";
import { highlighter } from "./highlighter";
import path from "path";
import fs from "fs-extra";

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface DevRevAuth {
  email: string;
  org: string;
  pat?: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  needsAuth?: boolean;
}

// =============================================================================
// Environment Variable Extraction
// =============================================================================

/**
 * Extract DevRev authentication variables from .env file
 * 
 * @param cwd - Working directory path
 * @returns DevRev authentication variables or null if missing
 */
export async function getDevRevAuthFromEnv(cwd: string): Promise<DevRevAuth | null> {
  const envPath = path.join(cwd, ".env");
  
  if (!(await fs.pathExists(envPath))) {
    return null;
  }

  const envContent = await fs.readFile(envPath, "utf-8");
  const envVars: Record<string, string> = {};
  
  const envLines = envContent.split("\n").filter(line => line.trim() && !line.startsWith("#"));
  for (const line of envLines) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, ''); // Remove quotes
    }
  }

  const email = envVars.USER_EMAIL;
  const org = envVars.DEV_ORG;
  const pat = envVars.DEVREV_PAT;

  if (!email || !org) {
    return null;
  }

  // Check for placeholder values
  if (email === "your-email@example.com" || 
      org === "your-devrev-org-slug-here" ||
      email === "" || org === "") {
    return null;
  }

  return { email, org, pat };
}

// =============================================================================
// JWT Token Validation
// =============================================================================

/**
 * Validate current DevRev CLI authentication by running a simple command
 * 
 * @returns AuthResult indicating if token is valid or needs refresh
 */
export async function validateDevRevToken(): Promise<AuthResult> {
  try {
    const result = await execa("devrev", ["snap_in", "list"], {
      stdio: "pipe",
      reject: false,
      timeout: 10000 // 10 second timeout
    });

    const output = result.stdout + result.stderr;

    if (result.exitCode === 0) {
      return { success: true };
    }

    // Check for specific JWT token errors
    if (output.includes("invalid JWT token") || 
        output.includes("Token is expired") ||
        output.includes("authentication failed") ||
        output.includes("unauthorized") ||
        output.includes("not authenticated") ||
        output.includes("authentication required")) {
      return { 
        success: false, 
        needsAuth: true,
        message: "JWT token expired or invalid" 
      };
    }

    // Other errors (not auth-related)
    return { 
      success: false, 
      needsAuth: false,
      message: `DevRev CLI error: ${output}` 
    };

  } catch (error: any) {
    // Handle command not found or timeout
    if (error.message?.includes("command not found") || error.code === "ENOENT") {
      return { 
        success: false, 
        needsAuth: false,
        message: "DevRev CLI not found. Install with: npm install -g @devrev/cli" 
      };
    }

    if (error.code === "ETIMEDOUT") {
      return { 
        success: false, 
        needsAuth: false,
        message: "DevRev CLI timeout - check your network connection" 
      };
    }

    return { 
      success: false, 
      needsAuth: false,
      message: `Unexpected error: ${error.message}` 
    };
  }
}

// =============================================================================
// PAT-based Authentication Management
// =============================================================================

/**
 * Set DevRev CLI token using Personal Access Token (PAT) from .env file
 * 
 * @param auth - DevRev authentication details including PAT
 * @returns AuthResult indicating success or failure
 */
export async function setDevRevToken(auth: DevRevAuth): Promise<AuthResult> {
  if (!auth.pat) {
    return {
      success: false,
      message: "DEVREV_PAT not found in .env file. Please add DEVREV_PAT=<your-token> to your .env file"
    };
  }

  try {
    logger.info(`Setting DevRev token for ${auth.email} @ ${auth.org}...`);

    // Use echo to pipe the token to devrev profiles set-token
    const result = await execa("sh", [
      "-c", 
      `echo "${auth.pat}" | devrev profiles set-token --org "${auth.org}" --usr "${auth.email}"`
    ], {
      stdio: "pipe",
      reject: false,
      timeout: 30000 // 30 second timeout
    });

    const output = result.stdout + result.stderr;

    if (result.exitCode === 0) {
      logger.success("✅ DevRev token set successfully");
      return { success: true };
    } else {
      logger.error(`❌ Failed to set DevRev token: ${output}`);
      return { 
        success: false, 
        message: `Token setup failed: ${output}` 
      };
    }

  } catch (error: any) {
    const message = error.message || "Unknown token setup error";
    logger.error(`❌ DevRev token setup error: ${message}`);
    return { 
      success: false, 
      message: `Token setup error: ${message}` 
    };
  }
}

/**
 * Set DevRev CLI token with expiry using Personal Access Token (PAT) from .env file
 * 
 * @param auth - DevRev authentication details including PAT
 * @param expiryDays - Number of days for token expiry (optional, defaults to no expiry)
 * @returns AuthResult indicating success or failure
 */
export async function setDevRevTokenWithExpiry(auth: DevRevAuth, expiryDays?: number): Promise<AuthResult> {
  if (!auth.pat) {
    return {
      success: false,
      message: "DEVREV_PAT not found in .env file. Please add DEVREV_PAT=<your-token> to your .env file"
    };
  }

  try {
    logger.info(`Setting DevRev token for ${auth.email} @ ${auth.org}${expiryDays ? ` (expires in ${expiryDays} days)` : ''}...`);

    // Build command with optional expiry
    const expiryFlag = expiryDays ? `--expiry ${expiryDays}` : '';
    const command = `echo "${auth.pat}" | devrev profiles set-token --org "${auth.org}" --usr "${auth.email}" ${expiryFlag}`.trim();

    const result = await execa("sh", ["-c", command], {
      stdio: "pipe",
      reject: false,
      timeout: 30000 // 30 second timeout
    });

    const output = result.stdout + result.stderr;

    if (result.exitCode === 0) {
      logger.success("✅ DevRev token set successfully");
      return { success: true };
    } else {
      logger.error(`❌ Failed to set DevRev token: ${output}`);
      return { 
        success: false, 
        message: `Token setup failed: ${output}` 
      };
    }

  } catch (error: any) {
    const message = error.message || "Unknown token setup error";
    logger.error(`❌ DevRev token setup error: ${message}`);
    return { 
      success: false, 
      message: `Token setup error: ${message}` 
    };
  }
}

/**
 * Legacy interactive authentication (kept for fallback scenarios)
 * 
 * @param auth - DevRev authentication details
 * @returns AuthResult indicating success or failure
 */
export async function authenticateDevRevInteractive(auth: DevRevAuth): Promise<AuthResult> {
  try {
    logger.info(`Falling back to interactive authentication for ${auth.email} @ ${auth.org}...`);

    const result = await execa("devrev", [
      "profiles", 
      "authenticate", 
      "-o", auth.org,
      "-u", auth.email
    ], {
      stdio: ["inherit", "pipe", "pipe"], // Allow interactive input for auth
      reject: false,
      timeout: 60000 // 60 second timeout for interactive auth
    });

    const output = result.stdout + result.stderr;

    if (result.exitCode === 0) {
      logger.success("✅ DevRev interactive authentication successful");
      return { success: true };
    } else {
      logger.error(`❌ DevRev interactive authentication failed: ${output}`);
      return { 
        success: false, 
        message: `Interactive authentication failed: ${output}` 
      };
    }

  } catch (error: any) {
    const message = error.message || "Unknown authentication error";
    logger.error(`❌ DevRev interactive authentication error: ${message}`);
    return { 
      success: false, 
      message: `Interactive authentication error: ${message}` 
    };
  }
}

// =============================================================================
// High-Level Authentication Flow
// =============================================================================

/**
 * Ensure DevRev CLI is authenticated and ready for operations using PAT-based auth
 * 
 * @param cwd - Working directory path
 * @param skipValidation - Skip token validation (for faster operations)
 * @param expiryDays - Optional token expiry in days
 * @returns AuthResult indicating final authentication state
 */
export async function ensureDevRevAuth(cwd: string, skipValidation: boolean = false, expiryDays?: number): Promise<AuthResult> {
  // 1. Get authentication details from .env
  const auth = await getDevRevAuthFromEnv(cwd);
  if (!auth) {
    return {
      success: false,
      message: "Missing USER_EMAIL or DEV_ORG in .env file. Run 'shadcn doctor' for guidance."
    };
  }

  // 2. Check if PAT is available
  if (!auth.pat) {
    return {
      success: false,
      message: "Missing DEVREV_PAT in .env file. Please add DEVREV_PAT=<your-token> to your .env file"
    };
  }

  // 3. Skip validation if requested (for non-critical operations)
  if (skipValidation) {
    return { success: true };
  }

  // 4. Validate current token
  logger.info("🔍 Validating DevRev authentication...");
  const tokenResult = await validateDevRevToken();

  if (tokenResult.success) {
    logger.success("✅ DevRev authentication is valid");
    return { success: true };
  }

  // 5. Set token using PAT if validation failed
  if (tokenResult.needsAuth) {
    logger.warn("⚠️ DevRev token expired or invalid. Setting token using PAT...");
    const setTokenResult = expiryDays 
      ? await setDevRevTokenWithExpiry(auth, expiryDays)
      : await setDevRevToken(auth);
    
    if (setTokenResult.success) {
      // Verify token was set correctly
      const verifyResult = await validateDevRevToken();
      if (verifyResult.success) {
        return { success: true };
      } else {
        return {
          success: false,
          message: "Token was set but validation still failed. Please check your DEVREV_PAT token."
        };
      }
    } else {
      return setTokenResult;
    }
  } else {
    // Non-auth related error
    return tokenResult;
  }
}

/**
 * Bootstrap DevRev authentication silently using PAT from .env file
 * 
 * @param cwd - Working directory path
 * @param expiryDays - Optional token expiry in days
 * @returns AuthResult indicating authentication state
 */
export async function bootstrapDevRevAuth(cwd: string, expiryDays?: number): Promise<AuthResult> {
  const auth = await getDevRevAuthFromEnv(cwd);
  if (!auth) {
    return {
      success: false,
      message: "Missing authentication details in .env file. Required: USER_EMAIL, DEV_ORG, DEVREV_PAT"
    };
  }

  if (!auth.pat) {
    return {
      success: false,
      message: "Missing DEVREV_PAT in .env file. Please add your Personal Access Token."
    };
  }

  // Set token silently
  const setTokenResult = expiryDays 
    ? await setDevRevTokenWithExpiry(auth, expiryDays)
    : await setDevRevToken(auth);

  return setTokenResult;
}

/**
 * Wrapper for executing DevRev CLI commands with automatic PAT-based authentication
 * 
 * @param cwd - Working directory path
 * @param args - DevRev CLI command arguments
 * @param options - Execution options
 * @returns Command execution result
 */
export async function execDevRevCommand(
  cwd: string,
  args: string[],
  options: any = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  // Ensure authentication first using PAT
  const authResult = await ensureDevRevAuth(cwd);
  if (!authResult.success) {
    throw new Error(`DevRev authentication failed: ${authResult.message}`);
  }

  // Execute the command
  const result = await execa("devrev", args, {
    cwd,
    stdio: "pipe",
    reject: false,
    ...options
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  };
} 