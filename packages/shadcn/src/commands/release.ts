import { Command } from "commander";
import { logger } from "@/src/utils/logger"; // Adjust path
import {
  draftSnapIn,
  activateSnapIn,
  getSnapInContext,
  showSnapInVersion,
} from "../utils/devrev-cli-wrapper";
import inquirer from "inquirer";

export const release = new Command()
  .name("release")
  .description("Drafts and activates a Snap-in version on the DevRev platform using devrev-cli.")
  .option("-v, --version-id <id>", "ID of the Snap-in version to release. If not provided, context or prompt will be used.")
  .action(async (options: { versionId?: string }) => {
    logger.info("Starting Snap-in release process using devrev-cli...");

    let { versionId } = options;

    try {
      if (!versionId) {
        logger.info("Attempting to get Snap-in version from context...");
        const context = await getSnapInContext();
        if (context.snap_in_version_id) {
          versionId = context.snap_in_version_id;
          logger.info(`Using Snap-in version ID from context: ${versionId}`);

          const confirmContextVersion = await inquirer.prompt([
            {
                type: "confirm",
                name: "useContextVersion",
                message: `Context reports current version ID as ${versionId}. Do you want to release this version?`,
                default: true,
            }
          ]);
          if (!confirmContextVersion.useContextVersion) {
            versionId = undefined; // Clear to prompt user below
          } else {
            // Optionally show details of this version
            try {
                const versionDetails = await showSnapInVersion(versionId);
                logger.info("Details of the version from context:");
                console.log(JSON.stringify(versionDetails, null, 2));
            } catch (e:any) {
                logger.warn(`Could not fetch details for version ${versionId}: ${e.message}`);
            }
          }
        } else {
          logger.info("No Snap-in version ID found in context.");
        }
      }

      if (!versionId) {
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "versionId",
            message: "Enter the ID of the Snap-in version you want to release (e.g., from 'devrev snap_in_version list' or the output of the 'build' command):",
            validate: (input) => input ? true : "Snap-in version ID cannot be empty.",
          },
        ]);
        versionId = answers.versionId;
      }

      logger.info(`Proceeding to draft Snap-in version ID: ${versionId}`);

      // 1. Draft the Snap-in using the specified version
      logger.info("Drafting Snap-in...");
      const draftInfo = await draftSnapIn(versionId);
      logger.info("Snap-in drafted successfully:");
      console.log(JSON.stringify(draftInfo, null, 2));
      logger.info(`You can view the drafted interface at: ${draftInfo.url}`);

      const snapInIdToActivate = draftInfo.id;
      if (!snapInIdToActivate) {
        logger.error("Failed to get Snap-in ID from draft response.");
        process.exit(1);
      }

      // 2. Prompt for activation
      const activationPrompt = await inquirer.prompt([
        {
          type: "confirm",
          name: "activate",
          message: `Do you want to activate this drafted Snap-in (ID: ${snapInIdToActivate})? This will make it live.`,
          default: false, // Default to false for safety in a release command
        },
      ]);

      if (activationPrompt.activate) {
        logger.info(`Activating Snap-in ID '${snapInIdToActivate}'...`);
        const activationResult = await activateSnapIn(snapInIdToActivate);
        logger.info("Snap-in activation status:");
        // Assuming activationResult is a string or simple JSON. Adjust if it's more complex.
        console.log(typeof activationResult === 'object' ? JSON.stringify(activationResult, null, 2) : activationResult);
        logger.info(`Snap-in (ID: ${snapInIdToActivate}) associated with version ${versionId} is now active.`);
      } else {
        logger.info("Snap-in activation skipped by user.");
        logger.info(`To activate later, run: devrev snap_in activate ${snapInIdToActivate}`);
      }

      logger.info("Snap-in release process complete.");

    } catch (error: any) {
      logger.error("Failed during Snap-in release process.");
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
