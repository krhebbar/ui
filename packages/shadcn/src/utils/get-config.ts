import path from "path"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { resolveImport } from "@/src/utils/resolve-import"
import { loadConfig } from "tsconfig-paths"
import { z } from "zod"
import fs from "fs-extra"
import { getProjectState } from "@/src/utils/project-utils"
import { readSnapinConfig } from "@/src/utils/project-config"

export const DEFAULT_STYLE = "new-york"


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
  // First, check if this is a project with snapin.config.mjs (new approach)
  const snapInConfigResult = await readSnapinConfig(cwd);
  if (snapInConfigResult.validatedConfig || snapInConfigResult.rawConfig) {
    // Use the new unified approach - try to get project info for TSX detection
    const projectInfo = await getProjectInfo(cwd);
    if (projectInfo) {
      const config = {
        style: DEFAULT_STYLE,
        rsc: false,
        tsx: projectInfo.isTsx,
        aliases: {
          components: `${projectInfo.aliasPrefix}/functions`,
          utils: `${projectInfo.aliasPrefix}/lib/utils`,
        },
      };
      
      return await resolveConfigPaths(projectInfo.codePath, config);
    }
  }

  // Fallback to legacy approach for projects without snapin.config.mjs
  const projectInfo = await getProjectInfo(cwd);
  if (!projectInfo) {
    return null;
  }

  // Minimal CLI configuration for path resolution only
  const config = {
    style: DEFAULT_STYLE,
    rsc: false,
    tsx: projectInfo.isTsx,
    aliases: {
      components: `${projectInfo.aliasPrefix}/functions`,
      utils: `${projectInfo.aliasPrefix}/lib/utils`,
    },
  }

  // Use the codePath (where tsconfig.json actually is) for path resolution
  return await resolveConfigPaths(projectInfo.codePath, config)
}

export async function resolveConfigPaths(cwd: string, config: Omit<Config, 'resolvedPaths'>) {
  // Read tsconfig.json.
  const tsConfigPath = path.join(cwd, "tsconfig.json");
  if (!fs.existsSync(tsConfigPath)) {
    // Match the expected error message format from the test if possible, or ensure it's covered by regex.
    // The test expects /Failed to load tsconfig.json/
    throw new Error(`Failed to load tsconfig.json: File not found at ${tsConfigPath}`);
  }

  const tsConfig = loadConfig(cwd); // loadConfig is synchronous

  if (tsConfig.resultType === "failed") {
    throw new Error(
      `Failed to load tsconfig.json. ${
        tsConfig.message ?? ""
      }`.trim()
    );
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
