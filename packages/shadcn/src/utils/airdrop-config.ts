import fs from "fs/promises"
import path from "path"
import { AirdropProjectConfig, airdropConfigSchema } from "@/src/type/airdrop-config"
import { logger } from "@/src/utils/logger"

const CONFIG_FILENAME = "snapin.config.mjs" // Renamed
const ENV_FILENAME = ".env"

/**
 * Get the snap-in configuration for a project
 */
export async function getSnapInConfig(cwd: string): Promise<AirdropProjectConfig | null> { // Renamed
  try {
    const configPath = path.join(cwd, CONFIG_FILENAME)
    
    // Check if config file exists
    try {
      await fs.access(configPath)
    } catch {
      return null
    }

    // Dynamically import the config file
    const configModule = await import(configPath)
    const config = configModule.default

    // Validate the config against the schema
    const validatedConfig = airdropConfigSchema.parse(config)
    return validatedConfig
  } catch (error) {
    logger.error(`Failed to read snap-in config: ${error}`) // Log updated
    return null
  }
}

/**
 * Update the snap-in configuration with a partial patch
 */
export async function updateSnapInConfig( // Renamed
  cwd: string,
  patch: Partial<AirdropProjectConfig>
): Promise<void> {
  const currentConfig = await getSnapInConfig(cwd) // Use renamed function
  if (!currentConfig) {
    throw new Error("No existing snap-in configuration found") // Message updated
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
  const config = await getSnapInConfig(cwd) // Use renamed function
  if (!config) {
    throw new Error("No snap-in configuration found") // Message updated
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
  const config = await getSnapInConfig(cwd) // Use renamed function
  if (!config) {
    throw new Error("No snap-in configuration found") // Message updated
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