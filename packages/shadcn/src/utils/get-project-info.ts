import path from "path"
import fs from "fs-extra"
import { loadConfig } from "tsconfig-paths"
import { z } from "zod"
import * as yaml from "yaml"
import { ProjectInfo as ValidationProjectInfo } from "../types/project-info"; // Import the new interface

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
    name: z.string(),
    description: z.string(),
    kind: z.enum(["Oauth2", "Secret"]),
    // OAuth2 specific fields
    scopes: z.array(z.object({
      name: z.string(),
      description: z.string(),
      value: z.string(),
    })).optional(),
    scope_delimiter: z.string().optional(),
    oauth_secret: z.string().optional(),
    authorize: z.object({
      type: z.string(),
      auth_url: z.string(),
      token_url: z.string(),
      grant_type: z.string(),
      auth_query_parameters: z.record(z.string()).optional(),
      token_query_parameters: z.record(z.string()).optional(),
    }).optional(),
    refresh: z.object({
      type: z.string(),
      url: z.string(),
      method: z.string(),
      query_parameters: z.record(z.string()).optional(),
      headers: z.record(z.string()).optional(),
    }).optional(),
    revoke: z.object({
      type: z.string(),
      url: z.string(),
      method: z.string(),
      headers: z.record(z.string()).optional(),
      query_parameters: z.record(z.string()).optional(),
    }).optional(),
    // Secret specific fields
    is_subdomain: z.boolean().optional(),
    secret_config: z.object({
      secret_transform: z.string(),
      fields: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
      })),
      token_verification: z.object({
        url: z.string(),
        method: z.string(),
        headers: z.record(z.string()).optional(),
      }).optional(),
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

// Helper function to check for manifest file (yml or yaml)
async function findManifestFile(dir: string): Promise<string | null> {
  const ymlPath = path.join(dir, "manifest.yml");
  if (await fs.pathExists(ymlPath)) {
    return ymlPath;
  }
  const yamlPath = path.join(dir, "manifest.yaml");
  if (await fs.pathExists(yamlPath)) {
    return yamlPath;
  }
  return null;
}

export async function getProjectRoot(cwd: string): Promise<ValidationProjectInfo> {
  let currentDir = path.resolve(cwd);
  const root = path.parse(currentDir).root; // Get the root of the filesystem

  const result: ValidationProjectInfo = {
    isValid: false,
    rootPath: null,
    reasons: [],
    isAirdropProject: false,
    isAtRoot: false,
  };

  while (currentDir !== root) {
    const dirName = path.basename(currentDir);
    if (dirName.startsWith("airdrop-")) {
      const manifestFile = await findManifestFile(currentDir);
      if (manifestFile) {
        result.isAirdropProject = true;
        result.rootPath = currentDir;
        // Check if the original cwd is the root we found
        result.isAtRoot = path.resolve(cwd) === currentDir;
        if (!result.isAtRoot) {
          result.reasons.push(
            "You are inside an Airdrop project, but not at its root. Please navigate to the root directory to proceed."
          );
        }
        // We found the project root, now we'd typically validate its structure.
        // For now, just finding it is enough for this function's core responsibility.
        // The isValid flag will be set by the main validation function later.
        return result;
      }
    }
    // Move to parent directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached the top without finding the project
      break;
    }
    currentDir = parentDir;
  }

  result.reasons.push(
    "Not inside an Airdrop project. No directory starting with 'airdrop-' and containing a manifest.yml/manifest.yaml file was found in the current or parent directories."
  );
  return result;
}

// If MANIFEST_SCHEMA is not exported from get-project-info.ts,
// redefine a minimal one here for validation purposes or pass the parsed manifest.
const MINIMAL_MANIFEST_SCHEMA_FOR_VALIDATION = z.object({
  name: z.string().min(1, { message: "Manifest must have a name." }),
  slug: z.string().min(1, { message: "Manifest must have a slug." }),
  version: z.string().min(1, { message: "Manifest must have a version." }),
  description: z.string().min(1, { message: "Manifest must have a description." }),
  serviceAccount: z.object({}).passthrough().optional(), // Simplified, just check existence if needed by context
  service_account: z.object({}).passthrough().optional(), // Allow snake_case
  functions: z.array(z.object({}).passthrough()).min(1, { message: "Manifest must define at least one function." }),
}).passthrough(); // Allow other fields

export async function validateAirdropProjectStructure(
  projectInfo: ValidationProjectInfo
): Promise<ValidationProjectInfo> {
  if (!projectInfo.rootPath) {
    // This should ideally not happen if getProjectRoot found a root
    projectInfo.isValid = false;
    projectInfo.reasons.push("Project root not found, cannot validate structure.");
    return projectInfo;
  }

  const rootPath = projectInfo.rootPath;
  let structureIsValid = true; // Assume valid until a check fails

  // Check for code/ directory
  const codeDirPath = path.join(rootPath, "code");
  if (!(await fs.pathExists(codeDirPath)) || !(await fs.lstat(codeDirPath)).isDirectory()) {
    projectInfo.reasons.push("Missing 'code/' directory at project root.");
    structureIsValid = false;
  } else {
    // Check for code/src/
    const srcDirPath = path.join(codeDirPath, "src");
    if (!(await fs.pathExists(srcDirPath)) || !(await fs.lstat(srcDirPath)).isDirectory()) {
      projectInfo.reasons.push("Missing 'code/src/' directory.");
      structureIsValid = false;
    } else {
      // Check for code/src/functions/
      const functionsDirPath = path.join(srcDirPath, "functions");
      if (!(await fs.pathExists(functionsDirPath)) || !(await fs.lstat(functionsDirPath)).isDirectory()) {
        projectInfo.reasons.push("Missing 'code/src/functions/' directory.");
        structureIsValid = false;
      }
      // Optional: code/src/functions/factory.ts
      const factoryFilePath = path.join(srcDirPath, "function-factory.ts");
      if (!(await fs.pathExists(factoryFilePath))) {
        projectInfo.reasons.push("Optional: 'code/src/function-factory.ts' is recommended but not found.");
        // Not setting structureIsValid = false as it's optional
      }

      // Check for code/src/main.ts
      const mainTsPath = path.join(srcDirPath, "main.ts");
      if (!(await fs.pathExists(mainTsPath))) {
        projectInfo.reasons.push("Missing 'code/src/main.ts' file.");
        structureIsValid = false;
      }

      // Check for code/src/index.ts
      const indexTsPath = path.join(srcDirPath, "index.ts");
      if (!(await fs.pathExists(indexTsPath))) {
        projectInfo.reasons.push("Missing 'code/src/index.ts' file.");
        structureIsValid = false;
      }
    }
  }

  // Validate manifest.yml/manifest.yaml content
  const manifestFilePath = await findManifestFile(rootPath); // Re-use helper from getProjectRoot
  if (!manifestFilePath) {
    // This case should have been caught by getProjectRoot if it's a prerequisite
    projectInfo.reasons.push("Manifest file manifest.yaml not found at project root.");
    structureIsValid = false;
  } else {
    try {
      const manifestContent = await fs.readFile(manifestFilePath, "utf8");
      const manifestData = yaml.parse(manifestContent);

      // Check for serviceAccount (either camelCase or snake_case)
      // The issue states "serviceAccount", but manifest.yaml often uses snake_case.
      // The schema allows passthrough, so we check specific fields manually if not covered by zod schema directly.
      const hasServiceAccount = manifestData.serviceAccount || manifestData.service_account;
      if (!hasServiceAccount) {
          projectInfo.reasons.push("Manifest must define 'serviceAccount' (or 'service_account').");
          structureIsValid = false;
      }


      const validationResult = MINIMAL_MANIFEST_SCHEMA_FOR_VALIDATION.safeParse(manifestData);
      if (!validationResult.success) {
        structureIsValid = false;
        validationResult.error.errors.forEach(err => {
          projectInfo.reasons.push(`Manifest validation error: ${err.path.join('.')} - ${err.message}`);
        });
      }
    } catch (e: any) {
      projectInfo.reasons.push(`Error parsing manifest file: ${e.message}`);
      structureIsValid = false;
    }
  }

  // If all checks passed so far, and it was identified as an Airdrop project by getProjectRoot
  if (structureIsValid && projectInfo.isAirdropProject) {
    projectInfo.isValid = true;
    if (projectInfo.reasons.length === 0 || projectInfo.reasons.every(r => r.startsWith("Optional:"))) {
        // If only optional reasons, or no reasons, it's valid.
        // Clear "not at root" message if structure is otherwise valid and it was the only warning.
        if (projectInfo.isAtRoot) {
             const notAtRootMsg = "You are inside an Airdrop project, but not at its root. Please navigate to the root directory to proceed.";
             const index = projectInfo.reasons.indexOf(notAtRootMsg);
             if (index > -1 && projectInfo.reasons.length === 1) {
                 projectInfo.reasons.splice(index, 1);
             }
        }
        // If no reasons remain, add a success message
        if (projectInfo.reasons.length === 0) {
            projectInfo.reasons.push("Project structure and manifest are valid.");
        }
    }
  } else {
      projectInfo.isValid = false;
      if (projectInfo.isAirdropProject && structureIsValid && projectInfo.reasons.length === 0) {
          // This case should not be hit if logic is correct, but as a fallback:
          projectInfo.reasons.push("Project structure appears valid, but it was not fully validated. Review other messages.");
      } else if (!projectInfo.isAirdropProject && projectInfo.reasons.length === 0) {
          // If not an airdrop project and no reasons yet, it means getProjectRoot didn't find it.
          // getProjectRoot already adds a reason for this.
      }
  }

  return projectInfo;
}

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
      slug: manifest.imports?.[0]?.slug || "unknown-snapin-slug", // Use first import slug or default
      serviceAccountName: manifest.service_account?.display_name,
      externalSystemName: manifest.keyring_types?.[0]?.name,
      functions: manifest.functions,
      keyring: manifest.keyring_types?.[0] ? {
        type: manifest.keyring_types[0].kind || "unknown",
        id: manifest.keyring_types[0].id,
      } : undefined,
      tokenVerification: manifest.keyring_types?.[0]?.secret_config?.token_verification,
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
  const tsConfigPath = path.resolve(cwd, "tsconfig.json")
  return fs.existsSync(tsConfigPath)
}

export async function getTsConfig(cwd: string) {
  for (const fallback of [
    "tsconfig.json"
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

export async function getAirdropProjectValidation(cwd: string): Promise<ValidationProjectInfo> {
  // First, determine the project root and basic Airdrop project identification
  const rootCheckResult = await getProjectRoot(cwd);

  // If no rootPath was found, it means it's not an Airdrop project according to getProjectRoot.
  // getProjectRoot will have already populated reasons.
  // We can return early if isAirdropProject is false.
  if (!rootCheckResult.isAirdropProject || !rootCheckResult.rootPath) {
    // Ensure isValid is false if not an Airdrop project or root path is missing
    rootCheckResult.isValid = false;
    return rootCheckResult;
  }

  // Now, validate the structure of the found project root
  const finalValidationResult = await validateAirdropProjectStructure(rootCheckResult);

  return finalValidationResult;
}
