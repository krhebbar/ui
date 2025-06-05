import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import { listSnapInPackages } from "../../utils/devrev-cli-wrapper";

export const packageList = new Command()
  .name("list")
  .description("List all Snap-in packages using devrev-cli.")
  .action(async () => {
    logger.info("Fetching list of Snap-in packages...");

    try {
      const packages = await listSnapInPackages();
      if (packages && packages.length > 0) {
        logger.info("Available Snap-in packages:");
        // Output as JSON array, or format nicely if preferred
        console.log(JSON.stringify(packages, null, 2));
      } else {
        logger.info("No Snap-in packages found.");
      }
    } catch (error: any) {
      logger.error("Failed to list Snap-in packages.");
      if (error.message.includes("DevRev CLI command failed")) {
        logger.error("It seems 'devrev' CLI is not installed or not found in your PATH.");
        logger.error("Please install it and try again. Visit https://docs.devrev.ai/product/cli for installation instructions.");
      } else {
        logger.error(`An unexpected error occurred: ${error.message}`);
        if (error.stderr) {
            logger.error(`DevRev CLI Error Output: ${error.stderr}`);
        }
      }
      process.exit(1);
    }
  });
