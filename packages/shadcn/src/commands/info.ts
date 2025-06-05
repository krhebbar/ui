import path from "path"
import { getProjectInfo } from "@/src/utils/get-project-info"
// Removed getAirdropConfig, added hasSnapInConfig and getSnapInConfig
import { hasSnapInConfig, getSnapInConfig } from "@/src/utils/airdrop-config";
import { ZodError } from "zod"; // Added ZodError import
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
    // logger.info("> Project info") // Updated message
    // console.log(await getProjectInfo(opts.cwd))
    // logger.break()
    
    logger.info("> Project configuration (snapin.config.mjs)") // Updated message
    const configResult = await getSnapInConfig(opts.cwd);

    if (configResult.validatedConfig) {
      console.log(configResult.validatedConfig);
    } else if (configResult.rawConfig && configResult.error) {
      logger.warn("Could not fully validate snapin.config.mjs. This might be due to unset environment variables or schema mismatches.");
      logger.warn("Displaying raw configuration as loaded from the file:");
      console.log(configResult.rawConfig);
      if (configResult.error instanceof ZodError) {
        logger.warn("Validation issues summary:");
        configResult.error.errors.forEach(err => {
          logger.warn(`  - Path: ${err.path.join('.') || '.'}, Issue: ${err.message}`);
        });
      } else {
         logger.warn(`Error details: ${configResult.error.message}`);
      }
    } else if (configResult.error) {
        logger.error(`Failed to load snapin.config.mjs: ${configResult.error.message}`);
    } else {
        logger.warn("No snapin.config.mjs found or it's empty. Run 'init' to create one.");
    }
  })
