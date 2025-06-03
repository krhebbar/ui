import path from "path"
import { preFlightInit } from "@/src/preflights/preflight-init"
import { addComponents } from "@/src/utils/add-item"
import { createProject } from "@/src/utils/create-project"
import * as ERRORS from "@/src/utils/errors"
import {
  getConfig,
  resolveConfigPaths,
} from "@/src/utils/get-config"
import {
  getProjectInfo,
} from "@/src/utils/get-project-info"
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { 
  writeAirdropConfig, 
  updateEnvFile, 
  hasAirdropConfig 
} from "@/src/utils/airdrop-config"
import { 
  generateTypeDefinitions, 
  copyConfigTypes 
} from "@/src/utils/type-generator"
import { 
  AirdropProjectConfig, 
  SUPPORTED_DEVREV_OBJECTS 
} from "@/src/type/airdrop-config"
import { Command } from "commander"
import prompts from "prompts"
import { z } from "zod"

export const initOptionsSchema = z.object({
  cwd: z.string(),
  components: z.array(z.string()).optional(),
  yes: z.boolean(),
  force: z.boolean(),
  silent: z.boolean(),
  isNewProject: z.boolean(),
})

export const init = new Command()
  .name("init")
  .description("initialize your airdrop project and install dependencies")
  .argument(
    "[components...]",
    "the items to add or a url to the item."
  )
  .option("-y, --yes", "skip confirmation prompt.", false)
  .option("-f, --force", "force overwrite of existing configuration.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .option("-s, --silent", "mute output.", false)
  .action(async (components, opts) => {
    try {
      const options = initOptionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        isNewProject: false,
        components,
        ...opts,
      })

      await runInit(options)

      logger.log(
        `${highlighter.success(
          "Success!"
          )} Airdrop project initialization completed.\nYou may now add items.`
      )
      logger.break()
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })

export async function runInit(
  options: z.infer<typeof initOptionsSchema> & {
    skipPreflight?: boolean
  }
) {
  let projectInfo
  if (!options.skipPreflight) {
    const preflight = await preFlightInit(options)
    if (preflight.errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT]) {
      const { projectPath } = await createProject({
        cwd: options.cwd,
        force: options.force,
        components: options.components,
      })
      if (!projectPath) {
        process.exit(1)
      }
      options.cwd = projectPath
      options.isNewProject = true
    }
    projectInfo = preflight.projectInfo
  } else {
    projectInfo = await getProjectInfo(options.cwd)
  }

  const config = await getConfig(options.cwd)
  if (!config) {
    throw new Error(
      `Failed to read manifest file at ${highlighter.info(options.cwd)}.`
    )
  }

  // Check if airdrop.config.mjs already exists
  const hasExistingConfig = await hasAirdropConfig(options.cwd)
  if (hasExistingConfig && !options.force) {
    if (!options.yes) {
      const { overwrite } = await prompts({
        type: "confirm",
        name: "overwrite",
        message: "Airdrop configuration already exists. Overwrite?",
        initial: false,
      })
      
      if (!overwrite) {
        logger.info("Skipping airdrop configuration creation.")
        return config
      }
    }
  }

  if (!options.yes) {
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: `Initialize airdrop project configuration. Proceed?`,
      initial: true,
    })

    if (!proceed) {
      process.exit(0)
    }
  }

  // Gather airdrop configuration from user
  const airdropConfig = await gatherAirdropConfiguration(options)

  // Configuration is derived from manifest.yml and project structure
  const configSpinner = spinner(`Creating airdrop project configuration.`).start()
  
  // Write airdrop.config.mjs
  await writeAirdropConfig(options.cwd, airdropConfig)
  
  // Write environment variables
  const envVars = extractEnvVarsFromConfig(airdropConfig)
  if (Object.keys(envVars).length > 0) {
    await updateEnvFile(options.cwd, envVars)
  }
  
  // Copy config types and generate type definitions
  await copyConfigTypes(options.cwd)
  await generateTypeDefinitions(options.cwd, airdropConfig)
  
  configSpinner.succeed()

  // Add components if specified
  const fullConfig = await resolveConfigPaths(options.cwd, config)
  if (options.components?.length) {
    await addComponents(options.components, fullConfig, {
      // Init will always overwrite files.
      overwrite: true,
      silent: options.silent,
      isNewProject: options.isNewProject,
    })
  }

  return fullConfig
}

/**
 * Gather airdrop configuration from user prompts
 */
async function gatherAirdropConfiguration(
  options: z.infer<typeof initOptionsSchema>
): Promise<AirdropProjectConfig> {
  if (options.silent || options.yes) {
    // Return default configuration for silent mode
    return createDefaultAirdropConfig()
  }

  logger.info("Let's configure your Airdrop project:")
  logger.break()

  const responses = await prompts([
    {
      type: "select",
      name: "projectType",
      message: "What type of project is this?",
      choices: [
        { title: "Airdrop", value: "airdrop" },
        { title: "Snap-in", value: "snap-in" },
      ],
      initial: 0,
    },
    {
      type: "select",
      name: "syncDirection",
      message: "What sync direction do you need?",
      choices: [
        { title: "Two-way sync", value: "two-way" },
        { title: "One-way sync", value: "one-way" },
      ],
      initial: 0,
    },
    {
      type: "text",
      name: "externalSystemName",
      message: "What is the name of your external system?",
      initial: "External System",
    },
    {
      type: "text",
      name: "externalSystemSlug",
      message: "External system slug (machine-readable name):",
      initial: (prev: string) => prev.toLowerCase().replace(/\s+/g, '-'),
    },
    {
      type: "text",
      name: "apiBaseUrl",
      message: "API base URL for the external system:",
      initial: "https://api.example.com",
    },
    {
      type: "text",
      name: "testEndpoint",
      message: "Test endpoint for connection verification:",
      initial: (prev: string) => `${prev}/user`,
    },
    {
      type: "multiselect",
      name: "devrevObjects",
      message: "Select DevRev objects to sync (use space to select):",
      choices: SUPPORTED_DEVREV_OBJECTS.slice(0, 10).map(obj => ({
        title: obj,
        value: obj,
        selected: ["dm", "revu", "tag"].includes(obj),
      })),
      min: 1,
    },
    {
      type: "list",
      name: "externalSyncUnits",
      message: "Enter external sync units (comma-separated):",
      initial: "tickets,conversations",
      separator: ",",
    },
    {
      type: "select",
      name: "connectionType",
      message: "What type of connection will you use?",
      choices: [
        { title: "OAuth2", value: "oauth2" },
        { title: "Secret/API Key", value: "secret" },
      ],
      initial: 0,
    },
  ])

  if (responses.connectionType === "oauth2") {
    const oauthResponses = await prompts([
      {
        type: "text",
        name: "clientIdEnvVar",
        message: "Environment variable name for OAuth client ID:",
        initial: `${responses.externalSystemSlug.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`,
      },
      {
        type: "text",
        name: "clientSecretEnvVar",
        message: "Environment variable name for OAuth client secret:",
        initial: `${responses.externalSystemSlug.toUpperCase().replace(/-/g, '_')}_CLIENT_SECRET`,
      },
      {
        type: "text",
        name: "authorizeUrl",
        message: "OAuth authorization URL:",
        initial: `${responses.apiBaseUrl}/oauth/authorize`,
      },
      {
        type: "text",
        name: "tokenUrl",
        message: "OAuth token URL:",
        initial: `${responses.apiBaseUrl}/oauth/token`,
      },
      {
        type: "text",
        name: "scope",
        message: "OAuth scope:",
        initial: "read_api api",
      },
    ])

    return {
      projectType: responses.projectType,
      syncDirection: responses.syncDirection,
      devrevObjects: responses.devrevObjects,
      externalSyncUnits: responses.externalSyncUnits,
      externalSystem: {
        name: responses.externalSystemName,
        slug: responses.externalSystemSlug,
        apiBaseUrl: responses.apiBaseUrl,
        testEndpoint: responses.testEndpoint,
        supportedObjects: responses.externalSyncUnits,
      },
      connection: {
        type: "oauth2",
        id: `${responses.externalSystemSlug}-oauth-connection`,
        clientId: `process.env.${oauthResponses.clientIdEnvVar}`,
        clientSecret: `process.env.${oauthResponses.clientSecretEnvVar}`,
        authorize: {
          url: oauthResponses.authorizeUrl,
          tokenUrl: oauthResponses.tokenUrl,
          grantType: "authorization_code",
          scope: oauthResponses.scope,
          scopeDelimiter: " ",
        },
        refresh: {
          url: oauthResponses.tokenUrl,
          method: "POST",
        },
        revoke: {
          url: `${responses.apiBaseUrl}/oauth/revoke`,
          method: "POST",
        },
      },
    }
  } else {
    const secretResponses = await prompts([
      {
        type: "text",
        name: "tokenEnvVar",
        message: "Environment variable name for API token:",
        initial: `${responses.externalSystemSlug.toUpperCase().replace(/-/g, '_')}_TOKEN`,
      },
      {
        type: "confirm",
        name: "isSubdomain",
        message: "Does this API use subdomains?",
        initial: false,
      },
    ])

    return {
      projectType: responses.projectType,
      syncDirection: responses.syncDirection,
      devrevObjects: responses.devrevObjects,
      externalSyncUnits: responses.externalSyncUnits,
      externalSystem: {
        name: responses.externalSystemName,
        slug: responses.externalSystemSlug,
        apiBaseUrl: responses.apiBaseUrl,
        testEndpoint: responses.testEndpoint,
        supportedObjects: responses.externalSyncUnits,
      },
      connection: {
        type: "secret",
        id: `${responses.externalSystemSlug}-secret-connection`,
        isSubdomain: secretResponses.isSubdomain,
        secretTransform: ".token",
        tokenVerification: {
          url: responses.testEndpoint,
          method: "GET",
        },
        fields: [
          {
            id: "token",
            name: "API Token",
            description: `${responses.externalSystemName} API token`,
          },
        ],
      },
    }
  }
}

/**
 * Create a default airdrop configuration for silent mode
 */
function createDefaultAirdropConfig(): AirdropProjectConfig {
  return {
    projectType: "airdrop",
    syncDirection: "two-way",
    devrevObjects: ["dm", "revu", "tag"],
    externalSyncUnits: ["tickets", "conversations"],
    externalSystem: {
      name: "External System",
      slug: "external-system",
      apiBaseUrl: "https://api.example.com",
      testEndpoint: "https://api.example.com/user",
      supportedObjects: ["tickets", "conversations"],
    },
    connection: {
      type: "oauth2",
      id: "external-system-oauth-connection",
      clientId: "process.env.EXTERNAL_SYSTEM_CLIENT_ID",
      clientSecret: "process.env.EXTERNAL_SYSTEM_CLIENT_SECRET",
      authorize: {
        url: "https://api.example.com/oauth/authorize",
        tokenUrl: "https://api.example.com/oauth/token",
        grantType: "authorization_code",
        scope: "read_api api",
        scopeDelimiter: " ",
      },
      refresh: {
        url: "https://api.example.com/oauth/token",
        method: "POST",
      },
      revoke: {
        url: "https://api.example.com/oauth/revoke",
        method: "POST",
      },
    },
  }
}

/**
 * Extract environment variable placeholders from config
 */
function extractEnvVarsFromConfig(config: AirdropProjectConfig): Record<string, string> {
  const envVars: Record<string, string> = {}
  
  if (config.connection.type === "oauth2") {
    const clientIdMatch = config.connection.clientId.match(/process\.env\.([A-Z_]+)/)
    const clientSecretMatch = config.connection.clientSecret.match(/process\.env\.([A-Z_]+)/)
    
    if (clientIdMatch) {
      envVars[clientIdMatch[1]] = "your-client-id-here"
    }
    if (clientSecretMatch) {
      envVars[clientSecretMatch[1]] = "your-client-secret-here"
    }
  }
  
  return envVars
}
