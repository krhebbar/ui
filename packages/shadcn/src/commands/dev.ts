import { Command } from "commander";
import { logger } from "@/src/utils/logger"; // Adjust path
import { getAirdropProjectValidation } from "@/src/utils/get-project-info"; // Adjust path
import { ProjectInfo as ValidationProjectInfo } from "@/src/types/project-info"; // Adjust path
import { COMMAND_PLACEHOLDERS, CLI_NAME } from "@/src/config/constants"; // Adjust path
import { getConfig } from "@/src/utils/get-config"; // To load airdrop.config.mjs

export const dev = new Command()
  .name("dev")
  .description("Start the local development server for your Airdrop project or Snap-in.")
  .action(async (options) => {
    logger.info(`Running ${CLI_NAME} dev...`);
    logger.break();

    const projectValidationCwd = process.cwd();
    const projectInfo: ValidationProjectInfo = await getAirdropProjectValidation(projectValidationCwd);

    if (!projectInfo.isValid || !projectInfo.rootPath) {
      logger.error("Failed to validate project or project root not found.");
      projectInfo.reasons.forEach(reason => logger.error(`- ${reason}`));
      logger.info(`Please ensure you are in a valid Airdrop project or run '${CLI_NAME} doctor' for diagnostics.`);
      process.exit(1);
    }

    if (projectInfo.isAtRoot === false) {
        logger.warn(`You are running '${CLI_NAME} dev' from a subdirectory. Executing in the context of the project root: ${projectInfo.rootPath}`);
        // Potentially change CWD for the dev server process or inform the user to navigate to root.
    }

    logger.info(`Project root identified at: ${projectInfo.rootPath}`);

    // Attempt to load airdrop.config.mjs
    try {
      const airdropConfig = await getConfig(projectInfo.rootPath); // getConfig expects root path
      if (!airdropConfig) {
        logger.error("Failed to load airdrop.config.mjs. This file is required for the dev command.");
        process.exit(1);
      }
      logger.info("Successfully loaded airdrop.config.mjs.");
      // You can now use airdropConfig if needed by the dev server logic
    } catch (e: any) {
      logger.error(`Error loading airdrop.config.mjs: ${e.message}`);
      process.exit(1);
    }

    logger.info(COMMAND_PLACEHOLDERS.dev);
    logger.break();
    logger.info("This is a stub command. Actual dev server functionality will be implemented here.");
    logger.info("For example, this might start a Chef server or a custom Node.js server based on your project type.");

    // Future implementation:
    // - Determine project type (Airdrop, Snap-in) from manifest or airdrop.config.mjs
    // - Start the appropriate local development server (e.g., using adaas-chef-cli for Airdrops)
    // - Handle port forwarding, hot reloading, etc.
  });
