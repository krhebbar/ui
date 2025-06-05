import path from "path"
import prompts from "prompts"
import { findProjectRoot } from "@/src/utils/preflight/project-root"
import { initOptionsSchema } from "@/src/commands/init"
import * as ERRORS from "@/src/utils/errors"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import fs from "fs-extra"
import { z } from "zod"

export async function preFlightInit(
  options: z.infer<typeof initOptionsSchema>
) {
  const errors: Record<string, boolean> = {}

  // Ensure target directory exists.
  if (!fs.existsSync(options.cwd)) {
    errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] = true
    return {
      errors,
      projectInfo: null,
    }
  }

  const projectSpinner = spinner(`Preflight checks.`, {
    silent: options.silent,
  }).start()

  const projectRoot = findProjectRoot(options.cwd)

  if (projectRoot && projectRoot !== options.cwd) {
    projectSpinner?.stop() // Stop spinner before prompting
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
    // If user says no, continue in current dir, spinner can be restarted or kept stopped.
    // For now, let's assume we want to restart it if other checks follow.
    projectSpinner?.start()
  }

  // Verify if the current or resolved projectRoot is a valid project directory
  const currentPathToCheck = projectRoot || options.cwd
  const manifestPath = path.join(currentPathToCheck, "manifest.yml")
  const codePath = path.join(currentPathToCheck, "code")

  if (!fs.existsSync(manifestPath) || !fs.existsSync(codePath)) {
    projectSpinner?.fail()
    logger.error(
      `This command must be run from the root of a Snap-in or Editor project (i.e., where manifest.yml and code/ directory exist).`
    )
    logger.info(
      `This command should be run from the root of your Snap-in/Editor project.`
    )
    process.exit(1)
  }
  
  projectSpinner?.succeed(
    `Preflight checks passed. Found ${highlighter.info("manifest.yml")} and ${highlighter.info("code/")} at ${currentPathToCheck}.`
  )

  return {
    errors,
    projectInfo: null, // We'll update this when we refactor get-project-info.ts
  }
}
