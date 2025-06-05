import path from "path"
import prompts from "prompts"
import { findProjectRoot } from "@/src/utils/preflight/project-root"
import { addOptionsSchema } from "@/src/commands/add"
import * as ERRORS from "@/src/utils/errors"
import { getConfig } from "@/src/utils/get-config"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import fs from "fs-extra"
import { z } from "zod"

export async function preFlightAdd(options: z.infer<typeof addOptionsSchema>) {
  const errors: Record<string, boolean> = {}

  // Ensure target directory itself exists.
  if (!fs.existsSync(options.cwd)) {
    errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] = true
    return {
      errors,
      config: null,
    }
  }

  let currentCwd = options.cwd
  const projectRoot = findProjectRoot(options.cwd)

  if (!projectRoot) {
    logger.error(
      `This command must be run from the root of a Snap-in or Editor project (i.e., where manifest.yml and code/ directory exist).`
    )
    logger.info(
      `This command should be run from the root of your Snap-in/Editor project.`
    )
    process.exit(1)
  }

  if (projectRoot !== options.cwd) {
    const response = await prompts({
      type: "confirm",
      name: "switchDir",
      message: `We found a valid Snap-in/Editor project at: ${projectRoot}. Do you want to switch to this directory and run the command from there? (y/N)`,
      initial: false,
    })

    if (response.switchDir) {
      logger.info(
        `This command should be run from the root of your Snap-in/Editor project.`
      )
      logger.info(
        `Please change your current directory to ${projectRoot} and try again.`
      )
      process.exit(0)
    }
    // User chose not to switch, currentCwd remains options.cwd
    // The command will likely fail when getConfig is called, which is acceptable.
  } else {
    // projectRoot is options.cwd, so we are in the correct root directory
    currentCwd = projectRoot
  }

  // At this point, currentCwd is either the confirmed project root
  // or options.cwd if the user declined to switch from a sub-directory.

  try {
    const config = await getConfig(currentCwd)

    if (!config) {
      logger.break()
      logger.error(
        `Unable to read airdrop project configuration from ${highlighter.info(
          "manifest.yml"
        )} at ${highlighter.info(
          currentCwd // Use currentCwd
        )}.\nBefore you can add items, you must create a valid airdrop project by running the ${highlighter.info("init")} command.`
      )
      logger.break()
      process.exit(1)
    }

    return {
      errors,
      config,
    }
  } catch (error) {
    logger.break()
    logger.error(
      `An invalid airdrop project was found at ${highlighter.info(
        currentCwd // Use currentCwd
      )}.\nBefore you can add items, you must create a valid airdrop project by running the ${highlighter.info("init")} command.`
    )
    logger.break()
    process.exit(1)
  }
}
