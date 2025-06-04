import path from "path"
import { getProjectInfo } from "@/src/utils/get-project-info"
// Removed getAirdropConfig, added hasSnapInConfig and getSnapInConfig
import { hasSnapInConfig, getSnapInConfig } from "@/src/utils/airdrop-config";
import { logger } from "@/src/utils/logger"
import { Command } from "commander"

export const info = new Command()
  .name("info")
  .description("get information about your project") // Updated description
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    logger.info("> Project info") // Updated message
    console.log(await getProjectInfo(opts.cwd))
    logger.break()
    
    logger.info("> Project configuration (snapin.config.mjs)") // Updated message
    if (await hasSnapInConfig(opts.cwd)) {
      const config = await getSnapInConfig(opts.cwd);
      if (config) {
        console.log(config);
      } else {
        logger.error("Could not load snapin.config.mjs.");
      }
    } else {
      logger.warn("No snapin.config.mjs found. Run 'init' to create one.");
    }
  })
