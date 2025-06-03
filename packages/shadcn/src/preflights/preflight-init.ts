import path from "path"
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
  // Check for empty project. We assume if no manifest.yaml exists, the project is empty.
  if (
    !fs.existsSync(options.cwd) ||
    !fs.existsSync(path.resolve(options.cwd, "manifest.yaml"))
  ) {
    errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] = true
    return {
      errors,
      projectInfo: null,
    }
  }

  const projectSpinner = spinner(`Preflight checks.`, {
    silent: options.silent,
  }).start()

  if (
    fs.existsSync(path.resolve(options.cwd, "components.json")) &&
    !options.force
  ) {
    projectSpinner?.fail()
    logger.break()
    logger.error(
      `A ${highlighter.info(
        "components.json"
      )} file already exists at ${highlighter.info(
        options.cwd
      )}.\nTo start over, remove the ${highlighter.info(
        "components.json"
      )} file and run ${highlighter.info("init")} again.`
    )
    logger.break()
    process.exit(1)
  }

  projectSpinner?.succeed()

  const manifestSpinner = spinner(`Verifying airdrop project.`, {
    silent: options.silent,
  }).start()
  
  // Check if this is a valid airdrop project by looking for manifest.yaml and code directory
  const manifestPath = path.resolve(options.cwd, "manifest.yaml")
  const codePath = path.resolve(options.cwd, "code")
  
  if (!fs.existsSync(manifestPath) || !fs.existsSync(codePath)) {
    manifestSpinner?.fail()
    logger.break()
    logger.error(
      `This does not appear to be a valid airdrop project at ${highlighter.info(
        options.cwd
      )}.\n` +
        `Expected to find ${highlighter.info("manifest.yaml")} and ${highlighter.info("code/")} directory.`
    )
    logger.break()
    process.exit(1)
  }
  
  manifestSpinner?.succeed(
    `Verifying airdrop project. Found ${highlighter.info("manifest.yaml")}.`
  )

  return {
    errors,
    projectInfo: null, // We'll update this when we refactor get-project-info.ts
  }
}
