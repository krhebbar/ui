import path from "path"
import {
  getAirdropConfig,
  hasAirdropConfig,
  addDevRevObjects,
  addExternalSyncUnits,
  updateAirdropConfig,
} from "@/src/utils/airdrop-config"
import { generateTypeDefinitions } from "@/src/utils/type-generator"
import { SUPPORTED_DEVREV_OBJECTS } from "@/src/type/airdrop-config"
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
  .description("manage airdrop project configuration")

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

      // Check if airdrop config exists
      if (!(await hasAirdropConfig(options.cwd))) {
        logger.error("No airdrop configuration found. Run 'init' first.")
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
      await addDevRevObjects(options.cwd, objectsToAdd)
      
      // Regenerate types
      const config = await getAirdropConfig(options.cwd)
      if (config) {
        await generateTypeDefinitions(options.cwd, config)
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

      // Check if airdrop config exists
      if (!(await hasAirdropConfig(options.cwd))) {
        logger.error("No airdrop configuration found. Run 'init' first.")
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
      await addExternalSyncUnits(options.cwd, unitsToAdd)
      
      // Regenerate types
      const config = await getAirdropConfig(options.cwd)
      if (config) {
        await generateTypeDefinitions(options.cwd, config)
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
  .description("show current airdrop configuration")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd)

      // Check if airdrop config exists
      if (!(await hasAirdropConfig(cwd))) {
        logger.error("No airdrop configuration found. Run 'init' first.")
        process.exit(1)
      }

      const config = await getAirdropConfig(cwd)
      if (!config) {
        logger.error("Failed to load airdrop configuration.")
        process.exit(1)
      }

      logger.info("Current Airdrop Configuration:")
      logger.break()
      
      logger.info(`${highlighter.info("Project Type:")} ${config.projectType}`)
      logger.info(`${highlighter.info("Sync Direction:")} ${config.syncDirection}`)
      logger.info(`${highlighter.info("External System:")} ${config.externalSystem.name} (${config.externalSystem.slug})`)
      logger.info(`${highlighter.info("API Base URL:")} ${config.externalSystem.apiBaseUrl}`)
      logger.info(`${highlighter.info("Connection Type:")} ${config.connection.type}`)
      
      logger.break()
      logger.info(`${highlighter.info("DevRev Objects:")} ${config.devrevObjects.join(", ")}`)
      logger.info(`${highlighter.info("External Sync Units:")} ${config.externalSyncUnits.join(", ")}`)
      
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

      // Check if airdrop config exists
      if (!(await hasAirdropConfig(cwd))) {
        logger.error("No airdrop configuration found. Run 'init' first.")
        process.exit(1)
      }

      const config = await getAirdropConfig(cwd)
      if (!config) {
        logger.error("Failed to load airdrop configuration.")
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
  const config = await getAirdropConfig(options.cwd)
  if (!config) {
    return []
  }

  const existingObjects = new Set(config.devrevObjects)
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