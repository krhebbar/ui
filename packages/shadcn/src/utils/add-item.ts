import {
  registryResolveItemsTree,
} from "@/src/registry/api"
import {
  configSchema,
  type Config,
} from "@/src/utils/get-config"
import { handleError } from "@/src/utils/handle-error"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { updateDependencies } from "@/src/utils/updaters/update-dependencies"
import { updateFiles } from "@/src/utils/updaters/update-files"
import { z } from "zod"

export async function addComponents(
  components: string[],
  config: Config,
  options: {
    overwrite?: boolean
    silent?: boolean
    isNewProject?: boolean
  }
) {
  options = {
    overwrite: false,
    silent: false,
    isNewProject: false,
    ...options,
  }

  // Unified approach - use single project configuration
  return await addProjectComponents(components, config, options)
}

async function addProjectComponents(
  components: string[],
  config: z.infer<typeof configSchema>,
  options: {
    overwrite?: boolean
    silent?: boolean
    isNewProject?: boolean
  }
) {
  const registrySpinner = spinner(`Checking registry.`, {
    silent: options.silent,
  })?.start()
  const tree = await registryResolveItemsTree(components, config)

  if (!tree) {
    registrySpinner?.fail()
    return handleError(new Error("Failed to fetch components from registry."))
  }
  registrySpinner?.succeed()

  await updateDependencies(tree.dependencies, tree.devDependencies, config, {
    silent: options.silent,
  })
  await updateFiles(tree.files, config, {
    overwrite: options.overwrite,
    silent: options.silent,
  })

  if (tree.docs) {
    logger.info(tree.docs)
  }
}


