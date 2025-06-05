import { Command } from "commander";
import { logger } from "@/src/utils/logger"; // Adjust path
// import { getAirdropProjectValidation } from "@/src/utils/get-project-info"; // Adjust path
// import { ProjectInfo as ValidationProjectInfo } from "@/src/types/project-info"; // Adjust path
// import { COMMAND_PLACEHOLDERS, CLI_NAME } from "@/src/config/constants"; // Adjust path
// import { getConfig } from "@/src/utils/get-config"; // To load airdrop.config.mjs
import { createSnapInVersion, getSnapInContext } from "../utils/devrev-cli-wrapper";
import { getProjectInfo } from "@/src/utils/get-project-info";
import inquirer from "inquirer";

export const build = new Command()
  .name("build")
  .description("Creates a new Snap-in version using devrev-cli.")
  .option("-p, --path <path_to_code>", "Path to the Snap-in code (e.g., './build', './dist', or './').")
  .option("--package-id <id>", "ID of the Snap-in package to associate this version with.")
  .option("--manifest <path_to_manifest>", "Path to the Snap-in manifest file (if not in the root of code path).")
  .option("--archive <path_to_archive>", "Path to a pre-built archive (e.g., .zip, .tar.gz) instead of a code path.")
  .option("--create-package", "Create a new package if the specified package ID or slug is not found.")
  .action(async (options: {
    path?: string;
    packageId?: string;
    manifestPath?: string;
    archivePath?: string;
    createPackage?: boolean;
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

    logger.info("Creating Snap-in version using devrev-cli...");

    let { path, packageId, manifestPath, archivePath, createPackage } = options;

    // Use manifestPath from projectInfo if available and not overridden by options
    if (projectInfo?.manifestPath && !manifestPath) {
      logger.info(`Using manifest path from project information: ${projectInfo.manifestPath}`);
      manifestPath = projectInfo.manifestPath;
    }

    if (!path && !archivePath) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "pathOrArchive",
          message: "Enter the path to your Snap-in code/distributables or a pre-built archive:",
          validate: (input) => input ? true : "Path or archive cannot be empty.",
        },
        {
            type: "list",
            name: "type",
            message: "Is this a path to code/distributables or a pre-built archive?",
            choices: ["Code Path", "Archive Path"],
        }
      ]);
      if (answers.type === "Code Path") {
        path = answers.pathOrArchive;
      } else {
        archivePath = answers.pathOrArchive;
      }
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
          const pkgAnswers = await inquirer.prompt([
            {
              type: "input",
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
        logger.warn("Could not automatically determine Snap-in package ID from context. Proceeding without it or with --create-package if specified.");
      }
    } else if (packageId && createPackage) {
        logger.info(`Both --package-id ('${packageId}') and --create-package are specified. DevRev CLI will attempt to use the ID, and create if not found.`);
    }


    // Prompt for manifestPath only if not provided by options and not found via projectInfo
    if (!manifestPath) { // manifestPath would be set if projectInfo.manifestPath existed
        const manifestAnswers = await inquirer.prompt([
            {
                type: "input",
                name: "manifestPath",
                message: "Enter the path to your Snap-in manifest file (e.g., manifest.yaml, default is auto-detected by CLI if left blank):",
                default: "", // CLI will auto-detect if empty
            }
        ]);
        if (manifestAnswers.manifestPath) manifestPath = manifestAnswers.manifestPath;
    } else {
        logger.info(`Using manifest path: ${manifestPath}`);
    }

    try {
      const versionOptions: {
        packageId?: string;
        manifestPath?: string;
        archivePath?: string;
        createPackage?: boolean;
        testingUrl?: string; // Not used in build, but part of the wrapper's options
      } = {};

      if (packageId) versionOptions.packageId = packageId;
      if (manifestPath) versionOptions.manifestPath = manifestPath;
      if (archivePath) versionOptions.archivePath = archivePath;
      if (createPackage) versionOptions.createPackage = createPackage;

      // Path is a mandatory first argument for createSnapInVersion if not archivePath
      const finalPath = archivePath ? "" : path!; // Path must be defined if archivePath is not

      if (!finalPath && !archivePath) {
        logger.error("Either a code path or an archive path must be provided.");
        process.exit(1);
      }

      logger.info(`Calling devrev snap_in_version create-one with path: '${finalPath || archivePath}'...`);
      const versionInfo = await createSnapInVersion(finalPath, versionOptions);

      logger.info("Snap-in version created successfully:");
      console.log(JSON.stringify(versionInfo, null, 2));
    } catch (error: any) {
      logger.error("Failed to create Snap-in version.");
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
