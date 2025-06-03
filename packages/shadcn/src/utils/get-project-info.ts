import path from "path"
import fs from "fs-extra"
import { loadConfig } from "tsconfig-paths"
import { z } from "zod"
import * as yaml from "yaml"

export type ProjectInfo = {
  name: string
  description: string
  slug: string // We'll derive this from imports[0].slug or use a default
  serviceAccountName?: string
  externalSystemName?: string
  functions?: Array<{ name: string; description: string }>
  keyring?: {
    type: string
    id: string
  }
  tokenVerification?: {
    method: string
    url: string
  }
  isTsx: boolean
  aliasPrefix: string | null
  manifestPath: string
  codePath: string
  functionsPath: string
}

const PROJECT_SHARED_IGNORE = [
  "**/node_modules/**",
  ".next",
  "public",
  "dist",
  "build",
]

const TS_CONFIG_SCHEMA = z.object({
  compilerOptions: z.object({
    paths: z.record(z.string().or(z.array(z.string()))),
  }),
})

const MANIFEST_SCHEMA = z.object({
  version: z.string().optional(),
  name: z.string(),
  description: z.string(),
  service_account: z.object({
    display_name: z.string(),
  }).optional(),
  functions: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  keyring_types: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    external_system_name: z.string().optional(),
    kind: z.string().optional(),
    is_subdomain: z.boolean().optional(),
    secret_config: z.any().optional(),
    token_verification: z.object({
      url: z.string(),
      method: z.string(),
    }).optional(),
  })).optional(),
  imports: z.array(z.object({
    slug: z.string(),
    display_name: z.string().optional(),
    description: z.string().optional(),
    extractor_function: z.string().optional(),
    loader_function: z.string().optional(),
    allowed_connection_types: z.array(z.string()).optional(),
  })).optional(),
})

export async function getProjectInfo(cwd: string): Promise<ProjectInfo | null> {
  const manifestPath = path.resolve(cwd, "manifest.yaml")
  const codePath = path.resolve(cwd, "code")
  const functionsPath = path.resolve(codePath, "src/functions")
  
  // Check if this is an airdrop project
  if (!fs.existsSync(manifestPath) || !fs.existsSync(codePath)) {
    return null
  }

  try {
    // Read and parse manifest.yaml
    const manifestContent = await fs.readFile(manifestPath, "utf8")
    const manifest = MANIFEST_SCHEMA.parse(yaml.parse(manifestContent))

    const [isTsx, aliasPrefix] = await Promise.all([
      isTypeScriptProject(codePath),
      getTsConfigAliasPrefix(codePath),
    ])

    return {
      name: manifest.name,
      description: manifest.description,
      slug: manifest.imports?.[0]?.slug || "airdrop-project", // Use first import slug or default
      serviceAccountName: manifest.service_account?.display_name,
      externalSystemName: manifest.keyring_types?.[0]?.external_system_name,
      functions: manifest.functions,
      keyring: manifest.keyring_types?.[0] ? {
        type: manifest.keyring_types[0].kind || "unknown",
        id: manifest.keyring_types[0].id,
      } : undefined,
      tokenVerification: manifest.keyring_types?.[0]?.token_verification,
      isTsx,
      aliasPrefix,
      manifestPath,
      codePath,
      functionsPath,
    }
  } catch (error) {
    console.error("Failed to parse project info:", error)
    return null
  }
}

export async function getTsConfigAliasPrefix(cwd: string) {
  const tsConfig = await loadConfig(cwd)

  if (
    tsConfig?.resultType === "failed" ||
    !Object.entries(tsConfig?.paths || {}).length
  ) {
    return null
  }

  // Look for common alias patterns
  for (const [alias, paths] of Object.entries(tsConfig.paths)) {
    if (
      paths.includes("./*") ||
      paths.includes("./src/*")
    ) {
      return alias.replace(/\/\*$/, "") ?? null
    }
  }

  // Use the first alias as the prefix.
  return Object.keys(tsConfig?.paths || {})?.[0].replace(/\/\*$/, "") ?? null
}

export async function isTypeScriptProject(cwd: string) {
  const tsConfigPath = path.resolve(cwd, "code/tsconfig.json")
  return fs.existsSync(tsConfigPath)
}

export async function getTsConfig(cwd: string) {
  for (const fallback of [
    "code/tsconfig.json"
  ]) {
    const filePath = path.resolve(cwd, fallback)
    if (!(await fs.pathExists(filePath))) {
      continue
    }

    // We can't use fs.readJSON because it doesn't support comments.
    const contents = await fs.readFile(filePath, "utf8")
    const cleanedContents = contents.replace(/\/\*\s*\*\//g, "")
    const result = TS_CONFIG_SCHEMA.safeParse(JSON.parse(cleanedContents))

    if (result.error) {
      continue
    }

    return result.data
  }

  return null
}


