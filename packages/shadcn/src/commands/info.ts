import { getConfig } from "@/src/utils/get-config"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { logger } from "@/src/utils/logger"
import { Command } from "commander"

export const info = new Command()
  .name("info")
  .description("get information about your project")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    logger.info("> airdrop project info")
    console.log(await getProjectInfo(opts.cwd))
    logger.break()
    logger.info("> project configuration")
    console.log(await getConfig(opts.cwd))
  })
