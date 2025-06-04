import path from "path"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { getAirdropConfig } from "@/src/utils/airdrop-config"
import { logger } from "@/src/utils/logger"
import { Command } from "commander"

export const info = new Command()
  .name("info")
  .description("get information about your airdrop project")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    logger.info("> airdrop project info")
    console.log(await getProjectInfo(opts.cwd))
    logger.break()
    
    logger.info("> airdrop project configuration")
    try {
      // Try to read the raw config first, then validate
      const configPath = path.join(opts.cwd, "airdrop.config.mjs")
      const configModule = await import(configPath)
      console.log(configModule.default)
    } catch (error) {
      logger.warn("No airdrop.config.mjs found. Run 'shadcn init' to create one.")
    }
  })
