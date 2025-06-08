import { Command } from "commander";
import { logger } from "@/src/utils/logger"; // Adjust path
import {
  createSnapInVersion,
  draftSnapIn,
  activateSnapIn,
  getSnapInContext,
} from "../utils/devrev-cli-wrapper";
import { getProjectInfo } from "@/src/utils/get-project-info";
import { bootstrapDevRevAuth } from "@/src/utils/devrev-auth";
import prompts from "prompts";

export const dev = new Command()
  .name("dev")
  .description("Develop and test your Snap-in with a local forwarding URL using devrev-cli.")
  .option("-p, --path <path_to_code>", "Path to the Snap-in code (e.g., './src', './dist').")
  .option("-u, --url <testing_url>", "The ngrok or similar forwarding URL for local testing.")
  .option("--package-id <id>", "ID of the Snap-in package; context will be used if not provided.")
  .option("--create-package", "Create a new package if the specified package ID or slug (from manifest) is not found.")
  .option("--manifest <path_to_manifest>", "Path to the Snap-in manifest file.")
  .action(async (options: {
    path?: string;
    url?: string;
    packageId?: string;
    createPackage?: boolean;
    manifestPath?: string;
  }) => {
    logger.info("Attempting to retrieve project information...");
    const projectInfo = await getProjectInfo(process.cwd());

    if (projectInfo) {
      logger.info(`Project Name: ${projectInfo.name}`);
      logger.info(`Project Slug: ${projectInfo.slug}`);
      logger.info(`Manifest Path: ${projectInfo.manifestPath}`);
    } else {
      logger.warn("Could not retrieve project information from manifest.yaml. Proceeding with prompts or defaults.");
    }

    logger.info("Starting Snap-in development and testing workflow using devrev-cli...");

    // Bootstrap DevRev authentication using PAT
    logger.info("🔐 Ensuring DevRev authentication...");
    const authResult = await bootstrapDevRevAuth(process.cwd());
    if (!authResult.success) {
      logger.error(`❌ Authentication failed: ${authResult.message}`);
      logger.info("💡 Make sure your .env file contains USER_EMAIL, DEV_ORG, and DEVREV_PAT");
      process.exit(1);
    }

    let { path, url, packageId, createPackage, manifestPath } = options;

    // Use manifestPath from projectInfo if available and not overridden by options
    if (projectInfo?.manifestPath && !manifestPath) {
      logger.info(`Using manifest path from project information: ${projectInfo.manifestPath}`);
      manifestPath = projectInfo.manifestPath;
    }

    if (!path) {
      const pathAnswers = await prompts([
        {
          type: "text",
          name: "path",
          message: "Enter the path to your Snap-in code/distributables:",
          initial: "./",
          validate: (input: string) => input ? true : "Path cannot be empty.",
        },
      ]);
      path = pathAnswers.path;
    }

    if (!url) { // URL is specific to dev command, always prompt if not given
      const urlAnswers = await prompts([
        {
          type: "text",
          name: "url",
          message: "Enter your ngrok or other forwarding URL for testing:",
          validate: (input: string) => {
            if (!input) return "URL cannot be empty.";
            if (!input.startsWith("http://") && !input.startsWith("https://")) {
                return "URL must start with http:// or https://";
            }
            return true;
          }
        },
      ]);
      url = urlAnswers.url;
    }

    // Handle packageId and createPackage logic
    if (!packageId && createPackage && projectInfo?.slug && projectInfo.slug !== "unknown-snapin-slug") {
      logger.info(`Option --create-package is set and no --package-id was provided.`);
      logger.info(`The slug '${projectInfo.slug}' from your manifest.yaml will be used by the DevRev CLI to identify or create the package.`);
      // No need to prompt for packageId, CLI will use the slug.
    } else if (!packageId && !createPackage) {
      try {
        const context = await getSnapInContext();
        if (context.snap_in_package_id) {
          logger.info(`Using Snap-in package ID from current context: ${context.snap_in_package_id}`);
          packageId = context.snap_in_package_id;
        } else {
          // Prompt only if not creating a package with a slug
          const pkgAnswers = await prompts([
            {
              type: "text",
              name: "packageId",
              message: "Enter the Snap-in package ID (leave blank if --create-package is used with a manifest slug):",
            }
          ]);
          if (pkgAnswers.packageId) packageId = pkgAnswers.packageId;
          else if (!createPackage) {
             logger.warn("No package ID provided and --create-package is not set. The CLI might require a package context or slug in manifest.");
          }
        }
      } catch (error: any) {
        logger.warn("Could not automatically determine Snap-in package ID from context. You may need to use --package-id or --create-package.");
      }
    } else if (packageId && createPackage) {
        logger.info(`Both --package-id ('${packageId}') and --create-package are specified. DevRev CLI will attempt to use the ID, and create if not found.`);
    }

    // Prompt for manifestPath only if not provided by options and not found via projectInfo
    if (!manifestPath) { // manifestPath would be set if projectInfo.manifestPath existed
        const manifestAnswers = await prompts([
            {
                type: "text",
                name: "manifestPath",
                message: "Enter the path to your Snap-in manifest file (e.g., manifest.yaml, default is auto-detected by CLI if left blank):",
                initial: "", // CLI will auto-detect if empty
            }
        ]);
        if (manifestAnswers.manifestPath) manifestPath = manifestAnswers.manifestPath;
    } else {
        logger.info(`Using manifest path: ${manifestPath}`);
    }

    try {
      // 1. Create a Snap-in Version with testing URL
      logger.info(`Creating Snap-in version with path '${path}' and testing URL '${url}'...`);
      const versionOptions: any = { testingUrl: url };
      if (packageId) versionOptions.packageId = packageId;
      if (manifestPath) versionOptions.manifestPath = manifestPath;
      if (createPackage) versionOptions.createPackage = createPackage;


      const versionInfo = await createSnapInVersion(path!, versionOptions);
      logger.info("Snap-in test version created successfully:");
      console.log(JSON.stringify(versionInfo, null, 2));

      const snapInVersionId = versionInfo.id;
      if (!snapInVersionId) {
        logger.error("Failed to get Snap-in Version ID from creation response.");
        process.exit(1);
      }

      // 2. Draft the Snap-in using the new version
      logger.info(`Drafting Snap-in with version ID '${snapInVersionId}'...`);
      const draftInfo = await draftSnapIn(snapInVersionId);
      logger.info("Snap-in drafted successfully:");
      console.log(JSON.stringify(draftInfo, null, 2));
      logger.info(`You can view the drafted interface at: ${draftInfo.url}`);

      const snapInId = draftInfo.id;
      if (!snapInId) {
        logger.error("Failed to get Snap-in ID from draft response.");
        process.exit(1);
      }

      // 3. Activate the Snap-in
      const activationPrompt = await prompts([
        {
            type: "confirm",
            name: "activate",
            message: `Do you want to activate this Snap-in (ID: ${snapInId}) for testing?`,
            initial: true,
        }
      ]);

      if (activationPrompt.activate) {
        logger.info(`Activating Snap-in ID '${snapInId}'...`);
        const activationResult = await activateSnapIn(snapInId);
        logger.info("Snap-in activation status:");
        console.log(activationResult); // Output might be a simple string confirmation
        logger.info(`Snap-in (ID: ${snapInId}) associated with version ${snapInVersionId} should now be active with testing URL: ${url}`);
      } else {
        logger.info("Snap-in activation skipped by user.");
        logger.info(`To activate later, run: devrev snap_in activate ${snapInId}`);
      }

      logger.info("Local development setup complete. Your Snap-in should be routing to your local server via the provided URL.");
      logger.info("Remember to keep your local server and forwarding service (e.g., ngrok) running.");
      
      logger.info("✅ Dev setup completed successfully!");
      process.exit(0);

    } catch (error: any) {
      logger.error("Failed during Snap-in development workflow.");
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
