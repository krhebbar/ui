import { z } from "zod"

// Connection type schemas
export const oAuth2ConnectionSchema = z.object({
  type: z.literal("oauth2"),
  id: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
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
  ),
  tokenEnvVarName: z.string().optional(),
})

export const connectionSchema = z.union([oAuth2ConnectionSchema, secretConnectionSchema])

// External system schema - updated to match the modern interface
export const externalSystemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  apiBaseUrl: z.string(),
  testEndpoint: z.string(),
  externalObjects: z.array(z.string()), // Renamed from supportedObjects
  accessMethod: z.enum(["sdk", "api"]),
  isComplete: z.boolean().optional(),
  documentationUrl: z.string().optional(),
  sdkBaseUrl: z.string().optional(),
  sdkPackages: z.array(z.string()).optional(),
  connection: connectionSchema, // Moved inside externalSystem
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

// Supported DevRev object types (will be populated from supported-object-types.mdx)
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