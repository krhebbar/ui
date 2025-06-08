import path from "path"
import { Command } from "commander"
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { readSnapinConfig, hasSnapinConfig } from "@/src/utils/project-config"
import { generateTypeDefinitions } from "@/src/utils/generators/type-generator"

export const generateTypes = new Command()
  .name("generate-types")
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
      if (!(await hasSnapinConfig(cwd))) {
        logger.error("No project configuration found. Run 'shadcn init' first.")
        process.exit(1)
      }

      const configResult = await readSnapinConfig(cwd)
      const config = configResult.validatedConfig
      if (!config) {
        logger.error(`Failed to load project configuration. Cannot regenerate types. Error: ${configResult.error?.message}`)
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
