import { Command } from "commander";
import { logger } from "@/src/utils/logger"; // Adjust path if necessary
import { getAirdropProjectValidation } from "@/src/utils/get-project-info";
import { ProjectInfo as ValidationProjectInfo } from "@/src/types/project-info";
import { validateEnv, EnvValidationResult } from "../utils/validation/env";
import { validateDependencies, DepsValidationResult } from "../utils/validation/deps";
import { validateDevRev, DevRevValidationResult } from "../utils/validation/devrev";
import { COMMAND_PLACEHOLDERS, CLI_NAME } from "@/src/utils/validation/constants";
import path from "path"; // Ensure path is imported
import fs from "fs-extra"; // Ensure fs-extra is imported

export const doctor = new Command()
  .name("doctor")
  .description("Check for potential issues with your environment or project setup.")
  .option("--fix", "Attempt to automatically fix simple issues.", false)
  .option(
    "--project-type <type>",
    "Specify project type (airdrop or snap-in) to tailor checks.",
    "airdrop" // Default to 'airdrop'
  )
  .action(async (options) => {
    logger.info(`Running ${CLI_NAME} doctor...`);
    logger.break();

    let overallSuccess = true;
    const issuesFound: string[] = [];
    let identifiedProjectRoot: string | null = null;

    // 1. Validate Project Root & Structure
    const projectValidationCwd = process.cwd();
    logger.info("Checking project structure and manifest...");
    const projectInfo: ValidationProjectInfo = await getAirdropProjectValidation(projectValidationCwd);
    identifiedProjectRoot = projectInfo.rootPath; // Store identified root path

    if (projectInfo.isValid) {
      logger.success(`Project at ${projectInfo.rootPath} appears valid.`);
      if (projectInfo.isAtRoot === false) {
        logger.warn("Note: You are running doctor from a subdirectory. Checks are performed relative to the detected root.");
      }
      projectInfo.reasons.forEach(reason => {
        if (reason.startsWith("Optional:")) {
          logger.info(reason);
        } else if (reason !== "Project structure and manifest are valid.") {
             logger.info(`Project check: ${reason}`);
        }
      });
    } else {
      logger.error(`Project validation failed at ${projectValidationCwd}:`);
      projectInfo.reasons.forEach(reason => {
        logger.error(`- ${reason}`);
        issuesFound.push(`Project: ${reason}`);
      });
      overallSuccess = false;
      logger.warn("Attempting to continue with environment checks despite project issues...");
    }
    logger.break();

    // 2. Validate .env file
    logger.info("Checking .env file...");
    const envResult: EnvValidationResult = await validateEnv(identifiedProjectRoot, options.fix);
    logger.info(envResult.summary);
    if (!envResult.isValid) {
      overallSuccess = false;
      envResult.issues.forEach(issue => {
        logger.error(`- Env: ${issue}`);
        issuesFound.push(`Env: ${issue}`);
      });
    }
    logger.break();

    // 3. Validate Dependencies
    logger.info("Checking required dependencies...");
    const depsResult: DepsValidationResult = await validateDependencies(options.fix);
    // Summary is already logged by validateDependencies
    if (!depsResult.isValid) {
      overallSuccess = false;
      // Detailed issues already logged by validateDependencies, just add to issuesFound for summary
      depsResult.issues.forEach(issue => issuesFound.push(`Deps: ${issue}`));
    }
    logger.break();

    // 4. Validate DevRev Access/Config (Stub)
    if (projectInfo.isValid || options.projectType === 'airdrop') {
      logger.info("Checking DevRev connection/configuration (stub)...");
      const devrevResult: DevRevValidationResult = await validateDevRev(projectInfo, options.fix);
      logger.info(devrevResult.summary);
      if (!devrevResult.isValid) {
        overallSuccess = false;
        devrevResult.issues.forEach(issue => {
            logger.warn(`- DevRev (Stub): ${issue}`); // Warn because it's a stub
            issuesFound.push(`DevRev (Stub): ${issue}`);
        });
      }
      logger.break();
    }

    // 5. Check snapin.config.mjs
    if (identifiedProjectRoot) { // Use identifiedProjectRoot
        logger.info("Checking snapin.config.mjs...");
        const configPath = path.join(identifiedProjectRoot, "snapin.config.mjs"); // Use path.join
        try {
            if (await fs.pathExists(configPath)) { // Check existence first
                 await import(configPath); // Dynamic import to check loadability
                 logger.success("snapin.config.mjs exists and is loadable.");
            } else {
                logger.warn("snapin.config.mjs not found at project root. This may be expected for some project types or if not yet configured.");
                // Optionally make this an error for 'airdrop' type if projectInfo.isValid was true
                if (options.projectType === 'airdrop' && projectInfo.isValid) {
                    // issuesFound.push("Config: snapin.config.mjs not found for a valid Airdrop project.");
                    // overallSuccess = false; // Decide if this is a failure condition
                }
            }
        } catch (e: any) {
            logger.error(`Failed to load snapin.config.mjs: ${e.message}`);
            issuesFound.push(`Config: Failed to load snapin.config.mjs - ${e.message}`);
            overallSuccess = false;
        }
        logger.break();
    }

    // Summary
    logger.break();
    if (overallSuccess) {
      logger.success(`${CLI_NAME} Doctor finished. No critical issues found!`);
    } else {
      logger.error(`${CLI_NAME} Doctor found the following issues:`);
      issuesFound.forEach(issue => logger.error(`- ${issue}`));
      logger.info("Please review the messages above and try to fix the issues.");
      if (!options.fix) {
        logger.info(`You can try running '${CLI_NAME} doctor --fix' to attempt automatic fixes for some issues.`);
      }
      process.exit(1);
    }
  });
