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
  .option("-y, --yes", "skip confirmation prompt.", true)
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

  // Configuration is derived from manifest.yml and project structure
  const configSpinner = spinner(`Reading airdrop project configuration.`).start()
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
