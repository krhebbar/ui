import { Command } from "commander";
import { logger } from "@/src/utils/logger"; // Adjust path
// import { getAirdropProjectValidation } from "@/src/utils/get-project-info"; // Adjust path
// import { ProjectInfo as ValidationProjectInfo } from "@/src/types/project-info"; // Adjust path
// import { COMMAND_PLACEHOLDERS, CLI_NAME } from "@/src/config/constants"; // Adjust path
// import { getConfig } from "@/src/utils/get-config"; // To load snapin.config.mjs
import { getSnapInLogs } from "../utils/devrev-cli-wrapper";
import { getProjectInfo } from "@/src/utils/get-project-info";
import { bootstrapDevRevAuth } from "@/src/utils/devrev-auth";

export const logs = new Command()
  .name("logs")
  .description("Fetch execution logs for your Snap-in using devrev-cli.")
  .option("--after <timestamp>", "Fetch logs after a specific timestamp (e.g., 2023-10-26T10:00:00Z or 1h, 10m).")
  .option("--before <timestamp>", "Fetch logs before a specific timestamp (e.g., 2023-10-26T10:00:00Z or 1h, 10m).")
  .option("--filters <json_string>", "JSON string for filtering logs (e.g., '{\"key\":\"value\"}').")
  .option("-l, --limit <number>", "Number of log entries to retrieve.", (value) => parseInt(value, 10), 100)
  .action(async (options: {
    after?: string;
    before?: string;
    filters?: string;
    limit?: number;
  }) => {
    logger.info("Attempting to retrieve project information (for consistency)...");
    const projectInfo = await getProjectInfo(process.cwd());

    if (projectInfo) {
      logger.info(`Project Name (context): ${projectInfo.name}`);
      // Slug and manifestPath are not directly used by getSnapInLogs wrapper,
      // but good to show they are accessible if needed for other commands.
    } else {
      logger.warn("Could not retrieve local project information from manifest.yaml. This is usually not critical for 'logs' command.");
    }

    logger.info("Fetching Snap-in logs using devrev-cli...");

    // Bootstrap DevRev authentication using PAT
    logger.info("🔐 Ensuring DevRev authentication...");
    const authResult = await bootstrapDevRevAuth(process.cwd());
    if (!authResult.success) {
      logger.error(`❌ Authentication failed: ${authResult.message}`);
      logger.info("💡 Make sure your .env file contains USER_EMAIL, DEV_ORG, and DEVREV_PAT");
      process.exit(1);
    }

    try {
      const logOptions: {
        after?: string;
        before?: string;
        filters?: string;
        limit?: number;
      } = {};

      if (options.after) logOptions.after = options.after;
      if (options.before) logOptions.before = options.before;
      if (options.filters) logOptions.filters = options.filters;
      if (options.limit !== undefined) logOptions.limit = options.limit;

      const logsOutput = await getSnapInLogs(logOptions);

      if (logsOutput && logsOutput.length > 0) {
        logger.info("Logs retrieved successfully:");
        // Assuming logsOutput is an array of log entries (JSON objects or strings)
        // Adjust formatting as needed based on the actual structure of logsOutput
        logsOutput.forEach((logEntry: any, index: number) => {
          if (typeof logEntry === 'object') {
            console.log(JSON.stringify(logEntry, null, 2));
          } else {
            console.log(logEntry);
          }
        });
      } else {
        logger.info("No logs found for the given criteria.");
      }
      
      logger.info("✅ Logs retrieved successfully!");
      process.exit(0);
    } catch (error: any) {
      logger.error("Failed to fetch Snap-in logs.");
      if (error.message.includes("DevRev CLI command failed")) {
        logger.error("It seems 'devrev' CLI is not installed or not found in your PATH.");
        logger.error("Please install it and try again. Visit https://docs.devrev.ai/product/cli for installation instructions.");
      } else if (error.message.includes("snap_in_package_id not found in context")) {
        logger.error("Snap-in package ID not found in the current DevRev context.");
        logger.error("Please ensure you are in a directory with a valid DevRev Snap-in project or configure your context.");
      }
      else {
        logger.error(`An unexpected error occurred: ${error.message}`);
      }
      // Optionally, re-throw or exit if it's a critical failure
      // process.exit(1);
    }
  });
