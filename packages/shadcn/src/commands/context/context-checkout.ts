import { Command } from "commander";
import { logger } from "@/src/utils/logger";
import { checkoutSnapInContext, listSnapInContexts } from "../../utils/devrev-cli-wrapper";
import prompts from "prompts";

export const contextCheckout = new Command()
  .name("checkout")
  .description("Checkout (set as active) a Snap-in context using devrev-cli.")
  .argument("[context_name]", "The name of the context to checkout.")
  .action(async (contextNameArg?: string) => {
    let contextName = contextNameArg;

    try {
      if (!contextName) {
        logger.info("Fetching available contexts for selection...");
        const availableContexts = await listSnapInContexts();
        if (!availableContexts || availableContexts.length === 0) {
          logger.warn("No Snap-in contexts available to checkout. You might need to create or sync contexts first.");
          process.exit(0);
        }

        const answers = await prompts([
          {
            type: "select",
            name: "contextName",
            message: "Select the Snap-in context to checkout:",
            choices: availableContexts.map((context: string) => ({
              title: context,
              value: context
            })),
          },
        ]);
        contextName = answers.contextName;
      }

      if (!contextName) {
        logger.error("No context name provided or selected.");
        process.exit(1);
      }

      // Remove the " (current)" marker if present from listSnapInContexts output
      contextName = contextName.replace(" (current)", "").trim();

      logger.info(`Checking out Snap-in context: ${contextName}...`);
      const result = await checkoutSnapInContext(contextName);
      logger.info("Snap-in context checkout successful:");
      console.log(result); // Display confirmation message from CLI
    } catch (error: any) {
      logger.error(`Failed to checkout Snap-in context '${contextName || ''}'.`);
      if (error.message.includes("DevRev CLI command failed")) {
        logger.error("It seems 'devrev' CLI is not installed or not found in your PATH.");
        logger.error("Please install it and try again. Visit https://docs.devrev.ai/product/cli for installation instructions.");
      } else if (error.message.includes("not found")) {
         logger.error(`Error: Snap-in context '${contextName}' not found.`);
         logger.info("You can list available contexts with 'devrev context list'.");
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
