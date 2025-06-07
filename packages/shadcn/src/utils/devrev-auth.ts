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
      envVars[key.trim()] = valueParts.join("=").trim();
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
        output.includes("unauthorized")) {
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
// Authentication Management
// =============================================================================

/**
 * Authenticate with DevRev CLI using email and org
 * 
 * @param auth - DevRev authentication details
 * @returns AuthResult indicating success or failure
 */
export async function authenticateDevRev(auth: DevRevAuth): Promise<AuthResult> {
  try {
    logger.info(`Authenticating with DevRev (${auth.email} @ ${auth.org})...`);

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
      logger.success("✅ DevRev authentication successful");
      return { success: true };
    } else {
      logger.error(`❌ DevRev authentication failed: ${output}`);
      return { 
        success: false, 
        message: `Authentication failed: ${output}` 
      };
    }

  } catch (error: any) {
    const message = error.message || "Unknown authentication error";
    logger.error(`❌ DevRev authentication error: ${message}`);
    return { 
      success: false, 
      message: `Authentication error: ${message}` 
    };
  }
}

// =============================================================================
// High-Level Authentication Flow
// =============================================================================

/**
 * Ensure DevRev CLI is authenticated and ready for operations
 * 
 * @param cwd - Working directory path
 * @param skipValidation - Skip token validation (for faster operations)
 * @returns AuthResult indicating final authentication state
 */
export async function ensureDevRevAuth(cwd: string, skipValidation: boolean = false): Promise<AuthResult> {
  // 1. Get authentication details from .env
  const auth = await getDevRevAuthFromEnv(cwd);
  if (!auth) {
    return {
      success: false,
      message: "Missing USER_EMAIL or DEV_ORG in .env file. Run 'shadcn doctor' for guidance."
    };
  }

  // 2. Skip validation if requested (for non-critical operations)
  if (skipValidation) {
    return { success: true };
  }

  // 3. Validate current token
  logger.info("🔍 Validating DevRev authentication...");
  const tokenResult = await validateDevRevToken();

  if (tokenResult.success) {
    logger.success("✅ DevRev authentication is valid");
    return { success: true };
  }

  // 4. Re-authenticate if token is expired/invalid
  if (tokenResult.needsAuth) {
    logger.warn("⚠️ DevRev token expired or invalid. Re-authenticating...");
    const authResult = await authenticateDevRev(auth);
    
    if (authResult.success) {
      // Verify authentication worked
      const verifyResult = await validateDevRevToken();
      if (verifyResult.success) {
        return { success: true };
      } else {
        return {
          success: false,
          message: "Authentication appeared successful but token validation still failed"
        };
      }
    } else {
      return authResult;
    }
  } else {
    // Non-auth related error
    return tokenResult;
  }
}

/**
 * Wrapper for executing DevRev CLI commands with automatic authentication
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
  // Ensure authentication first
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