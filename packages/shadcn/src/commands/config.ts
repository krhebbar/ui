import path from "path"
import {
  getSnapInConfig, // Renamed
  hasSnapInConfig, // Renamed
  addDevRevObjectsToSnapInConfig, // Renamed
  addExternalSyncUnitsToSnapInConfig, // Renamed
  updateSnapInConfig, // Renamed
} from "@/src/utils/airdrop-config"
import { generateTypeDefinitions } from "@/src/utils/type-generator"
import { SUPPORTED_DEVREV_OBJECTS, AirdropProjectConfig } from "@/src/type/airdrop-config" // AirdropProjectConfig might be needed for type hints
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

// Add DevRev objects subcommand
config
  .command("add-devrev")
  .description("add DevRev objects to sync configuration")
  .argument("[objects...]", "DevRev objects to add")
  .option("-y, --yes", "skip confirmation prompt.", false)
  .option("-s, --silent", "mute output.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (objects, opts) => {
    try {
      const options = configOptionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        ...opts,
      })

      // Check if project config exists
      if (!(await hasSnapInConfig(options.cwd))) { // Renamed
        logger.error("No project configuration found. Run 'init' first.") // Updated message
        process.exit(1)
      }

      let objectsToAdd = objects
      if (!objectsToAdd?.length) {
        objectsToAdd = await promptForDevRevObjects(options)
      }

      if (!objectsToAdd?.length) {
        logger.warn("No objects selected.")
        return
      }

      // Validate objects
      const invalidObjects = objectsToAdd.filter(
        (obj: string) => !SUPPORTED_DEVREV_OBJECTS.includes(obj as typeof SUPPORTED_DEVREV_OBJECTS[number])
      )
      if (invalidObjects.length > 0) {
        logger.error(`Invalid DevRev objects: ${invalidObjects.join(", ")}`)
        logger.info(`Supported objects: ${SUPPORTED_DEVREV_OBJECTS.join(", ")}`)
        process.exit(1)
      }

      if (!options.yes) {
        const { proceed } = await prompts({
          type: "confirm",
          name: "proceed",
          message: `Add ${objectsToAdd.join(", ")} to DevRev objects?`,
          initial: true,
        })

        if (!proceed) {
          process.exit(0)
        }
      }

      const configSpinner = spinner("Adding DevRev objects...").start()
      await addDevRevObjectsToSnapInConfig(options.cwd, objectsToAdd) // Renamed
      
      // Regenerate types
      const configResult = await getSnapInConfig(options.cwd) // Renamed, get result object
      const config = configResult.validatedConfig; // Extract validatedConfig
      if (config) {
        await generateTypeDefinitions(options.cwd, config)
      } else {
        logger.warn(`Could not regenerate types due to invalid configuration. Error: ${configResult.error?.message}`);
      }
      
      configSpinner.succeed()
      
      logger.log(
        `${highlighter.success("Success!")} Added DevRev objects: ${objectsToAdd.join(", ")}`
      )
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })

// Add external sync units subcommand
config
  .command("add-external")
  .description("add external sync units to configuration")
  .argument("[units...]", "external sync units to add")
  .option("-y, --yes", "skip confirmation prompt.", false)
  .option("-s, --silent", "mute output.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (units, opts) => {
    try {
      const options = configOptionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        ...opts,
      })

      // Check if project config exists
      if (!(await hasSnapInConfig(options.cwd))) { // Renamed
        logger.error("No project configuration found. Run 'init' first.") // Updated message
        process.exit(1)
      }

      let unitsToAdd = units
      if (!unitsToAdd?.length) {
        unitsToAdd = await promptForExternalSyncUnits(options)
      }

      if (!unitsToAdd?.length) {
        logger.warn("No sync units selected.")
        return
      }

      if (!options.yes) {
        const { proceed } = await prompts({
          type: "confirm",
          name: "proceed",
          message: `Add ${unitsToAdd.join(", ")} to external sync units?`,
          initial: true,
        })

        if (!proceed) {
          process.exit(0)
        }
      }

      const configSpinner = spinner("Adding external sync units...").start()
      await addExternalSyncUnitsToSnapInConfig(options.cwd, unitsToAdd) // Renamed
      
      // Regenerate types
      const configResult = await getSnapInConfig(options.cwd) // Renamed, get result object
      const config = configResult.validatedConfig; // Extract validatedConfig
      if (config) {
        await generateTypeDefinitions(options.cwd, config)
      } else {
        logger.warn(`Could not regenerate types due to invalid configuration. Error: ${configResult.error?.message}`);
      }
      
      configSpinner.succeed()
      
      logger.log(
        `${highlighter.success("Success!")} Added external sync units: ${unitsToAdd.join(", ")}`
      )
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
      if (!(await hasSnapInConfig(cwd))) { // Renamed
        logger.error("No project configuration found. Run 'init' first.") // Updated message
        process.exit(1)
      }

      const configResult = await getSnapInConfig(cwd) // Renamed, get result object
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
      if (config.connection) {
        logger.info(`${highlighter.info("Connection Type:")} ${config.connection.type}`)
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

// Regenerate types
config
  .command("types")
  .description("regenerate TypeScript definition files")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd)

      // Check if project config exists
      if (!(await hasSnapInConfig(cwd))) { // Renamed
        logger.error("No project configuration found. Run 'init' first.") // Updated message
        process.exit(1)
      }

      const configResult = await getSnapInConfig(cwd) // Renamed, get result object
      const config = configResult.validatedConfig; // Extract validatedConfig
      if (!config) {
        logger.error(`Failed to load project configuration. Cannot regenerate types. Error: ${configResult.error?.message}`) // Updated message
        process.exit(1)
      }

      const typesSpinner = spinner("Regenerating TypeScript definitions...").start()
      await generateTypeDefinitions(cwd, config)
      typesSpinner.succeed()

      logger.log(`${highlighter.success("Success!")} TypeScript definitions regenerated.`)
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })

async function promptForDevRevObjects(
  options: z.infer<typeof configOptionsSchema>
): Promise<string[]> {
  const configResult = await getSnapInConfig(options.cwd) // Renamed, get result object
  const config = configResult.validatedConfig; // Extract validatedConfig
  if (!config) {
    logger.warn(`Could not load project configuration to suggest DevRev objects. Error: ${configResult.error?.message}`);
    return []
  }

  const existingObjects = new Set(config.devrevObjects || []) // Added fallback for optional array
  const availableObjects = SUPPORTED_DEVREV_OBJECTS.filter(
    obj => !existingObjects.has(obj)
  )

  if (availableObjects.length === 0) {
    logger.warn("All supported DevRev objects are already configured.")
    return []
  }

  const { objects } = await prompts({
    type: "multiselect",
    name: "objects",
    message: "Which DevRev objects would you like to add?",
    hint: "Space to select. A to toggle all. Enter to submit.",
    choices: availableObjects.map(obj => ({
      title: obj,
      value: obj,
      selected: false,
    })),
  })

  return objects || []
}

async function promptForExternalSyncUnits(
  options: z.infer<typeof configOptionsSchema>
): Promise<string[]> {
  const { units } = await prompts({
    type: "list",
    name: "units",
    message: "Enter external sync units to add (comma-separated):",
    initial: "",
    separator: ",",
  })

  return units || []
} 