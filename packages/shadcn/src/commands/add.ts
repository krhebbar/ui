import path from "path"
import { runInit } from "@/src/commands/init"
import { preFlightAdd } from "@/src/preflights/preflight-add"
import { getRegistryIndex } from "@/src/registry/api"
import { addItems } from "@/src/utils/add-item"

import * as ERRORS from "@/src/utils/errors"
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { Command } from "commander"
import prompts from "prompts"
import { z } from "zod"

export const addOptionsSchema = z.object({
  components: z.array(z.string()).optional(),
  yes: z.boolean(),
  overwrite: z.boolean(),
  cwd: z.string(),
  silent: z.boolean(),
})

export const add = new Command()
  .name("add")
  .description("add a component to your airdrop project")
  .argument(
    "[components...]",
    "the items to add or a url to the item."
  )
  .option("-y, --yes", "skip confirmation prompt.", false)
  .option("-o, --overwrite", "overwrite existing files.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .option("-s, --silent", "mute output.", false)
  .action(async (components, opts) => {
    try {
      const options = addOptionsSchema.parse({
        components,
        cwd: path.resolve(opts.cwd),
        ...opts,
      })

      // Configure logger based on silent flag
      logger.setSilent(options.silent)

      if (!options.components?.length) {
        options.components = await promptForRegistryComponents(options)
      }

      let { errors, config } = await preFlightAdd(options)

      // No project found. Prompt the user to run init.
      if (errors[ERRORS.MISSING_CONFIG]) {
        const { proceed } = await prompts({
          type: "confirm",
          name: "proceed",
          message: `You need to create a project to add items. Proceed?`,
          initial: true,
        })

        if (!proceed) {
          logger.break()
          process.exit(1)
        }

        config = await runInit({
          cwd: options.cwd,
          yes: true,
          force: options.overwrite,
          skipPreflight: false,
          silent: true,
          isNewProject: true,
          components: options.components,
        })
      }

      if (errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT]) {
        config = await runInit({
          cwd: options.cwd,
          yes: true,
          force: options.overwrite,
          skipPreflight: false,
          silent: true,
          isNewProject: true,
          components: options.components,
        })
        
        if (!config) {
          logger.break()
          logger.error("Failed to initialize project for adding components.")
          process.exit(1)
        }
      }

      if (!config) {
        throw new Error(
          `Failed to read manifest file at ${highlighter.info(options.cwd)}.`
        )
      }

      await addItems(options.components, config, options)
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })

async function promptForRegistryComponents(
  options: z.infer<typeof addOptionsSchema>
) {
  const registryIndex = await getRegistryIndex()
  if (!registryIndex) {
    logger.break()
    handleError(new Error("Failed to fetch registry index."))
    return []
  }

  if (options.components?.length) {
    return options.components
  }

  const { components } = await prompts({
    type: "multiselect",
    name: "components",
    message: "Which items would you like to add?",
    hint: "Space to select. A to toggle all. Enter to submit.",
    instructions: false,
    choices: registryIndex
      .filter(
        (entry) =>
          (entry.type === "registry:block" || entry.type === "registry:file")
      )
      .map((entry) => ({
        title: entry.name,
        value: entry.name,
        selected: false,
      })),
  })

  if (!components?.length) {
    logger.warn("No items selected. Exiting.")
    logger.info("")
    process.exit(1)
  }

  const result = z.array(z.string()).safeParse(components)
  if (!result.success) {
    logger.error("")
    handleError(new Error("Something went wrong. Please try again."))
    return []
  }
  return result.data
}
