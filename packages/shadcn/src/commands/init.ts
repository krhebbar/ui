import path from "path"
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { Command } from "commander"
import { z } from "zod"

// Import the modular runInit function
import { runInit as runInitModular } from "./init/index"

export const initOptionsSchema = z.object({
  cwd: z.string(),
  components: z.array(z.string()).optional(),
  yes: z.boolean(),
  force: z.boolean(),
  silent: z.boolean(),
  isNewProject: z.boolean(),
  authType: z.enum(["oauth", "pat"]).optional().describe("Specify the authentication type for Airdrop projects (oauth or pat), or Snap-in authentication strategy if applicable."),
  projectType: z.enum(["airdrop", "snapin"]).optional().describe("Specify the type of project to initialize (airdrop or snapin)."),
  templateName: z.string().optional().describe("Specify the name of the Snap-in template to use."),
  projectName: z.string().min(1, "Project name cannot be empty.").optional().describe("Specify the name for the project directory."),
  externalSystemName: z.string().optional().describe("Specify the name of the external system for the project."),
  accessMethod: z.enum(["api", "sdk"]).optional().describe("Specify how the external system will be accessed (api or sdk)."),
  connectionType: z.enum(["oauth", "secret"]).optional().describe("Specify the type of connection for the external system (oauth or secret)."),
  documentationUrl: z.string().url().optional().describe("Specify the documentation URL for the external system."),
  syncDirection: z.enum(["one-way", "two-way"]).optional().describe("Specify the sync direction for the airdrop project (one-way or two-way)."),
})

export const init = new Command()
  .name("init")
  .description("Initialize your airdrop project and install dependencies")
  .option("--project-name <name>", "name for the project directory")
  .option("--project-type <type>", "type of project to initialize (airdrop or snapin)")
  .option("--template-name <name>", "name of the Snap-in template to use")
  .option("--external-system-name <name>", "name of the external system for the project")
  .option("--access-method <method>", "how the external system will be accessed (api or sdk)")
  .option("--connection-type <type>", "type of connection for the external system (oauth or secret)")
  .option("--documentation-url <url>", "documentation URL for the external system")
  .option("--sync-direction <direction>", "sync direction for airdrop projects (one-way or two-way)")
  .option("-y, --yes", "skip confirmation prompt.", false)
  .option("-f, --force", "force overwrite of existing configuration.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .option("-s, --silent", "mute output.", false)
  .option("--auth-type <type>", "authentication type for Airdrop projects (oauth or pat) or Snap-in authentication strategy")
  .action(async (opts) => {
    try {
      const options = initOptionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        isNewProject: false,
        ...opts,
      })

      // Configure logger based on silent flag
      logger.setSilent(options.silent)

      await runInit(options)

      logger.log(
        `${highlighter.success(
          "Success!"
          )} Airdrop project initialization completed.\nYou may now add items.`
      )
      logger.break()
    } catch (error) {
      logger.break()
      handleError(error)
    }
  })

export async function runInit(
  options: z.infer<typeof initOptionsSchema> & {
    skipPreflight?: boolean;
  }
) {
  // Use the modular implementation
  return await runInitModular(options);
}
