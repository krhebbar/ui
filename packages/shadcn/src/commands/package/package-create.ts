import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import { createSnapInPackage } from "../../utils/devrev-cli-wrapper";
import prompts from "prompts";

export const packageCreate = new Command()
  .name("create")
  .description("Create a new Snap-in package using devrev-cli.")
  .option("-s, --slug <slug_name>", "The slug name for the new package.")
  .action(async (options: { slug?: string }) => {
    logger.info("Attempting to create a new Snap-in package...");

    let { slug } = options;

    if (!slug) {
      const answers = await prompts([
        {
          type: "text",
          name: "slug",
          message: "Enter the slug name for the new Snap-in package:",
          validate: (input: string) => {
            if (!input) return "Slug name cannot be empty.";
            // Basic slug validation (lowercase, numbers, hyphens)
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input)) {
              return "Slug must be lowercase alphanumeric with hyphens only (e.g., my-snapin-package).";
            }
            return true;
          },
        },
      ]);
      slug = answers.slug;
    }

    try {
      logger.info(`Creating Snap-in package with slug: ${slug}...`);
      const packageInfo = await createSnapInPackage(slug!); // slug will be defined here due to prompt
      logger.info("Snap-in package created successfully:");
      console.log(JSON.stringify(packageInfo, null, 2));
    } catch (error: any) {
      logger.error("Failed to create Snap-in package.");
      if (error.message.includes("DevRev CLI command failed")) {
        logger.error("It seems 'devrev' CLI is not installed or not found in your PATH.");
        logger.error("Please install it and try again. Visit https://docs.devrev.ai/product/cli for installation instructions.");
      } else if (error.message.includes("already exists")) {
        logger.error(`Error: A Snap-in package with slug '${slug}' already exists.`);
      }
      else {
        logger.error(`An unexpected error occurred: ${error.message}`);
        if (error.stderr) {
            logger.error(`DevRev CLI Error Output: ${error.stderr}`);
        }
      }
      process.exit(1);
    }
  });
