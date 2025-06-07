import path from "path"
import fs from "fs-extra"

import {
  AirdropProjectConfig,
  airdropConfigSchema,
} from "../../types/snapin-config"
import { logger } from "../logger"
import { withTemporaryWriteAccess } from "../protect"

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface UpdateOptions {
  force?: boolean
  validate?: boolean
  createIfMissing?: boolean
}

// =============================================================================
// Snapin Configuration File Operations
// =============================================================================

/**
 * Update existing snapin.config.mjs file with partial configuration
 *
 * @param cwd - Working directory path
 * @param patch - Partial configuration to merge with existing config
 * @param options - Update options for behavior control
 *
 * Input: Directory path, partial configuration, options
 * Output: Updated snapin.config.mjs file (idempotent operation)
 */
export async function updateSnapinConfigFile(
  cwd: string,
  patch: Partial<AirdropProjectConfig>,
  options: UpdateOptions = {}
): Promise<void> {
  const configPath = path.join(cwd, "snapin.config.mjs")

  try {
    // Try to read existing config
    const existingConfig = await readSnapinConfig(cwd)

    if (!existingConfig && !options.createIfMissing) {
      logger.warn("No snapin.config.mjs found and createIfMissing is false")
      return
    }

    let mergedConfig = existingConfig
      ? { ...existingConfig, ...patch }
      : (patch as AirdropProjectConfig)

    // Compute isComplete for externalSystem if it exists
    if (mergedConfig.externalSystem) {
      let complete = true
      const es = mergedConfig.externalSystem

      // Check operational URLs for "example.com"
      if (es.apiBaseUrl?.includes("example.com")) complete = false
      if (es.testEndpoint?.includes("example.com")) complete = false
      if (es.documentationUrl?.includes("example.com")) complete = false // Also check documentationUrl

      if (es.accessMethod === "sdk") {
        // For SDK access, sdkBaseUrl must exist and not be an example.com URL
        if (!es.sdkBaseUrl || es.sdkBaseUrl.includes("example.com"))
          complete = false
      }

      // Check connection details if they exist
      if (es.connection) {
        if (es.connection.type === "oauth2") {
          if (es.connection.authorize?.url?.includes("example.com"))
            complete = false
          if (es.connection.authorize?.tokenUrl?.includes("example.com"))
            complete = false
          if (es.connection.refresh?.url?.includes("example.com"))
            complete = false
          if (es.connection.revoke?.url?.includes("example.com"))
            complete = false
        }
        // No specific "example.com" checks for 'secret' type connection,
        // as it primarily relies on env vars.
      }
      es.isComplete = complete
    }

    const updatedConfig = mergedConfig // mergedConfig now contains isComplete

    // Validate the updated config if requested
    if (options.validate) {
      airdropConfigSchema.parse(updatedConfig)
    }

    await writeSnapinConfigFile(cwd, updatedConfig)
  } catch (error) {
    const errorDetail = error instanceof Error ? `: ${error.message}` : ""
    if (options.createIfMissing && !(await fs.pathExists(configPath))) {
      // Create new config file
      if (airdropConfigSchema.safeParse(patch).success) {
        await writeSnapinConfigFile(cwd, patch as AirdropProjectConfig)
      } else {
        throw new Error(
          `Cannot create snapin.config.mjs - invalid configuration${errorDetail}`
        )
      }
    } else {
      throw new Error(`Failed to update snapin.config.mjs${errorDetail}`)
    }
  }
}

/**
 * Write complete snapin.config.mjs file with full configuration
 *
 * @param cwd - Working directory path
 * @param config - Complete project configuration object
 *
 * Input: Directory path, complete project configuration
 * Output: New snapin.config.mjs file created/overwritten
 */
export async function writeSnapinConfigFile(
  cwd: string,
  config: AirdropProjectConfig
): Promise<void> {
  const configPath = path.join(cwd, "snapin.config.mjs")
  const configContent = generateSnapinConfigContent(config)

  // Use smart protection to temporarily make file writable if protected
  await withTemporaryWriteAccess(configPath, async () => {
    await fs.writeFile(configPath, configContent, "utf8")
  })

  logger.info(`Snapin configuration written to ${configPath}`)
}

/**
 * Read and parse existing snapin.config.mjs file
 *
 * @param cwd - Working directory path
 *
 * Input: Directory path
 * Output: Parsed configuration object or null if not found/invalid
 */
async function readSnapinConfig(
  cwd: string
): Promise<AirdropProjectConfig | null> {
  try {
    const configPath = path.join(cwd, "snapin.config.mjs")
    await fs.access(configPath)

    const configModule = await import(`${configPath}?update=${Date.now()}`)
    const rawConfig = configModule.default

    if (!rawConfig) {
      return null
    }

    const validationResult = airdropConfigSchema.safeParse(rawConfig)
    return validationResult.success ? validationResult.data : rawConfig
  } catch {
    return null
  }
}

/**
 * Generate snapin.config.mjs file content from configuration object
 *
 * @param config - Complete project configuration object
 *
 * Input: Project configuration
 * Output: JavaScript module content string
 */
function generateSnapinConfigContent(config: AirdropProjectConfig): string {
  return `/** @type {import('./types/snapin-config').AirdropProjectConfig} */
export default ${JSON.stringify(config, null, 2).replace(
    /"(process\.env\.[A-Z_]+)"/g,
    "$1"
  )}
`
}
