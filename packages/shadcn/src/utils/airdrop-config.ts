import fs from "fs/promises"
import path from "path"
import { AirdropProjectConfig, airdropConfigSchema } from "@/src/types/airdrop-config" // Updated path
import { ZodError } from "zod"; // Added ZodError import
import { logger } from "@/src/utils/logger"

const CONFIG_FILENAME = "snapin.config.mjs" // Renamed
const ENV_FILENAME = ".env"

/**
 * Get the snap-in configuration for a project
 */
export async function getSnapInConfig(cwd: string): Promise<{ validatedConfig: AirdropProjectConfig | null; rawConfig: any | null; error?: ZodError | Error }> {
  try {
    const configPath = path.join(cwd, CONFIG_FILENAME);
    try {
      await fs.access(configPath);
    } catch (accessError) {
      return { validatedConfig: null, rawConfig: null, error: new Error("snapin.config.mjs not found.") };
    }

    // Using a dynamic import with a cache-busting query parameter
    // This helps ensure a fresh import if the file content changes during the CLI's lifecycle (though less common for this specific use case)
    const configModule = await import(`${configPath}?update=${Date.now()}`);
    const rawConfig = configModule.default;

    if (!rawConfig) {
      return { validatedConfig: null, rawConfig: null, error: new Error("snapin.config.mjs does not have a default export.") };
    }

    try {
      const validatedConfig = airdropConfigSchema.parse(rawConfig);
      return { validatedConfig, rawConfig, error: undefined };
    } catch (validationError) {
      // logger.error(`Zod validation failed: ${validationError}`); // Optional: log verbose error here
      return { validatedConfig: null, rawConfig, error: validationError as ZodError };
    }
  } catch (generalError: any) {
    logger.error(`Failed to read or import snapin.config.mjs: ${generalError.message}`);
    return { validatedConfig: null, rawConfig: null, error: generalError };
  }
}

/**
 * Update the snap-in configuration with a partial patch
 */
export async function updateSnapInConfig( // Renamed
  cwd: string,
  patch: Partial<AirdropProjectConfig>
): Promise<void> {
  const configResult = await getSnapInConfig(cwd); // Use renamed function
  const currentConfig = configResult.validatedConfig;
  if (!currentConfig) {
    // Include more error context if available
    const errorDetail = configResult.error ? `: ${configResult.error.message}` : '';
    throw new Error(`No existing or valid snap-in configuration found${errorDetail}`); // Message updated
  }

  const updatedConfig = { ...currentConfig, ...patch }
  
  // Validate the updated config
  const validatedConfig = airdropConfigSchema.parse(updatedConfig)
  
  await writeSnapInConfig(cwd, validatedConfig) // Use renamed function
}

/**
 * Write the snap-in configuration to file
 */
export async function writeSnapInConfig( // Renamed
  cwd: string,
  config: AirdropProjectConfig
): Promise<void> {
  const configPath = path.join(cwd, CONFIG_FILENAME)
  
  const configContent = generateConfigFileContent(config)
  
  await fs.writeFile(configPath, configContent, "utf8")
  logger.info(`Snap-in configuration written to ${configPath}`) // Log updated
}

/**
 * Generate the content for the snapin.config.mjs file
 */
function generateConfigFileContent(config: AirdropProjectConfig): string { // Log updated in comment
  return `/** @type {import('./types/snapin-config').AirdropProjectConfig} */
export default ${JSON.stringify(config, null, 2).replace(
    /"(process\.env\.[A-Z_]+)"/g,
    "$1"
  )}
`
}

/**
 * Create or update the .env file with required environment variables
 */
export async function updateEnvFile(
  cwd: string,
  envVars: Record<string, string>
): Promise<void> {
  const envPath = path.join(cwd, ENV_FILENAME)
  let envContent = ""

  // Read existing .env file if it exists
  try {
    envContent = await fs.readFile(envPath, "utf8")
  } catch {
    // File doesn't exist, start with empty content
  }

  // Parse existing env vars
  const existingVars: Record<string, string> = {}
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=")
      if (key && valueParts.length > 0) {
        existingVars[key] = valueParts.join("=")
      }
    }
  })

  // Merge with new vars
  const mergedVars = { ...existingVars, ...envVars }

  // Generate new content
  const newEnvContent = Object.entries(mergedVars)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

  await fs.writeFile(envPath, newEnvContent, "utf8")
  logger.info(`Environment variables written to ${envPath}`)
}

/**
 * Check if a snap-in configuration exists
 */
export async function hasSnapInConfig(cwd: string): Promise<boolean> { // Renamed
  try {
    const configPath = path.join(cwd, CONFIG_FILENAME)
    await fs.access(configPath)
    return true
  } catch {
    return false
  }
}

/**
 * Add DevRev objects to the snap-in configuration
 */
export async function addDevRevObjectsToSnapInConfig( // Renamed
  cwd: string,
  objects: string[]
): Promise<void> {
  const configResult = await getSnapInConfig(cwd); // Use renamed function
  const config = configResult.validatedConfig;
  if (!config) {
    const errorDetail = configResult.error ? `: ${configResult.error.message}` : '';
    throw new Error(`No valid snap-in configuration found to add DevRev objects${errorDetail}`); // Message updated
  }

  const existingObjects = new Set(config.devrevObjects || []) // Handle if devrevObjects is undefined
  const newObjects = objects.filter(obj => !existingObjects.has(obj))
  
  if (newObjects.length > 0) {
    await updateSnapInConfig(cwd, { // Use renamed function
      devrevObjects: [...(config.devrevObjects || []), ...newObjects]
    })
    logger.info(`Added DevRev objects: ${newObjects.join(", ")}`)
  }
}

/**
 * Add external sync units to the snap-in configuration
 */
export async function addExternalSyncUnitsToSnapInConfig( // Renamed
  cwd: string,
  units: string[]
): Promise<void> {
  const configResult = await getSnapInConfig(cwd); // Use renamed function
  const config = configResult.validatedConfig;
  if (!config) {
    const errorDetail = configResult.error ? `: ${configResult.error.message}` : '';
    throw new Error(`No valid snap-in configuration found to add external sync units${errorDetail}`); // Message updated
  }

  const existingUnits = new Set(config.externalSyncUnits || []) // Handle if externalSyncUnits is undefined
  const newUnits = units.filter(unit => !existingUnits.has(unit))
  
  if (newUnits.length > 0) {
    await updateSnapInConfig(cwd, { // Use renamed function
      externalSyncUnits: [...(config.externalSyncUnits || []), ...newUnits]
    })
    logger.info(`Added external sync units: ${newUnits.join(", ")}`)
  }
} 