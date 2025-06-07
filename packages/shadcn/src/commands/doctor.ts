import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import { highlighter } from "@/src/utils/highlighter";
import { readSnapinConfig, hasSnapinConfig } from "@/src/utils/project-config";
import { SUPPORTED_DEVREV_OBJECTS } from "@/src/types/snapin-config";
import { getDevRevAuthFromEnv, validateDevRevToken, execDevRevCommand } from "@/src/utils/devrev-auth";
import path from "path";
import fs from "fs-extra";
import { execa } from "execa";

interface DoctorIssue {
  category: string;
  message: string;
  suggestion?: string;
}

export const doctor = new Command()
  .name("doctor")
  .description("Analyze project configuration and environment for correctness. Provides actionable insights without modifying files.")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd);
      logger.info("Running shadcn doctor...");
      logger.break();

      const issues: DoctorIssue[] = [];

      // 1. Check snapin.config.mjs
      await checkSnapinConfig(cwd, issues);

      // 2. Check .env file
      await checkEnvFile(cwd, issues);

      // 3. Check dependencies
      await checkDependencies(cwd, issues);

      // 4. Check DevRev authentication
      await checkDevRevAuth(cwd, issues);

      // 5. Validate manifest.yaml
      await validateManifest(cwd, issues);

      // Summary
      logger.break();
      if (issues.length === 0) {
        logger.log(`${highlighter.success("✓")} No issues found! Your project configuration looks good.`);
      } else {
        logger.error("Issues found:");
        logger.break();

        for (const issue of issues) {
          logger.error(`${highlighter.error("●")} ${highlighter.info(issue.category)}: ${issue.message}`);
          if (issue.suggestion) {
            logger.info(`  ${highlighter.success("Fix:")} ${issue.suggestion}`);
          }
          logger.break();
        }

        logger.info("Review the suggestions above and run the recommended commands to fix issues.");
      }
    } catch (error) {
      logger.error(`Doctor check failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Check snapin.config.mjs for missing or placeholder values
 */
async function checkSnapinConfig(cwd: string, issues: DoctorIssue[]): Promise<void> {
  logger.info("Checking snapin.config.mjs...");

  if (!(await hasSnapinConfig(cwd))) {
    issues.push({
      category: "Configuration",
      message: "snapin.config.mjs not found",
      suggestion: "Run 'shadcn init' to create the configuration file"
    });
    return;
  }

  const configResult = await readSnapinConfig(cwd);
  if (!configResult.validatedConfig) {
    issues.push({
      category: "Configuration",
      message: `Failed to load snapin.config.mjs: ${configResult.error?.message}`,
      suggestion: "Check the syntax and structure of your snapin.config.mjs file"
    });
    return;
  }

  const config = configResult.validatedConfig;

  // Check for missing or placeholder values
  if (!config.externalSystem?.name || config.externalSystem.name === "" || config.externalSystem.name === "External System") {
    issues.push({
      category: "External System",
      message: "externalSystem.name is missing or using placeholder",
      suggestion: "shadcn config --name '<your-system-name>'"
    });
  }

  if (!config.externalSystem?.slug || config.externalSystem.slug === "" || config.externalSystem.slug === "external-system") {
    issues.push({
      category: "External System", 
      message: "externalSystem.slug is missing or using placeholder",
      suggestion: "shadcn config --slug '<your-system-slug>'"
    });
  }

  if (!config.externalSystem?.apiBaseUrl || config.externalSystem.apiBaseUrl === "" || config.externalSystem.apiBaseUrl.includes("example.com")) {
    issues.push({
      category: "External System",
      message: "externalSystem.apiBaseUrl is missing or using example.com",
      suggestion: "shadcn config --api-base-url '<valid-api-url>'"
    });
  }

  // Check if tokenVerification.url is configured properly (for secret connections)
  if (config.externalSystem?.connection?.type === "secret") {
    const secretConnection = config.externalSystem.connection as any;
    if (!secretConnection.tokenVerification?.url || secretConnection.tokenVerification.url === "" || secretConnection.tokenVerification.url.includes("example.com")) {
      issues.push({
        category: "External System",
        message: "connection.tokenVerification.url is missing or using example.com",
        suggestion: "Update tokenVerification.url in your snapin.config.mjs connection configuration"
      });
    }
  }

  if (!config.externalSystem?.connection?.type) {
    issues.push({
      category: "Connection",
      message: "connection.type is missing",
      suggestion: "shadcn config --connection-type oauth2 (or --connection-type secret)"
    });
  }

  if (!config.externalSystem?.connection?.id || config.externalSystem.connection.id === "") {
    issues.push({
      category: "Connection",
      message: "connection.id is missing",
      suggestion: "shadcn config --connection-id '<connection-id>'"
    });
  }

  // Check OAuth2 specific fields
  if (config.externalSystem?.connection?.type === "oauth2") {
    const oauthConnection = config.externalSystem.connection as any;
    
    if (!oauthConnection.authorize?.url || oauthConnection.authorize.url === "") {
      issues.push({
        category: "OAuth2",
        message: "OAuth2 authorize URL is missing",
        suggestion: "shadcn config --authorize-url '<oauth-auth-url>'"
      });
    }

    if (!oauthConnection.authorize?.tokenUrl || oauthConnection.authorize.tokenUrl === "") {
      issues.push({
        category: "OAuth2",
        message: "OAuth2 token URL is missing", 
        suggestion: "shadcn config --token-url '<oauth-token-url>'"
      });
    }

    if (!oauthConnection.authorize?.scope || oauthConnection.authorize.scope === "") {
      issues.push({
        category: "OAuth2",
        message: "OAuth2 scope is missing",
        suggestion: "shadcn config --scope '<required-scopes>'"
      });
    }
  }

  // Check DevRev objects
  if (!config.devrevObjects || config.devrevObjects.length === 0) {
    issues.push({
      category: "DevRev Objects",
      message: "No DevRev objects configured for sync",
      suggestion: `shadcn config --add-devrev-object <object> (options: ${SUPPORTED_DEVREV_OBJECTS.join(", ")})`
    });
  }

  logger.success("snapin.config.mjs check complete.");
}

/**
 * Check .env file for missing environment variables
 */
async function checkEnvFile(cwd: string, issues: DoctorIssue[]): Promise<void> {
  logger.info("Checking .env file...");

  const envPath = path.join(cwd, ".env");
  if (!(await fs.pathExists(envPath))) {
    issues.push({
      category: "Environment",
      message: ".env file not found",
      suggestion: "Create a .env file with your environment variables"
    });
    return;
  }

  // Read config to find referenced environment variables
  const configResult = await readSnapinConfig(cwd);
  if (!configResult.validatedConfig) {
    logger.warn("Cannot check environment variables without valid config");
    return;
  }

  const config = configResult.validatedConfig;
  const envContent = await fs.readFile(envPath, "utf-8");
  const envLines = envContent.split("\n").filter(line => line.trim() && !line.startsWith("#"));
  const envVars = new Set(envLines.map(line => line.split("=")[0].trim()));

  // Check for environment variables referenced in config
  const requiredEnvVars: string[] = [];

  // Check OAuth2 client credentials
  if (config.externalSystem?.connection?.type === "oauth2") {
    const oauthConnection = config.externalSystem.connection as any;
    
    if (typeof oauthConnection.clientId === "string" && oauthConnection.clientId.includes("process.env.")) {
      const match = oauthConnection.clientId.match(/process\.env\.([A-Z_0-9]+)/);
      if (match) requiredEnvVars.push(match[1]);
    }

    if (typeof oauthConnection.clientSecret === "string" && oauthConnection.clientSecret.includes("process.env.")) {
      const match = oauthConnection.clientSecret.match(/process\.env\.([A-Z_0-9]+)/);
      if (match) requiredEnvVars.push(match[1]);
    }
  }

  // Check for missing environment variables
  for (const envVar of requiredEnvVars) {
    if (!envVars.has(envVar)) {
      issues.push({
        category: "Environment",
        message: `Required variable '${envVar}' is missing from .env`,
        suggestion: `Add ${envVar}=<your-value> to your .env file`
      });
    }
  }

  logger.success(".env file check complete.");
}

/**
 * Check DevRev authentication
 */
async function checkDevRevAuth(cwd: string, issues: DoctorIssue[]): Promise<void> {
  logger.info("Checking DevRev authentication...");

  // Check for required environment variables
  const auth = await getDevRevAuthFromEnv(cwd);
  if (!auth) {
    issues.push({
      category: "DevRev Authentication",
      message: "Missing USER_EMAIL or DEV_ORG in .env file",
      suggestion: "Add USER_EMAIL=<your-email> and DEV_ORG=<your-org-slug> to your .env file"
    });
    return;
  }

  // Validate current token
  const tokenResult = await validateDevRevToken();
  if (!tokenResult.success) {
    if (tokenResult.needsAuth) {
      issues.push({
        category: "DevRev Authentication",
        message: "DevRev JWT token is expired or invalid",
        suggestion: `Run 'devrev profiles authenticate -o ${auth.org} -u ${auth.email}' to re-authenticate`
      });
    } else {
      issues.push({
        category: "DevRev Authentication",
        message: `DevRev CLI validation failed: ${tokenResult.message}`,
        suggestion: "Check your DevRev CLI installation and network connection"
      });
    }
  } else {
    logger.success("DevRev authentication is valid.");
  }

  logger.success("DevRev authentication check complete.");
}

/**
 * Check required dependencies
 */
async function checkDependencies(cwd: string, issues: DoctorIssue[]): Promise<void> {
  logger.info("Checking required dependencies...");

  // Check for package.json in code/ folder (snap-in projects)
  const codePackageJsonPath = path.join(cwd, "code", "package.json");
  const rootPackageJsonPath = path.join(cwd, "package.json");
  
  const hasCodePackageJson = await fs.pathExists(codePackageJsonPath);
  const hasRootPackageJson = await fs.pathExists(rootPackageJsonPath);
  
  if (!hasCodePackageJson && !hasRootPackageJson) {
    issues.push({
      category: "Dependencies",
      message: "package.json not found in code/ folder or project root",
      suggestion: "Create package.json in the code/ folder for snap-in projects"
    });
    return;
  }
  
  if (!hasCodePackageJson) {
    issues.push({
      category: "Dependencies", 
      message: "package.json not found in code/ folder (expected for snap-in projects)",
      suggestion: "Create package.json in the code/ folder with your project dependencies"
    });
  }

  // Check for Node.js
  try {
    const nodeResult = await execa("node", ["--version"], { stdio: "pipe" });
    logger.success(`Node.js found (version ${nodeResult.stdout}).`);
  } catch {
    issues.push({
      category: "Dependencies",
      message: "Node.js not found",
      suggestion: "Install Node.js from https://nodejs.org/"
    });
  }

  // Check for DevRev CLI
  try {
    await execa("devrev", ["--version"], { stdio: "pipe" });
    logger.success("DevRev CLI found.");
  } catch {
    issues.push({
      category: "Dependencies",
      message: "DevRev CLI not found",
      suggestion: "Install DevRev CLI: npm install -g @devrev/cli"
    });
  }

  logger.success("Dependencies check complete.");
}

/**
 * Validate manifest.yaml using DevRev CLI
 */
async function validateManifest(cwd: string, issues: DoctorIssue[]): Promise<void> {
  logger.info("Checking manifest.yaml...");

  const manifestPath = path.join(cwd, "manifest.yaml");
  if (!(await fs.pathExists(manifestPath))) {
    logger.warn("manifest.yaml not found - this may be expected for some project types");
    return;
  }

  try {
    const result = await execDevRevCommand(cwd, ["snap_in_version", "validate-manifest", "manifest.yaml"]);
    const output = result.stdout || result.stderr || "";
    console.log("result", result);
    // result {
    //   exitCode: 0,
    //   stdout: '',
    //   stderr: 'Manifest is invalid. Error: Bad Request: yaml: line 39: did not find expected key'
    // }
    if (result.stderr === '' && result.stdout === '') {
      logger.success("Manifest validation passed.");
    } else {
      // Check for specific "Manifest is invalid." pattern
      if (output.startsWith("Manifest is invalid.")) {
        const lines = output.split('\n').filter(line => line.trim());
        const invalidMessage = lines[0]; // "Manifest is invalid."
        const errorMessage = lines.slice(1).join('\n').trim(); // Everything after the first line
        
        logger.error(`${highlighter.error("❌")} ${invalidMessage}`);
        if (errorMessage) {
          logger.info(`${highlighter.info("🔎")} ${errorMessage}`);
        }
        
        // Parse the error to provide specific suggestions
        let suggestion = "Review your manifest.yaml file and fix the validation errors";
        
        // Check for oauth secret not found
        const oauthSecretMatch = errorMessage.match(/oauth secret '([^']+)' not found/);
        const snapinSecretMatch = errorMessage.match(/snap-in secret '([^']+)' not found/);
        
        if (oauthSecretMatch || snapinSecretMatch) {
          suggestion = `shadcn createKeyring --auto  (automatically create all required keyrings from your .env file)`;
        }
        
        logger.info(`${highlighter.success("💡 Try:")} ${suggestion}`);
        
        issues.push({
          category: "Manifest",
          message: `${invalidMessage} ${errorMessage}`,
          suggestion: suggestion
        });
      } else {
        // Generic validation failure
        issues.push({
          category: "Manifest",
          message: `Manifest validation failed: ${output}`,
          suggestion: "Review your manifest.yaml file and fix the validation errors"
        });
      }
    }
  } catch (error: any) {
    // Extract meaningful error message
    const errorOutput = error.stderr || error.stdout || error.message;
    issues.push({
      category: "Manifest", 
      message: `Manifest validation failed: ${errorOutput}`,
      suggestion: "Review your manifest.yaml file and fix the validation errors"
    });
  }

  logger.success("Manifest check complete.");
}
