import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import { getSnapInContext } from "../../utils/devrev-cli-wrapper";

export const contextShow = new Command()
  .name("show")
  .description("Show the current Snap-in context using devrev-cli.")
  .action(async () => {
    logger.info("Fetching current Snap-in context...");

    try {
      const contextInfo = await getSnapInContext();
      if (contextInfo && (contextInfo.snap_in_id || contextInfo.snap_in_package_id || contextInfo.snap_in_version_id)) {
        logger.info("Current Snap-in context:");
        // The getSnapInContext wrapper already attempts to parse the output.
        // However, the raw output of `devrev snap_in_context show` is not JSON but key-value pairs.
        // The wrapper tries to create a JSON-like object.
        console.log(JSON.stringify(contextInfo, null, 2));
      } else {
        // This case might occur if the context is empty or parsing failed in a way not throwing an error
        logger.info("No active Snap-in context found or context is empty.");
        logger.info("Raw output from CLI (if any was captured by wrapper and returned as empty object):");
        console.log(JSON.stringify(contextInfo, null, 2));
      }
    } catch (error: any) {
      logger.error("Failed to get Snap-in context.");
      if (error.message.includes("DevRev CLI command failed")) {
        logger.error("It seems 'devrev' CLI is not installed or not found in your PATH.");
        logger.error("Please install it and try again. Visit https://docs.devrev.ai/product/cli for installation instructions.");
      } else if (error.message.includes("No active context found")) {
         logger.error("Error: No active Snap-in context is currently set in DevRev CLI.");
         logger.info("You can list available contexts with 'devrev context list' and set one with 'devrev context checkout <name>'.");
      } else {
        logger.error(`An unexpected error occurred: ${error.message}`);
        if (error.stderr) {
            logger.error(`DevRev CLI Error Output: ${error.stderr}`);
        }
      }
      process.exit(1);
    }
  });
