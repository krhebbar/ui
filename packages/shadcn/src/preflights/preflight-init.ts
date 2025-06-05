import path from "path"
import prompts from "prompts"
import { findProjectRoot } from "@/src/utils/preflight/project-root"
import { initOptionsSchema } from "@/src/commands/init"
import * as ERRORS from "@/src/utils/errors"
// import { highlighter } from "@/src/utils/highlighter" // Not used directly in new logic for success message
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import fs from "fs-extra"
import { z } from "zod"

export async function preFlightInit(
  options: z.infer<typeof initOptionsSchema>
) {
  const errors: Record<string, boolean> = {}
  const projectSpinner = spinner(`Preflight checks for init...`, {
    silent: options.silent,
  }).start()

  // Ensure target directory exists.
  // Check for empty project. We assume if no manifest.yaml or manifest.yml exists, the project is empty.
  const manifestYamlPath = path.resolve(options.cwd, "manifest.yaml");
  const manifestYmlPath = path.resolve(options.cwd, "manifest.yml");

  // Check for empty project. We assume if no manifest.yaml or manifest.yml exists, the project is empty.
  const manifestYamlPath = path.resolve(options.cwd, "manifest.yaml");
  const manifestYmlPath = path.resolve(options.cwd, "manifest.yml");

  if (
    !fs.existsSync(options.cwd) ||
    (!fs.existsSync(manifestYamlPath) && !fs.existsSync(manifestYmlPath))
    (!fs.existsSync(manifestYamlPath) && !fs.existsSync(manifestYmlPath))
  ) {
    errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] = true
    projectSpinner?.fail("Target directory does not exist.")
    return {
      errors,
      projectRootPath: options.cwd,
      isExistingProjectStructure: false,
      manifestFileExists: false,
      configFileExists: false,
      isDirectoryEmpty: false, // Or true, depending on desired default for non-existent dir
    }
  }

  let effectivePath = options.cwd
  const resolvedRootCandidate = findProjectRoot(options.cwd)

  if (resolvedRootCandidate && resolvedRootCandidate !== options.cwd) {
    projectSpinner?.stop() // Stop spinner before prompting
    const response = await prompts({
      type: "confirm",
      name: "switchDir",
      message: `We found a valid Snap-in/Editor project at: ${resolvedRootCandidate}. Do you want to switch to this directory and run the command from there? (y/N)`,
      initial: false,
    })

    if (response.switchDir) {
      logger.info(
        `This command should be run from the root of your Snap-in/Editor project.`
      )
      logger.info(
        `Please change your current directory to ${resolvedRootCandidate} and try again.`
      )
      process.exit(0)
    }
    // User declined to switch, effectivePath remains options.cwd
    projectSpinner?.start() // Restart spinner if needed
  } else {
    effectivePath = resolvedRootCandidate || options.cwd
  }

  // Determine project state at effectivePath
  const manifestPathYml = path.join(effectivePath, "manifest.yml")
  const manifestPathYaml = path.join(effectivePath, "manifest.yaml")
  const codePathDir = path.join(effectivePath, "code")
  const snapInConfigPath = path.join(effectivePath, "snapin.config.mjs")

  const manifestFileExists =
    fs.existsSync(manifestPathYml) || fs.existsSync(manifestPathYaml)
  const codeDirExists =
    fs.existsSync(codePathDir) && fs.lstatSync(codePathDir).isDirectory()
  const configFileExists = fs.existsSync(snapInConfigPath)
  const isExistingProjectStructure = manifestFileExists && codeDirExists

  let isDirectoryEmpty = false
  try {
    const filesInEffectivePath = fs.readdirSync(effectivePath)
    isDirectoryEmpty =
      filesInEffectivePath.length === 0 ||
      (filesInEffectivePath.length === 1 &&
        filesInEffectivePath[0] === ".git")
  } catch (e) {
    // This might happen if effectivePath is somehow invalid after all, though unlikely here
    logger.warn(`Could not read directory contents of ${effectivePath}: ${e.message}`)
    // Keep isDirectoryEmpty as false
  }
  
  if (Object.keys(errors).length > 0) {
     // This condition would typically be met by the initial cwd check only now
    projectSpinner?.fail(`Preflight checks failed.`)
  } else {
    projectSpinner?.succeed(
      `Preflight checks complete. Target directory: ${effectivePath}`
    )
  }

  return {
    errors,
    projectRootPath: effectivePath,
    isExistingProjectStructure,
    manifestFileExists,
    configFileExists,
    isDirectoryEmpty,
  }
}
