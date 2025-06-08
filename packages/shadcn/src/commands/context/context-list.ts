import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import { listSnapInContexts } from "../../utils/devrev-cli-wrapper";
import { bootstrapDevRevAuth } from "@/src/utils/devrev-auth";

export const contextList = new Command()
  .name("list")
  .description("List all available Snap-in contexts using devrev-cli.")
  .action(async () => {
    logger.info("Fetching list of available Snap-in contexts...");

    // Bootstrap DevRev authentication using PAT
    logger.info("🔐 Ensuring DevRev authentication...");
    const authResult = await bootstrapDevRevAuth(process.cwd());
    if (!authResult.success) {
      logger.error(`❌ Authentication failed: ${authResult.message}`);
      logger.info("💡 Make sure your .env file contains USER_EMAIL, DEV_ORG, and DEVREV_PAT");
      process.exit(1);
    }

    try {
      const contexts = await listSnapInContexts();
      if (contexts && contexts.length > 0) {
        logger.info("Available Snap-in contexts:");
        contexts.forEach((contextName) => {
          // Check if context is marked as current by devrev CLI output convention
          if (contextName.endsWith(" (current)")) {
            logger.info(`  ${contextName}`);
          } else {
            console.log(`  ${contextName}`);
          }
        });
      } else {
        logger.info("No Snap-in contexts found or defined.");
      }
      
      logger.info("✅ Context list retrieved successfully!");
      process.exit(0);
    } catch (error: any) {
      logger.error("Failed to list Snap-in contexts.");
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
