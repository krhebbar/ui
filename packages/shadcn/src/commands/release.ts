import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import {
  validateManifest,
  createSnapInVersion,
  updateSnapIn,
  draftSnapIn,
  activateSnapIn,
  getSnapInContext,
} from "../utils/devrev-cli-wrapper";
import { getProjectInfo } from "@/src/utils/get-project-info";
import inquirer from "inquirer";

export const release = new Command()
  .name("release")
  .description("Validates, creates a new version, deploys (updates or drafts), and activates a Snap-in.")
  .action(async () => {
    logger.info("Starting Smart Snap-in Release Process...");

    // (a) Get Project Information & Manifest Path
    const projectInfo = await getProjectInfo(process.cwd());
    if (!projectInfo || !projectInfo.manifestPath) {
      logger.error("Manifest file not found or project info could not be loaded. A manifest (e.g., manifest.yaml) is required in your project root for release.");
      process.exit(1);
    }
    logger.info(`Using manifest file: ${projectInfo.manifestPath}`);
    const codePathForCreate = projectInfo.codePath || "./"; // Default to current directory if codePath is not in projectInfo

    // (b) Validate Manifest
    logger.info("Validating Snap-in manifest...");
    try {
      await validateManifest(projectInfo.manifestPath);
      logger.info("Manifest validated successfully.");
    } catch (error: any) {
      logger.error("Manifest validation failed.");
      logger.error(error.message || "Unknown validation error");
      if(error.stderr) logger.error(`CLI Error: ${error.stderr}`);
      process.exit(1);
    }

    // (c) Create New Snap-in Version
    let newVersionInfo: any;
    logger.info("Creating new Snap-in version...");
    try {
      let packageIdForCreate;
      try {
        const context = await getSnapInContext();
        if (context.snap_in_package_id) {
          packageIdForCreate = context.snap_in_package_id;
          logger.info(`Using package ID from context for version creation: ${packageIdForCreate}`);
        }
      } catch (contextError: any) {
        logger.warn(`Could not get package ID from context: ${contextError.message}. Will rely on slug from manifest if creating a new package.`);
      }

      const newVersionOptions: {
        manifestPath: string;
        createPackage: boolean;
        packageId?: string;
      } = {
        manifestPath: projectInfo.manifestPath,
        createPackage: true, // Always attempt to create package if not found by slug/id
      };

      if (packageIdForCreate) {
        newVersionOptions.packageId = packageIdForCreate;
      } else if (projectInfo.slug && projectInfo.slug !== "unknown-snapin-slug") {
        logger.info(`No package ID in context. DevRev CLI will use slug '${projectInfo.slug}' from manifest to find or create package.`);
        // The CLI itself handles using the slug from the manifest when createPackage is true and no packageId is given.
      }


      newVersionInfo = await createSnapInVersion(codePathForCreate, newVersionOptions);
      logger.info(`Snap-in version created successfully: ${newVersionInfo.id}`);
      console.log(JSON.stringify(newVersionInfo, null, 2));
    } catch (error: any) {
      logger.error("Failed to create Snap-in version.");
      logger.error(error.message || "Unknown error during version creation");
      if(error.stderr) logger.error(`CLI Error: ${error.stderr}`);
      process.exit(1);
    }

    // (d) Attempt to Update (Upgrade) Existing Snap-in
    let snapInToActivateId;
    let snapInUrl;
    let updatedSuccessfully = false;

    logger.info("Attempting to update existing Snap-in with the new version...");
    try {
      const context = await getSnapInContext();
      if (context.snap_in_id) {
        logger.info(`Found existing Snap-in ID in context: ${context.snap_in_id}. Attempting update...`);
        const updatedSnapIn = await updateSnapIn(context.snap_in_id, newVersionInfo.id);
        logger.info(`Existing Snap-in (ID: ${context.snap_in_id}) updated successfully to version ${newVersionInfo.id}.`);
        console.log(JSON.stringify(updatedSnapIn, null, 2));
        snapInToActivateId = context.snap_in_id;
        snapInUrl = updatedSnapIn.url; // Assuming updateSnapIn returns the updated snap-in object with a URL
        updatedSuccessfully = true;
      } else {
        logger.info("No Snap-in ID found in current context. Will proceed to draft a new Snap-in.");
      }
    } catch (updateError: any) {
      logger.warn(`Failed to update existing Snap-in: ${updateError.message}. Proceeding to draft a new Snap-in.`);
      if(updateError.stderr) logger.warn(`CLI Error (update): ${updateError.stderr}`);
    }

    // (e) Fallback to Draft New Snap-in (if update failed or no existing Snap-in)
    if (!updatedSuccessfully) {
      logger.info("Drafting Snap-in with the new version...");
      try {
        const draftInfo = await draftSnapIn(newVersionInfo.id);
        logger.info("Snap-in drafted successfully:");
        console.log(JSON.stringify(draftInfo, null, 2));
        snapInToActivateId = draftInfo.id;
        snapInUrl = draftInfo.url;
      } catch (error: any) {
        logger.error("Failed to draft Snap-in.");
        logger.error(error.message || "Unknown error during drafting");
        if(error.stderr) logger.error(`CLI Error: ${error.stderr}`);
        process.exit(1);
      }
    }

    // (f) Activation
    if (!snapInToActivateId) {
      logger.error("Could not determine Snap-in ID for activation. This should not happen.");
      process.exit(1);
    }

    if (snapInUrl) {
        logger.info(`The Snap-in interface can be previewed at: ${snapInUrl}`);
    } else {
        logger.warn("Snap-in URL could not be determined from the previous steps.");
    }

    try {
        const { activate } = await inquirer.prompt([
            {
            type: "confirm",
            name: "activate",
            message: `Do you want to activate this Snap-in (ID: ${snapInToActivateId})? This will make it live.`,
            default: true,
            },
        ]);

        if (activate) {
            logger.info(`Activating Snap-in ID '${snapInToActivateId}'...`);
            const activationResult = await activateSnapIn(snapInToActivateId);
            logger.info("Snap-in activation status:");
            console.log(JSON.stringify(activationResult, null, 2)); // Assuming JSON, adjust if plain string
            logger.info(`Snap-in (ID: ${snapInToActivateId}) is now active with version ${newVersionInfo.id}.`);
        } else {
            logger.info("Snap-in activation skipped by user.");
            logger.info(`To activate later, run: devrev snap_in activate ${snapInToActivateId}`);
        }
    } catch (error: any) {
        logger.error("Failed during activation step.");
        logger.error(error.message || "Unknown error during activation");
        if(error.stderr) logger.error(`CLI Error: ${error.stderr}`);
        process.exit(1);
    }

    logger.info("Smart Snap-in Release Process completed.");
  });
