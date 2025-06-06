import path from "path"
import {
  readSnapinConfig, 
  hasSnapinConfig, 
  addDevRevObjectsToSnapinConfig, 
  addExternalSyncUnitsToSnapinConfig, 
} from "@/src/utils/project-config"
import { generateTypeDefinitions } from "@/src/utils/generators/type-generator"
import { SUPPORTED_DEVREV_OBJECTS, AirdropProjectConfig } from "@/src/types/snapin-config" // Updated path
import { ZodError } from "zod"; // Added ZodError import
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { Command } from "commander"
import prompts from "prompts"
import { z } from "zod"

const configOptionsSchema = z.object({
  cwd: z.string(),
  yes: z.boolean(),
  silent: z.boolean(),
})

export const config = new Command()
  .name("config")
  .description("manage project configuration") // Updated description
  // Top-level fields
  .option("--project-type <type>", "set project type (airdrop or snap-in)")
  .option("--sync-direction <direction>", "set sync direction (one-way or two-way)")
  // External system fields
  .option("--name <name>", "set external system name")
  .option("--slug <slug>", "set external system slug")
  .option("--access-method <method>", "set access method (api or sdk)")
  .option("--documentation-url <url>", "set documentation URL")
  .option("--api-base-url <url>", "set API base URL")

  .option("--add-external-object <object>", "add external object to the list (can be used multiple times)", (value: string, previous: string[]) => previous.concat([value]), [] as string[])
  .option("--remove-external-object <object>", "remove external object from the list (can be used multiple times)", (value: string, previous: string[]) => previous.concat([value]), [] as string[])
  // Connection fields
  .option("--connection-type <type>", "set connection type (oauth2 or secret)")
  .option("--connection-id <id>", "set connection ID")
  .option("--authorize-url <url>", "set OAuth2 authorization URL")
  .option("--token-url <url>", "set OAuth2 token URL")
  .option("--grant-type <type>", "set OAuth2 grant type")
  .option("--scope <scope>", "set OAuth2 scope")
  .option("--add-scope <scope>", "add OAuth2 scope (can be used multiple times)", (value: string, previous: string[]) => previous.concat([value]), [] as string[])
  .option("--remove-scope <scope>", "remove OAuth2 scope (can be used multiple times)", (value: string, previous: string[]) => previous.concat([value]), [] as string[])
  .option("--scope-delimiter <delimiter>", "set OAuth2 scope delimiter")
  .option("--refresh-url <url>", "set OAuth2 refresh URL")
  .option("--refresh-method <method>", "set OAuth2 refresh method")
  .option("--revoke-url <url>", "set OAuth2 revoke URL")
  .option("--revoke-method <method>", "set OAuth2 revoke method")
  // Headers
  .option("--add-header <key:value>", "add connection header (format: key:value, can be used multiple times)", (value: string, previous: string[]) => previous.concat([value]), [] as string[])
  .option("--remove-header <key>", "remove connection header by key (can be used multiple times)", (value: string, previous: string[]) => previous.concat([value]), [] as string[])
  .option("--set-headers <json>", "set all connection headers from JSON string (e.g., '{\"Content-Type\":\"application/json\"}')")
  // DevRev objects
  .option("--add-devrev-object <object>", "add DevRev object (can be used multiple times)", (value: string, previous: string[]) => previous.concat([value]), [] as string[])
  .option("--remove-devrev-object <object>", "remove DevRev object (can be used multiple times)", (value: string, previous: string[]) => previous.concat([value]), [] as string[])
  // Standard options
  .option("-y, --yes", "skip confirmation prompt.", false)
  .option("-s, --silent", "mute output.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    try {
      await updateConfigFields(opts)
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })



// Show current configuration
config
  .command("show")
  .description("show current project configuration") // Updated description
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd)

      // Check if project config exists
      if (!(await hasSnapinConfig(cwd))) { 
        logger.error("No project configuration found. Run 'init' first.") // Updated message
        process.exit(1)
      }

      const configResult = await readSnapinConfig(cwd)
      const config = configResult.validatedConfig; // Extract validatedConfig

      if (!config) {
        // If validation failed but rawConfig exists, show rawConfig as in info.ts
        if (configResult.rawConfig && configResult.error) {
          logger.warn("Could not fully validate snapin.config.mjs. This might be due to unset environment variables or schema mismatches.");
          logger.warn("Displaying raw configuration as loaded from the file:");
          console.log(configResult.rawConfig);
          if (configResult.error instanceof ZodError) {
            logger.warn("Validation issues summary:");
            configResult.error.errors.forEach(err => {
              logger.warn(`  - Path: ${err.path.join('.') || '.'}, Issue: ${err.message}`);
            });
          } else {
             logger.warn(`Error details: ${configResult.error.message}`);
          }
        } else if (configResult.error) {
            logger.error(`Failed to load snapin.config.mjs: ${configResult.error.message}`);
        } else {
            logger.error("Failed to load project configuration. No configuration found.");
        }
        process.exit(1)
      }

      logger.info("Current Project Configuration:") // Updated message
      logger.break()
      
      logger.info(`${highlighter.info("Project Type:")} ${config.projectType}`)
      if (config.syncDirection) {
        logger.info(`${highlighter.info("Sync Direction:")} ${config.syncDirection}`)
      }
      if (config.externalSystem) {
        logger.info(`${highlighter.info("External System:")} ${config.externalSystem.name} (${config.externalSystem.slug})`)
        logger.info(`${highlighter.info("API Base URL:")} ${config.externalSystem.apiBaseUrl}`)
      }
          if (config.externalSystem?.connection) {
      logger.info(`${highlighter.info("Connection Type:")} ${config.externalSystem.connection.type}`)
      }
      
      logger.break()
      logger.info(`${highlighter.info("DevRev Objects:")} ${(config.devrevObjects || []).join(", ")}`)
      if (config.externalSyncUnits && config.externalSyncUnits.length > 0) {
        logger.info(`${highlighter.info("External Sync Units:")} ${config.externalSyncUnits.join(", ")}`)
      } else {
        logger.info(`${highlighter.info("External Sync Units:")} (none)`)
      }
      
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })





/**
 * Update snapin.config.mjs fields based on CLI flags
 */
async function updateConfigFields(opts: any): Promise<void> {
  const cwd = path.resolve(opts.cwd)
  
  // Configure logger based on silent flag
  logger.setSilent(opts.silent)

  // Check if project config exists
  if (!(await hasSnapinConfig(cwd))) {
    logger.error("No project configuration found. Run 'init' first.")
    process.exit(1)
  }

  // Check if any update flags were provided
  const hasUpdates = Object.keys(opts).some(key => 
    !['cwd', 'yes', 'silent'].includes(key) && opts[key] !== undefined
  )

  if (!hasUpdates) {
    logger.warn("No configuration updates specified. Use --help to see available options.")
    return
  }

  // Read current config
  const configResult = await readSnapinConfig(cwd)
  if (!configResult.validatedConfig) {
    logger.error(`Failed to load project configuration: ${configResult.error?.message}`)
    process.exit(1)
  }

  const currentConfig = configResult.validatedConfig
  const updates: any = {}

  // Top-level field updates
  if (opts.projectType) {
    if (!['airdrop', 'snap-in'].includes(opts.projectType)) {
      logger.error("Project type must be 'airdrop' or 'snap-in'")
      process.exit(1)
    }
    updates.projectType = opts.projectType
  }

  if (opts.syncDirection) {
    if (!['one-way', 'two-way'].includes(opts.syncDirection)) {
      logger.error("Sync direction must be 'one-way' or 'two-way'")
      process.exit(1)
    }
    updates.syncDirection = opts.syncDirection
  }

  // External system updates
  if (opts.name || opts.slug || opts.accessMethod || opts.documentationUrl || 
      opts.apiBaseUrl || opts.addExternalObject?.length || 
      opts.removeExternalObject?.length) {
    
    const externalSystemUpdate: any = {
      ...currentConfig.externalSystem,
    }
    
    if (opts.name) externalSystemUpdate.name = opts.name
    if (opts.slug) externalSystemUpdate.slug = opts.slug
    if (opts.accessMethod) externalSystemUpdate.accessMethod = opts.accessMethod
    if (opts.documentationUrl) externalSystemUpdate.documentationUrl = opts.documentationUrl
    if (opts.apiBaseUrl) externalSystemUpdate.apiBaseUrl = opts.apiBaseUrl
    
    updates.externalSystem = externalSystemUpdate

    // Handle external objects array updates
    if (opts.addExternalObject?.length || opts.removeExternalObject?.length) {
      const currentObjects = new Set(currentConfig.externalSystem?.externalObjects || [])
      
      if (opts.addExternalObject?.length) {
        opts.addExternalObject.forEach((obj: string) => currentObjects.add(obj))
      }
      
      if (opts.removeExternalObject?.length) {
        opts.removeExternalObject.forEach((obj: string) => currentObjects.delete(obj))
      }
      
      updates.externalSystem!.externalObjects = Array.from(currentObjects)
    }
  }

  // Connection updates
  if (opts.connectionType || opts.connectionId || opts.authorizeUrl || opts.tokenUrl ||
      opts.grantType || opts.scope || opts.addScope?.length || opts.removeScope?.length ||
      opts.scopeDelimiter || opts.refreshUrl || opts.refreshMethod || opts.revokeUrl ||
      opts.revokeMethod || opts.addHeader?.length || opts.removeHeader?.length || opts.setHeaders) {
    
    if (!updates.externalSystem) {
      updates.externalSystem = { ...currentConfig.externalSystem }
    }

    const currentConnection = currentConfig.externalSystem?.connection || { type: "secret", id: "", fields: [] }
    
    if (opts.connectionType) {
      if (!['oauth2', 'secret'].includes(opts.connectionType)) {
        logger.error("Connection type must be 'oauth2' or 'secret'")
        process.exit(1)
      }
      
      if (opts.connectionType === 'oauth2') {
        updates.externalSystem!.connection = {
          type: "oauth2",
          id: opts.connectionId || currentConnection.id || "",
          clientId: (currentConnection as any).clientId || "",
          clientSecret: (currentConnection as any).clientSecret || "",
          headers: (currentConnection as any).headers || {},
          authorize: {
            url: opts.authorizeUrl || (currentConnection as any).authorize?.url || "",
            tokenUrl: opts.tokenUrl || (currentConnection as any).authorize?.tokenUrl || "",
            grantType: opts.grantType || (currentConnection as any).authorize?.grantType || "authorization_code",
            scope: opts.scope || (currentConnection as any).authorize?.scope || "",
            scopeDelimiter: opts.scopeDelimiter || (currentConnection as any).authorize?.scopeDelimiter || " ",
          },
          refresh: {
            url: opts.refreshUrl || (currentConnection as any).refresh?.url || "",
            method: opts.refreshMethod || (currentConnection as any).refresh?.method || "POST",
          },
          revoke: {
            url: opts.revokeUrl || (currentConnection as any).revoke?.url || "",
            method: opts.revokeMethod || (currentConnection as any).revoke?.method || "POST",
          },
        }

        // Handle scope updates for OAuth2
        if (opts.addScope?.length || opts.removeScope?.length) {
          const currentScopes = new Set((updates.externalSystem!.connection as any).authorize.scope.split(' ').filter(Boolean))
          
          if (opts.addScope?.length) {
            opts.addScope.forEach((scope: string) => currentScopes.add(scope))
          }
          
          if (opts.removeScope?.length) {
            opts.removeScope.forEach((scope: string) => currentScopes.delete(scope))
          }
          
          (updates.externalSystem!.connection as any).authorize.scope = Array.from(currentScopes).join(' ')
        }

        // Handle headers for OAuth2
        if (opts.addHeader?.length || opts.removeHeader?.length || opts.setHeaders) {
          let currentHeaders = { ...(currentConnection as any).headers } || {}
          
          if (opts.setHeaders) {
            try {
              currentHeaders = JSON.parse(opts.setHeaders)
            } catch (error) {
              logger.error("Invalid JSON format for --set-headers")
              process.exit(1)
            }
          }
          
          if (opts.addHeader?.length) {
            opts.addHeader.forEach((header: string) => {
              const [key, ...valueParts] = header.split(':')
              if (!key || valueParts.length === 0) {
                logger.error(`Invalid header format: ${header}. Use key:value format.`)
                process.exit(1)
              }
              currentHeaders[key.trim()] = valueParts.join(':').trim()
            })
          }
          
          if (opts.removeHeader?.length) {
            opts.removeHeader.forEach((key: string) => {
              delete currentHeaders[key.trim()]
            })
          }
          
          (updates.externalSystem!.connection as any).headers = currentHeaders
        }

        // Handle headers for OAuth2
        if (opts.addHeader?.length || opts.removeHeader?.length || opts.setHeaders) {
          let currentHeaders = { ...(currentConnection as any).headers } || {}
          
          if (opts.setHeaders) {
            try {
              currentHeaders = JSON.parse(opts.setHeaders)
            } catch (error) {
              logger.error("Invalid JSON format for --set-headers")
              process.exit(1)
            }
          }
          
          if (opts.addHeader?.length) {
            opts.addHeader.forEach((header: string) => {
              const [key, ...valueParts] = header.split(':')
              if (!key || valueParts.length === 0) {
                logger.error(`Invalid header format: ${header}. Use key:value format.`)
                process.exit(1)
              }
              currentHeaders[key.trim()] = valueParts.join(':').trim()
            })
          }
          
          if (opts.removeHeader?.length) {
            opts.removeHeader.forEach((key: string) => {
              delete currentHeaders[key.trim()]
            })
          }
          
          (updates.externalSystem!.connection as any).headers = currentHeaders
        }
      } else {
        updates.externalSystem!.connection = {
          type: "secret",
          id: opts.connectionId || currentConnection.id || "",
          secretTransform: (currentConnection as any).secretTransform || "",
          headers: (currentConnection as any).headers || {},
          tokenVerification: (currentConnection as any).tokenVerification || { url: "", method: "GET" },
          fields: (currentConnection as any).fields || [],
        }
      }
    } else {
      // Update existing connection fields without changing type
      updates.externalSystem!.connection = { ...currentConnection } as any
      
      if (opts.connectionId) {
        updates.externalSystem!.connection.id = opts.connectionId
      }

      if (currentConnection.type === 'oauth2') {
        const oauthConnection = updates.externalSystem!.connection as any
        if (opts.authorizeUrl) oauthConnection.authorize = { ...oauthConnection.authorize, url: opts.authorizeUrl }
        if (opts.tokenUrl) oauthConnection.authorize = { ...oauthConnection.authorize, tokenUrl: opts.tokenUrl }
        if (opts.grantType) oauthConnection.authorize = { ...oauthConnection.authorize, grantType: opts.grantType }
        if (opts.scope) oauthConnection.authorize = { ...oauthConnection.authorize, scope: opts.scope }
        if (opts.scopeDelimiter) oauthConnection.authorize = { ...oauthConnection.authorize, scopeDelimiter: opts.scopeDelimiter }
        if (opts.refreshUrl) oauthConnection.refresh = { ...oauthConnection.refresh, url: opts.refreshUrl }
        if (opts.refreshMethod) oauthConnection.refresh = { ...oauthConnection.refresh, method: opts.refreshMethod }
        if (opts.revokeUrl) oauthConnection.revoke = { ...oauthConnection.revoke, url: opts.revokeUrl }
        if (opts.revokeMethod) oauthConnection.revoke = { ...oauthConnection.revoke, method: opts.revokeMethod }

        // Handle scope updates
        if (opts.addScope?.length || opts.removeScope?.length) {
          const currentScopes = new Set(oauthConnection.authorize.scope.split(' ').filter(Boolean))
          
          if (opts.addScope?.length) {
            opts.addScope.forEach((scope: string) => currentScopes.add(scope))
          }
          
          if (opts.removeScope?.length) {
            opts.removeScope.forEach((scope: string) => currentScopes.delete(scope))
          }
          
          oauthConnection.authorize.scope = Array.from(currentScopes).join(' ')
        }
      }
    }

    // Handle headers for both OAuth2 and Secret connections
    if (opts.addHeader?.length || opts.removeHeader?.length || opts.setHeaders) {
      if (!updates.externalSystem!.connection) {
        updates.externalSystem!.connection = { ...currentConnection } as any
      }
      
      let currentHeaders = (updates.externalSystem!.connection as any).headers ? { ...(updates.externalSystem!.connection as any).headers } : {}
      
      if (opts.setHeaders) {
        try {
          currentHeaders = JSON.parse(opts.setHeaders)
        } catch (error) {
          logger.error("Invalid JSON format for --set-headers")
          process.exit(1)
        }
      }
      
      if (opts.addHeader?.length) {
        opts.addHeader.forEach((header: string) => {
          const [key, ...valueParts] = header.split(':')
          if (!key || valueParts.length === 0) {
            logger.error(`Invalid header format: ${header}. Use key:value format.`)
            process.exit(1)
          }
          currentHeaders[key.trim()] = valueParts.join(':').trim()
        })
      }
      
      if (opts.removeHeader?.length) {
        opts.removeHeader.forEach((key: string) => {
          delete currentHeaders[key.trim()]
        })
      }
      
      (updates.externalSystem!.connection as any).headers = currentHeaders
    }
  }

  // DevRev objects updates
  if (opts.addDevrevObject?.length || opts.removeDevrevObject?.length) {
    const currentDevrevObjects = new Set(currentConfig.devrevObjects || [])
    
    if (opts.addDevrevObject?.length) {
      // Validate DevRev objects
      const invalidObjects = opts.addDevrevObject.filter(
        (obj: string) => !SUPPORTED_DEVREV_OBJECTS.includes(obj as any)
      )
      if (invalidObjects.length > 0) {
        logger.error(`Invalid DevRev objects: ${invalidObjects.join(", ")}`)
        logger.info(`Supported objects: ${SUPPORTED_DEVREV_OBJECTS.join(", ")}`)
        process.exit(1)
      }
      
      opts.addDevrevObject.forEach((obj: string) => currentDevrevObjects.add(obj))
    }
    
    if (opts.removeDevrevObject?.length) {
      opts.removeDevrevObject.forEach((obj: string) => currentDevrevObjects.delete(obj))
    }
    
    updates.devrevObjects = Array.from(currentDevrevObjects)
  }

  // Confirm updates if not in yes mode
  if (!opts.yes) {
    logger.info("The following updates will be applied:")
    console.log(JSON.stringify(updates, null, 2))
    
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: "Apply these updates to snapin.config.mjs?",
      initial: true,
    })

    if (!proceed) {
      logger.info("Configuration update cancelled.")
      return
    }
  }

  // Apply updates
  const { updateSnapinConfigFile } = await import("../utils/updaters/update-snapin-config-mjs")
  
  const configSpinner = spinner("Updating configuration...").start()
  await updateSnapinConfigFile(cwd, updates)
  
  // Regenerate types
  const updatedConfigResult = await readSnapinConfig(cwd)
  if (updatedConfigResult.validatedConfig) {
    await generateTypeDefinitions(cwd, updatedConfigResult.validatedConfig)
  }
  
  configSpinner.succeed()
  
  logger.log(`${highlighter.success("Success!")} Configuration updated successfully.`)
} 