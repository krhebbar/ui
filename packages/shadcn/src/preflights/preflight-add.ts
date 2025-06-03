import path from "path"
import { addOptionsSchema } from "@/src/commands/add"
import * as ERRORS from "@/src/utils/errors"
import { getConfig } from "@/src/utils/get-config"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import fs from "fs-extra"
import { z } from "zod"

export async function preFlightAdd(options: z.infer<typeof addOptionsSchema>) {
  const errors: Record<string, boolean> = {}

  // Ensure target directory exists.
  // Check for airdrop project structure. We assume if no manifest.yml exists, the project is empty.
  if (
    !fs.existsSync(options.cwd) ||
    !fs.existsSync(path.resolve(options.cwd, "manifest.yml"))
  ) {
    errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] = true
    return {
      errors,
      config: null,
    }
  }

  // Check for airdrop project structure.
  if (!fs.existsSync(path.resolve(options.cwd, "code"))) {
    errors[ERRORS.MISSING_CONFIG] = true
    return {
      errors,
      config: null,
    }
  }

  try {
    const config = await getConfig(options.cwd)

    if (!config) {
      logger.break()
      logger.error(
        `Unable to read airdrop project configuration from ${highlighter.info(
          "manifest.yml"
        )} at ${highlighter.info(
          options.cwd
        )}.\nBefore you can add components, you must create a valid airdrop project by running the ${highlighter.info("init")} command.`
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
        options.cwd
      )}.\nBefore you can add components, you must create a valid airdrop project by running the ${highlighter.info("init")} command.`
    )
    logger.break()
    process.exit(1)
  }
}
