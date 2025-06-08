import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import { highlighter } from "@/src/utils/highlighter";
import { handleError } from "@/src/utils/handle-error";
import { readSnapinConfig } from "@/src/utils/project-config";
import { ensureDevRevAuth, execDevRevCommand } from "@/src/utils/devrev-auth";
import { execa } from "execa";
import { z } from "zod";
import path from "path";
import fs from "fs-extra";
import yaml from "js-yaml";

const createKeyringOptionsSchema = z.object({
  name: z.string().min(1, "Keyring name is required"),
  type: z.enum(["oauth-secret", "snap-in-secret"], { 
    errorMap: () => ({ message: "Type must be 'oauth-secret' or 'snap-in-secret'" })
  }),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  secret: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
});

export const createKeyring = new Command()
  .name("create-keyring")
  .description("Create developer keyrings (oauth-secret or snap-in-secret) required by the manifest.yaml")
  .option("--name <keyring-name>", "name of the keyring (must match keyring_types[].id in manifest.yaml)")
  .option("--type <type>", "type of keyring (oauth-secret or snap-in-secret)")
  .option("--client-id <client-id>", "OAuth client ID (required for oauth-secret type)")
  .option("--client-secret <client-secret>", "OAuth client secret (required for oauth-secret type)")
  .option("--secret <secret>", "secret value (required for snap-in-secret type)", String)
  .option("--auto", "automatically create keyrings based on manifest.yaml, snapin.config.mjs, and .env files")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd);

      if (opts.auto) {
        // Automatic mode: create keyrings based on project files
        await createKeyringsAutomatically(cwd);
      } else {
        // Manual mode: validate and parse options
        if (!opts.name || !opts.type) {
          logger.error("Manual mode requires --name and --type. Use --auto for automatic keyring creation.");
          process.exit(1);
        }

        const options = createKeyringOptionsSchema.parse(opts);

        // Type-specific validation
        if (options.type === "oauth-secret") {
          if (!options.clientId || !options.clientSecret) {
            logger.error("For oauth-secret type, both --client-id and --client-secret are required");
            process.exit(1);
          }
        } else if (options.type === "snap-in-secret") {
          if (!options.secret) {
            logger.error("For snap-in-secret type, --secret is required");
            process.exit(1);
          }
        }

        await createSingleKeyring(options);
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          logger.error(`${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      } else {
        handleError(error);
      }
    }
  });

/**
 * Create keyrings automatically based on project files
 */
async function createKeyringsAutomatically(cwd: string): Promise<void> {
  logger.info("🔍 Analyzing project files for keyring creation...");
  logger.break();

  // Ensure DevRev authentication is valid before proceeding
  const authResult = await ensureDevRevAuth(cwd);
  if (!authResult.success) {
    logger.error(`❌ DevRev authentication failed: ${authResult.message}`);
    process.exit(1);
  }

  // 1. Read manifest.yaml to find required keyrings
  const manifestPath = path.join(cwd, "manifest.yaml");
  if (!(await fs.pathExists(manifestPath))) {
    logger.error("manifest.yaml not found. Cannot determine required keyrings.");
    process.exit(1);
  }

  const manifestContent = await fs.readFile(manifestPath, "utf-8");
  let manifest: any;
  try {
    manifest = yaml.load(manifestContent);
  } catch (error) {
    logger.error(`Failed to parse manifest.yaml: ${error}`);
    process.exit(1);
  }

  // 2. Read snapin.config.mjs to understand connection configuration
  const configResult = await readSnapinConfig(cwd);
  if (!configResult.validatedConfig) {
    logger.error(`Failed to load snapin.config.mjs: ${configResult.error?.message}`);
    process.exit(1);
  }

  const config = configResult.validatedConfig;

  // 3. Read .env file to get credential values
  const envPath = path.join(cwd, ".env");
  let envVars: Record<string, string> = {};
  if (await fs.pathExists(envPath)) {
    const envContent = await fs.readFile(envPath, "utf-8");
    const envLines = envContent.split("\n").filter(line => line.trim() && !line.startsWith("#"));
    for (const line of envLines) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join("=").trim();
      }
    }
  } else {
    logger.warn("⚠️ .env file not found. Some keyrings may not be created.");
  }

  // 4. Extract keyring requirements from manifest
  const keyringTypes = manifest.keyring_types || [];
  if (keyringTypes.length === 0) {
    logger.warn("No keyring_types found in manifest.yaml");
    return;
  }

  logger.info(`Found ${keyringTypes.length} keyring(s) to create:`);

  // 5. Create keyrings based on connection type and available env vars
  const connection = config.externalSystem?.connection;
  if (!connection) {
    logger.error("No connection configuration found in snapin.config.mjs");
    process.exit(1);
  }

  for (const keyringDef of keyringTypes) {
    const keyringName = keyringDef.id || keyringDef.name;
    if (!keyringName) {
      logger.warn("Skipping keyring definition without id/name");
      continue;
    }

    logger.info(`\n📝 Processing keyring: ${highlighter.info(keyringName)}`);

    if (connection.type === "oauth2") {
      // Try to create OAuth keyring
      const oauthConnection = connection as any;
      
      // Extract env var names from config
      let clientIdEnvVar: string | undefined;
      let clientSecretEnvVar: string | undefined;

      if (typeof oauthConnection.clientId === "string" && oauthConnection.clientId.includes("process.env.")) {
        const match = oauthConnection.clientId.match(/process\.env\.([A-Z_0-9]+)/);
        if (match) clientIdEnvVar = match[1];
      }

      if (typeof oauthConnection.clientSecret === "string" && oauthConnection.clientSecret.includes("process.env.")) {
        const match = oauthConnection.clientSecret.match(/process\.env\.([A-Z_0-9]+)/);
        if (match) clientSecretEnvVar = match[1];
      }

      if (clientIdEnvVar && clientSecretEnvVar && envVars[clientIdEnvVar] && envVars[clientSecretEnvVar]) {
        logger.info(`   🔑 Creating OAuth keyring from env vars: ${clientIdEnvVar}, ${clientSecretEnvVar}`);
        
        const success = await createKeyringWithRetry({
          name: keyringName,
          type: "oauth-secret",
          clientId: envVars[clientIdEnvVar],
          clientSecret: envVars[clientSecretEnvVar],
        });

        if (success) {
          logger.log(`   ${highlighter.success("✅")} Created OAuth keyring '${keyringName}' using env vars from .env`);
        }
      } else {
        logger.warn(`   ⚠️ Missing OAuth credentials in .env for keyring '${keyringName}'`);
        logger.info(`   Expected env vars: ${clientIdEnvVar || '<CLIENT_ID_VAR>'}, ${clientSecretEnvVar || '<CLIENT_SECRET_VAR>'}`);
      }

    } else if (connection.type === "secret") {
      // Try to create snap-in secret keyring
      const secretConnection = connection as any;
      
      // Look for a token env var referenced in the connection
      let secretEnvVar: string | undefined;
      
      if (secretConnection.tokenEnvVarName) {
        secretEnvVar = secretConnection.tokenEnvVarName;
      } else if (secretConnection.fields && Array.isArray(secretConnection.fields)) {
        // Look through fields for env var references
        for (const field of secretConnection.fields) {
          if (field.id && envVars[field.id.toUpperCase()]) {
            secretEnvVar = field.id.toUpperCase();
            break;
          }
        }
      }

      // Fallback: look for common patterns in env vars
      if (!secretEnvVar) {
        const systemSlug = config.externalSystem?.slug?.toUpperCase().replace(/-/g, "_");
        const possibleEnvVars = [
          `${systemSlug}_TOKEN`,
          `${systemSlug}_SECRET`,
          `${systemSlug}_API_KEY`,
          "API_TOKEN",
          "API_SECRET",
          "API_KEY"
        ].filter(Boolean);

        for (const envVar of possibleEnvVars) {
          if (envVars[envVar]) {
            secretEnvVar = envVar;
            break;
          }
        }
      }

      if (secretEnvVar && envVars[secretEnvVar]) {
        logger.info(`   🔐 Creating snap-in secret from env var: ${secretEnvVar}`);
        
        const success = await createKeyringWithRetry({
          name: keyringName,
          type: "snap-in-secret",
          secret: envVars[secretEnvVar],
        });

        if (success) {
          logger.log(`   ${highlighter.success("✅")} Created snap-in secret '${keyringName}' using ${secretEnvVar} from .env`);
        }
      } else {
        logger.warn(`   ⚠️ No secret value found in .env for keyring '${keyringName}'`);
        logger.info(`   Tried env vars: ${secretEnvVar || 'none found'}`);
      }
    }
  }

  logger.break();
  logger.info("🎉 Automatic keyring creation completed!");
}

/**
 * Create a single keyring manually
 */
async function createSingleKeyring(options: z.infer<typeof createKeyringOptionsSchema>): Promise<void> {
  logger.info(`Creating ${options.type} keyring: ${highlighter.info(options.name!)}`);

  // Ensure DevRev authentication is valid before proceeding
  const authResult = await ensureDevRevAuth(process.cwd());
  if (!authResult.success) {
    logger.error(`❌ DevRev authentication failed: ${authResult.message}`);
    process.exit(1);
  }

  const success = await createKeyringWithRetry(options);
  if (success) {
    logger.log(`${highlighter.success("✅")} Keyring '${options.name}' created successfully.`);
  }
}

/**
 * Create keyring with error handling and retry logic
 */
async function createKeyringWithRetry(keyringData: {
  name: string;
  type: "oauth-secret" | "snap-in-secret";
  clientId?: string;
  clientSecret?: string;
  secret?: string;
}): Promise<boolean> {
  try {
    if (keyringData.type === "oauth-secret") {
      const oauthData = JSON.stringify({
        client_id: keyringData.clientId,
        client_secret: keyringData.clientSecret
      });

      const result = await execa("devrev", [
        "developer_keyring", 
        "create", 
        "oauth-secret", 
        keyringData.name
      ], {
        input: oauthData,
        stdio: ["pipe", "pipe", "pipe"],
        reject: false
      });

      if (result.exitCode === 0) {
        return true;
      } else {
        const errorMessage = result.stderr || result.stdout;
        if (errorMessage?.includes("already exists")) {
          logger.warn(`   ⚠️ Keyring '${keyringData.name}' already exists`);
          return false;
        } else {
          logger.error(`   ❌ Failed to create keyring: ${errorMessage}`);
          return false;
        }
      }

    } else if (keyringData.type === "snap-in-secret") {
      // For snap-in secrets, DevRev CLI expects a JSON-encoded string
      const secretInput = JSON.stringify(String(keyringData.secret));
      
      const result = await execa("devrev", [
        "developer_keyring", 
        "create", 
        "snap-in-secret", 
        keyringData.name
      ], {
        input: secretInput, // JSON-encoded string for snap-in secrets
        stdio: ["pipe", "pipe", "pipe"],
        reject: false
      });

      if (result.exitCode === 0) {
        return true;
      } else {
        const errorMessage = result.stderr || result.stdout;
        if (errorMessage?.includes("already exists")) {
          logger.warn(`   ⚠️ Keyring '${keyringData.name}' already exists`);
          return false;
        } else {
          logger.error(`   ❌ Failed to create keyring: ${errorMessage}`);
          return false;
        }
      }
    }

    return false;

  } catch (error: any) {
    const errorMessage = error.stderr || error.stdout || error.message;
    
    if (errorMessage?.includes("already exists")) {
      logger.warn(`   ⚠️ Keyring '${keyringData.name}' already exists`);
      return false;
    } else if (errorMessage?.includes("not found") || errorMessage?.includes("command not found")) {
      logger.error("DevRev CLI not found. Please install it first:");
      logger.info("npm install -g @devrev/cli");
      process.exit(1);
    } else {
      logger.error(`   ❌ DevRev CLI error: ${errorMessage}`);
      return false;
    }
  }
} 