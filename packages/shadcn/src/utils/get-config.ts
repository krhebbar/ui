import path from "path"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { highlighter } from "@/src/utils/highlighter"
import { resolveImport } from "@/src/utils/resolve-import"
import fg from "fast-glob"
import { loadConfig } from "tsconfig-paths"
import { z } from "zod"

export const DEFAULT_STYLE = "default"
export const DEFAULT_COMPONENTS = "@/functions"
export const DEFAULT_UTILS = "@/lib/utils"

export const rawConfigSchema = z
  .object({
    $schema: z.string().optional(),
    style: z.string(),
    rsc: z.coerce.boolean().default(false),
    tsx: z.coerce.boolean().default(true),
    tailwind: z.object({
      config: z.string().optional(),
      css: z.string().optional(),
      baseColor: z.string().optional(),
      cssVariables: z.boolean().default(false),
      prefix: z.string().default("").optional(),
    }).optional(),
    aliases: z.object({
      components: z.string(),
      utils: z.string(),
      ui: z.string().optional(),
      lib: z.string().optional(),
      hooks: z.string().optional(),
    }),
    iconLibrary: z.string().optional(),
  })
  .strict()

export type RawConfig = z.infer<typeof rawConfigSchema>

export const configSchema = rawConfigSchema.extend({
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

export const workspaceConfigSchema = z.record(configSchema)

export async function getConfig(cwd: string) {
  const projectInfo = await getProjectInfo(cwd)

  if (!projectInfo) {
    return null
  }

  // Generate configuration directly from manifest.yml data
  const config: RawConfig = {
    $schema: "https://ui.shadcn.com/schema.json",
    rsc: false, // Airdrop projects are backend functions, not React Server Components
    tsx: projectInfo.isTsx,
    style: "new-york", // Default style for airdrop projects
    tailwind: {
      config: "",
      baseColor: "zinc", 
      css: "",
      cssVariables: false, // No Tailwind CSS in airdrop projects
      prefix: "",
    },
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

export async function resolveConfigPaths(cwd: string, config: RawConfig) {
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
      // TODO: Make this configurable.
      // For now, we assume the lib and hooks directories are one level up from the components directory.
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

// Note: we can check for -workspace.yaml or "workspace" in package.json.
// Since cwd is not necessarily the root of the project.
// We'll instead check if ui aliases resolve to a different root.
export async function getWorkspaceConfig(config: Config) {
  let resolvedAliases: any = {}

  for (const key of Object.keys(config.aliases)) {
    if (!isAliasKey(key, config)) {
      continue
    }

    const resolvedPath = config.resolvedPaths[key]
    const packageRoot = await findPackageRoot(
      config.resolvedPaths.cwd,
      resolvedPath
    )

    if (!packageRoot) {
      resolvedAliases[key] = config
      continue
    }

    resolvedAliases[key] = await getConfig(packageRoot)
  }

  const result = workspaceConfigSchema.safeParse(resolvedAliases)
  if (!result.success) {
    return null
  }

  return result.data
}

export async function findPackageRoot(cwd: string, resolvedPath: string) {
  const commonRoot = findCommonRoot(cwd, resolvedPath)
  const relativePath = path.relative(commonRoot, resolvedPath)

  const packageRoots = await fg.glob("**/package.json", {
    cwd: commonRoot,
    deep: 3,
    ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/public/**"],
  })

  const matchingPackageRoot = packageRoots
    .map((pkgPath) => path.dirname(pkgPath))
    .find((pkgDir) => relativePath.startsWith(pkgDir))

  return matchingPackageRoot ? path.join(commonRoot, matchingPackageRoot) : null
}

function isAliasKey(
  key: string,
  config: Config
): key is keyof Config["aliases"] {
  return Object.keys(config.resolvedPaths)
    .filter((key) => key !== "utils")
    .includes(key)
}

export function findCommonRoot(cwd: string, resolvedPath: string) {
  const parts1 = cwd.split(path.sep)
  const parts2 = resolvedPath.split(path.sep)
  const commonParts = []

  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    if (parts1[i] !== parts2[i]) {
      break
    }
    commonParts.push(parts1[i])
  }

  return commonParts.join(path.sep)
}

// TODO: Cache this call.
export async function getTargetStyleFromConfig(cwd: string, fallback: string) {
  // For airdrop projects, always return the fallback style
  return fallback
}
