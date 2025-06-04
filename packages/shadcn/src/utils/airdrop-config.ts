import fs from "fs/promises"
import path from "path"
import { AirdropProjectConfig, airdropConfigSchema } from "@/src/type/airdrop-config"
import { logger } from "@/src/utils/logger"

const CONFIG_FILENAME = "airdrop.config.mjs"
const ENV_FILENAME = ".env"

/**
 * Get the airdrop configuration for a project
 */
export async function getAirdropConfig(cwd: string): Promise<AirdropProjectConfig | null> {
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
    logger.error(`Failed to read airdrop config: ${error}`)
    return null
  }
}

/**
 * Update the airdrop configuration with a partial patch
 */
export async function updateAirdropConfig(
  cwd: string,
  patch: Partial<AirdropProjectConfig>
): Promise<void> {
  const currentConfig = await getAirdropConfig(cwd)
  if (!currentConfig) {
    throw new Error("No existing airdrop configuration found")
  }

  const updatedConfig = { ...currentConfig, ...patch }
  
  // Validate the updated config
  const validatedConfig = airdropConfigSchema.parse(updatedConfig)
  
  await writeAirdropConfig(cwd, validatedConfig)
}

/**
 * Write the airdrop configuration to file
 */
export async function writeAirdropConfig(
  cwd: string,
  config: AirdropProjectConfig
): Promise<void> {
  const configPath = path.join(cwd, CONFIG_FILENAME)
  
  const configContent = generateConfigFileContent(config)
  
  await fs.writeFile(configPath, configContent, "utf8")
  logger.info(`Airdrop configuration written to ${configPath}`)
}

/**
 * Generate the content for the airdrop.config.mjs file
 */
function generateConfigFileContent(config: AirdropProjectConfig): string {
  return `/** @type {import('./types/airdrop-config').AirdropProjectConfig} */
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
 * Check if an airdrop configuration exists
 */
export async function hasAirdropConfig(cwd: string): Promise<boolean> {
  try {
    const configPath = path.join(cwd, CONFIG_FILENAME)
    await fs.access(configPath)
    return true
  } catch {
    return false
  }
}

/**
 * Add DevRev objects to the configuration
 */
export async function addDevRevObjects(
  cwd: string,
  objects: string[]
): Promise<void> {
  const config = await getAirdropConfig(cwd)
  if (!config) {
    throw new Error("No airdrop configuration found")
  }

  const existingObjects = new Set(config.devrevObjects)
  const newObjects = objects.filter(obj => !existingObjects.has(obj))
  
  if (newObjects.length > 0) {
    await updateAirdropConfig(cwd, {
      devrevObjects: [...config.devrevObjects, ...newObjects]
    })
    logger.info(`Added DevRev objects: ${newObjects.join(", ")}`)
  }
}

/**
 * Add external sync units to the configuration
 */
export async function addExternalSyncUnits(
  cwd: string,
  units: string[]
): Promise<void> {
  const config = await getAirdropConfig(cwd)
  if (!config) {
    throw new Error("No airdrop configuration found")
  }

  const existingUnits = new Set(config.externalSyncUnits)
  const newUnits = units.filter(unit => !existingUnits.has(unit))
  
  if (newUnits.length > 0) {
    await updateAirdropConfig(cwd, {
      externalSyncUnits: [...config.externalSyncUnits, ...newUnits]
    })
    logger.info(`Added external sync units: ${newUnits.join(", ")}`)
  }
} 