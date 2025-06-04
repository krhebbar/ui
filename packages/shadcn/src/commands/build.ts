import { Command } from "commander";
import { logger } from "@/src/utils/logger"; // Adjust path
import { getAirdropProjectValidation } from "@/src/utils/get-project-info"; // Adjust path
import { ProjectInfo as ValidationProjectInfo } from "@/src/types/project-info"; // Adjust path
import { COMMAND_PLACEHOLDERS, CLI_NAME } from "@/src/config/constants"; // Adjust path
import { getConfig } from "@/src/utils/get-config"; // To load airdrop.config.mjs

export const build = new Command()
  .name("build")
  .description("Perform a local build of your Airdrop project or Snap-in.")
  .action(async (options) => {
    logger.info(`Running ${CLI_NAME} build...`);
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
        logger.warn(`You are running '${CLI_NAME} build' from a subdirectory. Executing in the context of the project root: ${projectInfo.rootPath}`);
        // Ensure build scripts are run from projectInfo.rootPath
    }

    logger.info(`Project root identified at: ${projectInfo.rootPath}`);

    // Attempt to load airdrop.config.mjs
    try {
      const airdropConfig = await getConfig(projectInfo.rootPath);
      if (!airdropConfig) {
        logger.error("Failed to load airdrop.config.mjs. This file might be needed for build configurations.");
        // Decide if this is a fatal error for build; for now, just a warning
        logger.warn("Continuing build without airdrop.config.mjs, but it might be required.");
      } else {
        logger.info("Successfully loaded airdrop.config.mjs.");
        // You can now use airdropConfig if needed by the build logic
      }
    } catch (e: any) {
      logger.error(`Error loading airdrop.config.mjs: ${e.message}`);
      // Decide if this is fatal; for now, just a warning
      logger.warn("Continuing build despite error loading airdrop.config.mjs, but it might be required.");
    }

    logger.info(COMMAND_PLACEHOLDERS.build);
    logger.break();
    logger.info("This is a stub command. Actual build functionality will be implemented here.");
    logger.info("For example, this might involve running a bundler (like tsc, esbuild, webpack) and creating a distributable archive.");

    // Future implementation:
    // - Read build scripts from package.json or airdrop.config.mjs
    // - Execute build commands (e.g., `npm run build` or custom bundling logic)
    // - Output artifacts to a 'dist' or 'build' folder
    // - Create a compressed archive (e.g., .zip or .tar.gz) for release
  });
