import fs from "fs/promises"
import path from "path"
import { AirdropProjectConfig, SUPPORTED_DEVREV_OBJECTS } from "@/src/types/snapin-config" // Updated path
import { logger } from "@/src/utils/logger"

/**
 * Find the monorepo root by looking for common monorepo markers
 */
function findMonorepoRoot(startDir: string): string {
  let currentDir = startDir
  const markers = ["pnpm-workspace.yaml", "lerna.json", "nx.json", "rush.json"]
  
  while (currentDir !== path.dirname(currentDir)) {
    for (const marker of markers) {
      try {
        const markerPath = path.join(currentDir, marker)
        require("fs").accessSync(markerPath)
        return currentDir
      } catch {
        // Continue searching
      }
    }
    currentDir = path.dirname(currentDir)
  }
  
  return startDir // Fallback to original directory
}

/**
 * Get embedded DevRev objects content as fallback
 */
function getEmbeddedDevRevObjectsContent(): string {
  // Embedded fallback content - manually kept in sync
  return `import { z } from "zod"

// =============================================================================
// Base DevRev Object Schema
// =============================================================================

export const baseDevRevObjectSchema = z.object({
  id: z.string().describe("Unique identifier for the object"),
  created_date: z.string().describe("ISO timestamp when the object was created"),
  modified_date: z.string().describe("ISO timestamp when the object was last modified"),
  created_by_id: z.string().optional().describe("User ID of the user that created the object"),
  modified_by_id: z.string().optional().describe("User ID of the user that last modified the object"),
  tags: z.array(z.string()).optional().describe("Tags associated with the object"),
  item_url_field: z.string().optional().describe("Link to the item in the origin system"),
})

// =============================================================================
// Enum Definitions
// =============================================================================

export const severityEnum = z.enum(["sev0", "sev1", "sev2", "sev3"])
export const priorityEnum = z.enum(["p0", "p1", "p2", "p3"])
export const stateEnum = z.enum(["active", "inactive", "deactivated"])

// =============================================================================
// Core DevRev Object Schemas (Essential Objects)
// =============================================================================

export const ticketSchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the work object"),
  body: z.string().optional().describe("Body of the work object"),
  applies_to_part_id: z.string().describe("Details of the part relevant to the work"),
  severity: severityEnum.describe("Severity of the ticket"),
  stage: z.enum(["new", "in_progress", "resolved", "closed"]).describe("Stage of the object"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the work"),
  account_id: z.string().optional().describe("Globally unique ID for a DevRev account"),
  needs_response: z.boolean().optional().describe("Whether the ticket needs a response"),
}).describe("DevRev Ticket object")

export const articleSchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the article"),
  content: z.string().optional().describe("Content of the article"),
  authored_by_ids: z.array(z.string()).optional().describe("Users that authored the article"),
  owned_by_ids: z.array(z.string()).describe("Users that own the article"),
  status: z.enum(["draft", "published", "archived"]).optional().describe("Status of the article"),
}).describe("DevRev Article object")

export const commentSchema = baseDevRevObjectSchema.extend({
  body: z.string().describe("Comment body"),
  parent_object_id: z.string().describe("The object this relates to"),
  parent_object_type: z.string().optional().describe("The object type this relates to"),
}).describe("DevRev Comment object")

export const accountSchema = baseDevRevObjectSchema.extend({
  display_name: z.string().describe("Name of the Organization"),
  description: z.string().optional().describe("Description of the corresponding Account"),
  owned_by: z.array(z.string()).describe("List of Dev user IDs owning this Account"),
  state: stateEnum.describe("State of the Organization"),
}).describe("DevRev Account object")

// Add other essential schemas here...
// Note: This is a minimal fallback. The full schemas should be loaded from file.

// =============================================================================
// Schema Map and Utility Functions
// =============================================================================

export const devRevObjectSchemas = {
  ticket: ticketSchema,
  article: articleSchema,
  comment: commentSchema,
  account: accountSchema,
} as const

export type DevRevObjectType = keyof typeof devRevObjectSchemas
export type DevRevObject = z.infer<typeof ticketSchema> | z.infer<typeof articleSchema> | z.infer<typeof commentSchema> | z.infer<typeof accountSchema>

export function getDevRevObjectSchema(objectType: DevRevObjectType) {
  return devRevObjectSchemas[objectType]
}

export function validateDevRevObject(objectType: DevRevObjectType, data: unknown) {
  const schema = getDevRevObjectSchema(objectType)
  return schema.safeParse(data)
}

export function getSupportedDevRevObjectTypes(): DevRevObjectType[] {
  return Object.keys(devRevObjectSchemas) as DevRevObjectType[]
}

export function isValidDevRevObjectType(objectType: string): objectType is DevRevObjectType {
  return objectType in devRevObjectSchemas
}
`
}

/**
 * Generate TypeScript definition files for the airdrop project
 * Uses static Zod schemas instead of OpenAPI generation
 */
export async function generateTypeDefinitions(
  cwd: string,
  config: AirdropProjectConfig
): Promise<void> {
  const typesDir = path.join(cwd, "code", "types")
  
  // Ensure types directory exists
  await fs.mkdir(typesDir, { recursive: true })
  
  // Copy static Zod schema files
  await copyStaticSchemas(cwd)
  
  // Generate project-specific type definitions
  await generateProjectTypes(typesDir, config)
  
  logger.info("TypeScript definition files generated successfully")
}

/**
 * Copy static Zod schema files to the project types directory
 */
async function copyStaticSchemas(cwd: string): Promise<void> {
  const typesDir = path.join(cwd, "code", "types")
  await fs.mkdir(typesDir, { recursive: true })

  // Copy snapin-config.ts
  await copyConfigTypes(cwd)
  
  // Copy devrev-objects.ts
  await copyDevRevObjectTypes(cwd)
}

/**
 * Copy the DevRev object Zod schemas to the project types directory
 */
async function copyDevRevObjectTypes(cwd: string): Promise<void> {
  const typesDir = path.join(cwd, "code", "types")
  const targetPath = path.join(typesDir, "devrev-objects.ts")
  
  // Try to find the source devrev-objects.ts file from various possible locations
  const possibleSourcePaths = [
    // Relative to current working directory (monorepo development)
    path.resolve(process.cwd(), "packages/shadcn/src/types/devrev-objects.ts"),
    path.resolve(process.cwd(), "../../packages/shadcn/src/types/devrev-objects.ts"),
    path.resolve(process.cwd(), "../../../packages/shadcn/src/types/devrev-objects.ts"),
    // Try from monorepo root discovery
    path.resolve(findMonorepoRoot(process.cwd()), "packages/shadcn/src/types/devrev-objects.ts"),

  ]
  
  let sourceContent: string | null = null
  let sourcePath: string | null = null
  
  for (const possiblePath of possibleSourcePaths) {
    try {
      await fs.access(possiblePath)
      sourceContent = await fs.readFile(possiblePath, "utf8")
      sourcePath = possiblePath
      break
    } catch {
      // Continue to next path
    }
  }
  
  if (!sourceContent) {
    logger.warn("Could not find devrev-objects.ts source file, using embedded fallback")
    logger.info("Searched paths:")
    possibleSourcePaths.forEach(p => logger.info(`  - ${p}`))
    
    // Use the embedded content as fallback
    sourceContent = getEmbeddedDevRevObjectsContent()
    sourcePath = "embedded-fallback"
  }
  
  if (sourceContent) {
    await fs.writeFile(targetPath, sourceContent, "utf8")
    logger.info(`Copied devrev-objects.ts from ${sourcePath} to project types directory`)
  } else {
    throw new Error("Could not get devrev-objects.ts content from any source")
  }
}

/**
 * Generate project-specific type definitions using static schemas
 */
async function generateProjectTypes(
  typesDir: string,
  config: AirdropProjectConfig
): Promise<void> {
  // Generate snapin.d.ts with project-specific types
  const snapinTypesContent = `// Auto-generated from snapin.config.mjs
// Do not edit this file manually

import type { AirdropProjectConfig, SUPPORTED_DEVREV_OBJECTS } from './snapin-config'
import type { 
  DevRevObject, 
  DevRevObjectType,
  getSupportedDevRevObjectTypes,
  validateDevRevObject,
  ${config.devrevObjects?.map(obj => toPascalCase(obj)).join(', ') || ''}
} from './devrev-objects'

// Configuration constants
export const PROJECT_CONFIG: AirdropProjectConfig

// Project-Specific DevRev Objects (configured in snapin.config.mjs)
export type ProjectDevRevObject = ${config.devrevObjects && config.devrevObjects.length > 0 ? config.devrevObjects.map(obj => toPascalCase(obj)).join(' | ') : 'never'}

// External System Types
${(config.externalSyncUnits || []).map(unit => generateExternalSyncUnitType(unit)).join('\n\n')}

// Export all external sync unit types  
export type ExternalSyncUnit = ${config.externalSyncUnits && config.externalSyncUnits.length > 0 ? config.externalSyncUnits.map(unit => toPascalCase(unit)).join(' | ') : 'never'}

// Re-export common DevRev types for convenience
export type { DevRevObject, DevRevObjectType }
export { getSupportedDevRevObjectTypes, validateDevRevObject }

// Supported DevRev Objects from Schema
export type SupportedDevRevObject = typeof SUPPORTED_DEVREV_OBJECTS[number]

// Type guard for supported DevRev objects
export declare function isSupportedDevRevObject(obj: string): obj is SupportedDevRevObject
`

  const snapinTypesPath = path.join(typesDir, "snapin.d.ts")
  await fs.writeFile(snapinTypesPath, snapinTypesContent, "utf8")
  
  // Generate basic API types for configured objects
  await generateBasicApiTypes(typesDir, config)
}

/**
 * Generate basic API types for configured DevRev objects
 */
async function generateBasicApiTypes(
  typesDir: string,
  config: AirdropProjectConfig
): Promise<void> {
  const devrevTypesDir = path.join(typesDir, "devrev")
  await fs.mkdir(devrevTypesDir, { recursive: true })

  const apiTypesContent = `// Auto-generated DevRev API types
// Based on configured DevRev objects from snapin.config.mjs

// Import Zod schemas for validation
import { 
  validateDevRevObject,
  ${config.devrevObjects?.map(obj => `${obj}Schema`).join(', ') || ''}
} from '../devrev-objects'

// Import TypeScript types
import type { 
  ${config.devrevObjects?.map(obj => toPascalCase(obj)).join(', ') || ''}
} from '../devrev-objects'

// Base DevRev API types
export interface DevRevApiResponse<T = any> {
  data: T
  success: boolean
  message?: string
}

export interface DevRevApiError {
  error: string
  message: string
  details?: any
}

export interface PaginationInfo {
  next_cursor?: string
  prev_cursor?: string
  total_count?: number
}

export interface ListResponse<T> {
  data: T[]
  pagination?: PaginationInfo
}

// Airdrop specific types
export interface AirdropExtractionContext {
  external_system_id: string
  connection_id: string
  last_sync_time?: string
  batch_size?: number
}

export interface AirdropLoadingContext {
  external_system_id: string
  connection_id: string
  upsert_strategy?: 'create_only' | 'update_only' | 'upsert'
}

export interface ExternalObjectMapping {
  external_id: string
  external_type: string
  devrev_id?: string
  devrev_type: string
  field_mappings: Record<string, any>
  sync_status: 'pending' | 'synced' | 'error'
  last_synced?: string
  error_message?: string
}

// Generic CRUD operations
export interface CreateRequest<T> {
  data: Partial<T>
}

export interface UpdateRequest<T> {
  id: string
  data: Partial<T>
}

export interface ListRequest {
  limit?: number
  cursor?: string
  filters?: Record<string, any>
}

export interface DeleteRequest {
  id: string
}

export interface BulkCreateRequest<T> {
  data: Partial<T>[]
}

export interface BulkUpdateRequest<T> {
  updates: Array<{
    id: string
    data: Partial<T>
  }>
}

// Request/Response types for project-configured DevRev objects
${(config.devrevObjects || []).map(obj => generateApiTypesForObject(obj)).join('\n\n')}

// Validation helpers using Zod schemas
export const validation = {
${(config.devrevObjects || []).map(obj => `  validate${toPascalCase(obj)}: (data: unknown) => validateDevRevObject("${obj}", data)`).join(',\n')}
}
`

  const apiTypesPath = path.join(devrevTypesDir, "api.d.ts")
  await fs.writeFile(apiTypesPath, apiTypesContent, "utf8")
}







/**
 * Generate TypeScript type definition for an external sync unit
 */
function generateExternalSyncUnitType(unitName: string): string {
  const typeName = toPascalCase(unitName)
  
  return `export interface ${typeName} {
  id: string
  external_id: string
  created_date: string
  modified_date: string
  // TODO: Add specific fields for ${unitName}
  [key: string]: any
}`
}

/**
 * Generate API types for a specific DevRev object
 */
function generateApiTypesForObject(objectName: string): string {
  const typeName = toPascalCase(objectName)
  
  return `// ${typeName} API types
export interface Create${typeName}Request extends CreateRequest<${typeName}> {}
export interface Create${typeName}Response extends DevRevApiResponse<${typeName}> {}

export interface Update${typeName}Request extends UpdateRequest<${typeName}> {}
export interface Update${typeName}Response extends DevRevApiResponse<${typeName}> {}

export interface Get${typeName}Request {
  id: string
}
export interface Get${typeName}Response extends DevRevApiResponse<${typeName}> {}

export interface List${typeName}Request extends ListRequest {}
export interface List${typeName}Response extends DevRevApiResponse<ListResponse<${typeName}>> {}

export interface Delete${typeName}Request extends DeleteRequest {}
export interface Delete${typeName}Response extends DevRevApiResponse<void> {}`
}

/**
 * Convert kebab-case or snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Copy the snapin configuration types to the project types directory
 * This generates a self-contained schema for the cloned project
 */
export async function copyConfigTypes(cwd: string): Promise<void> {
  const typesDir = path.join(cwd, "code", "types")
  await fs.mkdir(typesDir, { recursive: true })

  // Generate snapin configuration types - self-contained schema
  const targetConfigPath = path.join(typesDir, "snapin-config.ts")
  
  // Try to find the source snapin-config.ts file from various possible locations
  const possibleSourcePaths = [
    // Relative to current working directory (monorepo development)
    path.resolve(process.cwd(), "packages/shadcn/src/types/snapin-config.ts"),
    path.resolve(process.cwd(), "../../packages/shadcn/src/types/snapin-config.ts"),
    path.resolve(process.cwd(), "../../../packages/shadcn/src/types/snapin-config.ts"),
    // Try from monorepo root discovery
    path.resolve(findMonorepoRoot(process.cwd()), "packages/shadcn/src/types/snapin-config.ts"),

  ]
  
  let sourceContent: string | null = null
  let sourcePath: string | null = null
  
  for (const possiblePath of possibleSourcePaths) {
    try {
      await fs.access(possiblePath)
      sourceContent = await fs.readFile(possiblePath, "utf8")
      await fs.writeFile(targetConfigPath, sourceContent, "utf8")
      logger.info(`Copied snapin-config.ts from ${possiblePath} to project types directory`)
      sourcePath = possiblePath
      return
    } catch {
      // Continue to next path
    }
  }
  
  if (!sourceContent) {
    logger.error("Could not find snapin-config.ts source file")
    logger.error("Searched paths:")
    possibleSourcePaths.forEach(p => logger.error(`  - ${p}`))
    // Fall back to inline generation
    // Fallback to inline generation if source file not found
    logger.warn("Could not read source snapin-config.ts, generating inline version")
    
    const configTypes = `// Airdrop configuration types
// This file is auto-generated - do not edit manually

import { z } from "zod"

// Connection type schemas
export const oAuth2ConnectionSchema = z.object({
  type: z.literal("oauth2"),
  id: z.string(),
  clientId: z.union([z.string(), z.undefined()]).transform(val => val || ""),
  clientSecret: z.union([z.string(), z.undefined()]).transform(val => val || ""),
  headers: z.record(z.string()).optional(),
  authorize: z.object({
    url: z.string(),
    tokenUrl: z.string(),
    grantType: z.string().default("authorization_code"),
    scope: z.string(),
    scopeDelimiter: z.string().default(" "),
  }),
  refresh: z.object({
    url: z.string(),
    method: z.string().default("POST"),
  }),
  revoke: z.object({
    url: z.string(),
    method: z.string().default("POST"),
  }),
  tokenEnvVarName: z.string().optional(),
})

export const secretConnectionSchema = z.object({
  type: z.literal("secret"),
  id: z.string(),
  isSubdomain: z.boolean().optional(),
  subdomain: z.string().optional(),
  secretTransform: z.string(),
  headers: z.record(z.string()).optional(),
  tokenVerification: z.object({
    url: z.string(),
    method: z.string().default("GET"),
    headers: z.record(z.string()).optional(),
  }),
  fields: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
    })
  ).optional(),
  tokenEnvVarName: z.union([z.string(), z.undefined()]).transform(val => val || "").optional(),
})

export const connectionSchema = z.union([oAuth2ConnectionSchema, secretConnectionSchema])

// External system schema - updated to match the modern interface
export const externalSystemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  apiBaseUrl: z.string(),
  externalObjects: z.array(z.string()),
  accessMethod: z.enum(["sdk", "api"]),
  isComplete: z.boolean().optional(),
  documentationUrl: z.string().optional(),
  sdkBaseUrl: z.string().optional(),
  sdkPackages: z.array(z.string()).optional(),
  connection: connectionSchema,
})

// Main airdrop config schema - updated structure
export const airdropConfigSchema = z.object({
  projectType: z.enum(["airdrop", "snap-in"]),
  syncDirection: z.enum(["one-way", "two-way"]).optional(),
  devrevObjects: z.array(z.string()),
  externalSyncUnits: z.array(z.string()).optional(),
  externalSystem: externalSystemSchema.optional(),
  devrevPatEnvVarName: z.string().optional(), 
  devrevOrgEnvVarName: z.string().optional(),
})

// Export types
export type OAuth2Connection = z.infer<typeof oAuth2ConnectionSchema>
export type SecretConnection = z.infer<typeof secretConnectionSchema>
export type Connection = z.infer<typeof connectionSchema>
export type ExternalSystem = z.infer<typeof externalSystemSchema>
export type AirdropProjectConfig = z.infer<typeof airdropConfigSchema>

// Supported DevRev object types (from supported-object-types.mdx)
export const SUPPORTED_DEVREV_OBJECTS = [
  "account",
  "airdrop_authorization_policy", 
  "airdrop_platform_group",
  "article",
  "capability",
  "channel", 
  "comment",
  "component",
  "conversation",
  "custom_link",
  "custom_part",
  "devu",
  "directory",
  "dm",
  "enhancement",
  "feature",
  "group",
  "incident",
  "issue",
  "link",
  "linkable",
  "meeting",
  "microservice",
  "object_member",
  "opportunity",
  "product",
  "revu",
  "runnable",
  "sysu",
  "tag",
  "task",
  "test_custom_type",
  "ticket",
] as const

export type SupportedDevRevObject = typeof SUPPORTED_DEVREV_OBJECTS[number]
`
    await fs.writeFile(targetConfigPath, configTypes, "utf8")
  }
} 