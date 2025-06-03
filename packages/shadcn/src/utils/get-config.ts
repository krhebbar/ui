import path from "path"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { resolveImport } from "@/src/utils/resolve-import"
import { loadConfig } from "tsconfig-paths"
import { z } from "zod"

export const DEFAULT_STYLE = "new-york"
export const DEFAULT_COMPONENTS = "@/functions"
export const DEFAULT_UTILS = "@/lib/utils"

export const configSchema = z.object({
  $schema: z.string().optional(),
  style: z.string(),
  rsc: z.boolean().default(false),
  tsx: z.boolean().default(true),
  aliases: z.object({
    components: z.string(),
    utils: z.string(),
    ui: z.string().optional(),
    lib: z.string().optional(),
    hooks: z.string().optional(),
  }),
  iconLibrary: z.string().optional(),
  resolvedPaths: z.object({
    cwd: z.string(),
    utils: z.string(),
    components: z.string(),
    lib: z.string(),
    hooks: z.string(),
    ui: z.string(),
  }),
})

export type Config = z.infer<typeof configSchema>

export async function getConfig(cwd: string): Promise<Config | null> {
  const projectInfo = await getProjectInfo(cwd)

  if (!projectInfo) {
    return null
  }

  // Generate configuration directly from manifest.yml data
  const config = {
    $schema: "https://airdrop.dev/schema.json",
    rsc: false, // Airdrop projects are backend functions, not React Server Components
    tsx: projectInfo.isTsx,
    style: DEFAULT_STYLE, // Default style for airdrop projects
    iconLibrary: "lucide",
    aliases: {
      components: `${projectInfo.aliasPrefix}/functions`,
      ui: `${projectInfo.aliasPrefix}/functions`,
      hooks: `${projectInfo.aliasPrefix}/hooks`,
      lib: `${projectInfo.aliasPrefix}/lib`,
      utils: `${projectInfo.aliasPrefix}/lib/utils`,
    },
  }

  return await resolveConfigPaths(cwd, config)
}

export async function resolveConfigPaths(cwd: string, config: Omit<Config, 'resolvedPaths'>) {
  // Read tsconfig.json.
  const tsConfig = await loadConfig(cwd)

  if (tsConfig.resultType === "failed") {
    throw new Error(
      `Failed to load ${config.tsx ? "tsconfig" : "jsconfig"}.json. ${
        tsConfig.message ?? ""
      }`.trim()
    )
  }

  return configSchema.parse({
    ...config,
    resolvedPaths: {
      cwd,
      utils: await resolveImport(config.aliases["utils"], tsConfig),
      components: await resolveImport(config.aliases["components"], tsConfig),
      ui: config.aliases["ui"]
        ? await resolveImport(config.aliases["ui"], tsConfig)
        : path.resolve(
            (await resolveImport(config.aliases["components"], tsConfig)) ??
              cwd,
            "ui"
          ),
      lib: config.aliases["lib"]
        ? await resolveImport(config.aliases["lib"], tsConfig)
        : path.resolve(
            (await resolveImport(config.aliases["utils"], tsConfig)) ?? cwd,
            ".."
          ),
      hooks: config.aliases["hooks"]
        ? await resolveImport(config.aliases["hooks"], tsConfig)
        : path.resolve(
            (await resolveImport(config.aliases["components"], tsConfig)) ??
              cwd,
            "..",
            "hooks"
          ),
    },
  })
}

export async function getTargetStyleFromConfig(cwd: string, fallback: string) {
  // For airdrop projects, always return the fallback style
  return fallback
}
