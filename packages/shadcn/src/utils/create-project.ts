import os from "os"
import path from "path"
import { initOptionsSchema } from "@/src/commands/init"
import { fetchRegistry } from "@/src/registry/api"
import { getPackageManager } from "@/src/utils/get-package-manager"
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { execa } from "execa"
import fs from "fs-extra"
import prompts from "prompts"
import { z } from "zod"

const AIRDROP_TEMPLATE_URL = "https://github.com/devrev/airdrop-template"

export const TEMPLATES = {
  airdrop: "airdrop",
} as const

export async function createProject(
  options: Pick<
    z.infer<typeof initOptionsSchema>,
    "cwd" | "force" | "srcDir" | "components" | "template"
  >
) {
  options = {
    srcDir: false,
    ...options,
  }

  let template: keyof typeof TEMPLATES = "airdrop"
  let projectName: string = "my-airdrop-project"

  if (!options.force) {
    const { name } = await prompts([
      {
        type: "text",
        name: "name",
        message: "What is your airdrop project named?",
        initial: projectName,
        format: (value: string) => value.trim(),
        validate: (value: string) =>
          value.length > 128
            ? `Name should be less than 128 characters.`
            : true,
      },
    ])

    projectName = name
  }

  const packageManager = await getPackageManager(options.cwd, {
    withFallback: true,
  })

  const projectPath = `${options.cwd}/${projectName}`

  // Check if path is writable.
  try {
    await fs.access(options.cwd, fs.constants.W_OK)
  } catch (error) {
    logger.break()
    logger.error(`The path ${highlighter.info(options.cwd)} is not writable.`)
    logger.error(
      `It is likely you do not have write permissions for this folder or the path ${highlighter.info(
        options.cwd
      )} does not exist.`
    )
    logger.break()
    process.exit(1)
  }

  if (fs.existsSync(path.resolve(options.cwd, projectName, "manifest.yaml"))) {
    logger.break()
    logger.error(
      `A project with the name ${highlighter.info(projectName)} already exists.`
    )
    logger.error(`Please choose a different name and try again.`)
    logger.break()
    process.exit(1)
  }

  await createAirdropProject(projectPath, {
    packageManager,
  })

  return {
    projectPath,
    projectName,
    template,
  }
}

async function createAirdropProject(
  projectPath: string,
  options: {
    packageManager: string
  }
) {
  const createSpinner = spinner(
    `Creating a new airdrop project from template. This may take a few minutes.`
  ).start()

  try {
    // Clone the airdrop template repository
    await execa("git", ["clone", AIRDROP_TEMPLATE_URL, projectPath])

    // Remove the .git directory to start fresh
    await fs.remove(path.join(projectPath, ".git"))

    // Install dependencies in the code directory
    const codeDir = path.join(projectPath, "code")
    if (fs.existsSync(codeDir)) {
      await execa(options.packageManager, ["install"], {
        cwd: codeDir,
      })
    }

    // Initialize a new git repository
    await execa("git", ["init"], { cwd: projectPath })
    await execa("git", ["add", "-A"], { cwd: projectPath })
    await execa("git", ["commit", "-m", "Initial commit from airdrop template"], {
      cwd: projectPath,
    })

    createSpinner?.succeed("Creating a new airdrop project.")
  } catch (error) {
    createSpinner?.fail("Something went wrong creating a new airdrop project.")
    handleError(error)
  }
}
