# DevRev Object Zod Schemas

This document describes the comprehensive Zod schemas for all 33 supported DevRev object types in Airdrop projects.

## Overview

The `devrev-objects.ts` file provides:
- **Type-safe validation** for all DevRev objects using Zod schemas
- **Runtime validation** with detailed error messages
- **TypeScript type inference** from schemas
- **Utility functions** for common operations
- **Discriminated union support** for type-safe object handling

## Quick Start

```typescript
import { 
  accountSchema, 
  ticketSchema, 
  validateDevRevObject,
  type Account,
  type Ticket
} from "@/src/types/devrev-objects"

// Validate an account object
const account: Account = {
  id: "acc-123",
  created_date: "2023-01-01T00:00:00Z",
  modified_date: "2023-01-01T00:00:00Z",
  display_name: "Acme Corp",
  owned_by: ["user-123"],
  state: "active"
}

const result = accountSchema.safeParse(account)
if (result.success) {
  console.log("✅ Valid account:", result.data.display_name)
} else {
  console.log("❌ Validation errors:", result.error.issues)
}
```

## Supported DevRev Objects (33 total)

All schemas extend the base `BaseDevRevObject` schema with common fields:

| Object Type | Schema | Type | Description |
|-------------|--------|------|-------------|
| `account` | `accountSchema` | `Account` | Organization/customer accounts |
| `airdrop_authorization_policy` | `airdropAuthorizationPolicySchema` | `AirdropAuthorizationPolicy` | Authorization policies for airdrop |
| `airdrop_platform_group` | `airdropPlatformGroupSchema` | `AirdropPlatformGroup` | Platform-provided groups |
| `article` | `articleSchema` | `Article` | Knowledge base articles |
| `capability` | `capabilitySchema` | `Capability` | Product capabilities |
| `channel` | `channelSchema` | `Channel` | Communication channels |
| `comment` | `commentSchema` | `Comment` | Comments on objects |
| `component` | `componentSchema` | `Component` | Software components |
| `conversation` | `conversationSchema` | `Conversation` | Customer conversations |
| `custom_link` | `customLinkSchema` | `CustomLink` | Custom relationships between objects |
| `custom_part` | `customPartSchema` | `CustomPart` | Custom product parts |
| `devu` | `devuSchema` | `Devu` | Development users |
| `directory` | `directorySchema` | `Directory` | Content directories |
| `dm` | `dmSchema` | `Dm` | Direct messages |
| `enhancement` | `enhancementSchema` | `Enhancement` | Product enhancements |
| `feature` | `featureSchema` | `Feature` | Product features |
| `group` | `groupSchema` | `Group` | User groups |
| `incident` | `incidentSchema` | `Incident` | Service incidents |
| `issue` | `issueSchema` | `Issue` | Development issues |
| `link` | `linkSchema` | `Link` | Object relationships |
| `linkable` | `linkableSchema` | `Linkable` | Linkable objects |
| `meeting` | `meetingSchema` | `Meeting` | Meetings and calls |
| `microservice` | `microserviceSchema` | `Microservice` | Microservice components |
| `object_member` | `objectMemberSchema` | `ObjectMember` | Object membership |
| `opportunity` | `opportunitySchema` | `Opportunity` | Sales opportunities |
| `product` | `productSchema` | `Product` | Products |
| `revu` | `revuSchema` | `Revu` | Revenue users (customers) |
| `runnable` | `runnableSchema` | `Runnable` | Executable components |
| `sysu` | `sysuSchema` | `Sysu` | System users |
| `tag` | `tagSchema` | `Tag` | Object tags |
| `task` | `taskSchema` | `Task` | Work tasks |
| `test_custom_type` | `testCustomTypeSchema` | `TestCustomType` | Test custom objects |
| `ticket` | `ticketSchema` | `Ticket` | Support tickets |

## Base Schema

All DevRev objects extend the base schema:

```typescript
export const baseDevRevObjectSchema = z.object({
  id: z.string().describe("Unique identifier for the object"),
  created_date: z.string().describe("ISO timestamp when the object was created"),
  modified_date: z.string().describe("ISO timestamp when the object was last modified"),
  created_by_id: z.string().optional().describe("User ID of the user that created the object"),
  modified_by_id: z.string().optional().describe("User ID of the user that last modified the object"),
  tags: z.array(z.string()).optional().describe("Tags associated with the object"),
  item_url_field: z.string().optional().describe("Link to the item in the origin system"),
})
```

## Common Enums

Pre-defined enums for consistent validation:

```typescript
export const severityEnum = z.enum(["sev0", "sev1", "sev2", "sev3"])
export const priorityEnum = z.enum(["p0", "p1", "p2", "p3"])
export const stateEnum = z.enum(["active", "inactive", "deactivated"])
export const environmentEnum = z.enum(["production", "development", "staging"])
export const visibilityEnum = z.enum(["public", "private", "internal"])
export const accessLevelEnum = z.enum(["public", "private", "restricted"])
export const userTypeEnum = z.enum(["user", "group"])
export const groupTypeEnum = z.enum(["static", "dynamic"])
```

## Utility Functions

### `validateDevRevObject(objectType, data)`

Validates data against a specific object schema:

```typescript
const result = validateDevRevObject("ticket", ticketData)
if (result.success) {
  // data is valid
  console.log("Valid ticket:", result.data.title)
} else {
  // handle validation errors
  result.error.issues.forEach(issue => {
    console.log(`${issue.path.join('.')}: ${issue.message}`)
  })
}
```

### `getSupportedDevRevObjectTypes()`

Returns all supported object type strings:

```typescript
const types = getSupportedDevRevObjectTypes()
// ['account', 'ticket', 'article', ...]
```

### `isValidDevRevObjectType(objectType)`

Type guard to check if a string is a valid object type:

```typescript
if (isValidDevRevObjectType(userInput)) {
  // userInput is typed as DevRevObjectType
  const schema = getDevRevObjectSchema(userInput)
}
```

### `getDevRevObjectSchema(objectType)`

Gets the Zod schema for a specific object type:

```typescript
const schema = getDevRevObjectSchema("account")
const result = schema.safeParse(data)
```

## Discriminated Union

For type-safe handling of mixed object types:

```typescript
import { devRevObjectSchema } from "@/src/types/devrev-objects"

const objectWithType = {
  object_type: "account" as const,
  id: "acc-123",
  // ... other account fields
}

const result = devRevObjectSchema.safeParse(objectWithType)
if (result.success) {
  // TypeScript knows the exact type based on object_type
  switch (result.data.object_type) {
    case "account":
      console.log("Account:", result.data.display_name)
      break
    case "ticket":
      console.log("Ticket:", result.data.title)
      break
    // ... other cases
  }
}
```

## Usage Examples

### 1. Validating Airdrop Data

```typescript
import { ticketSchema } from "@/src/types/devrev-objects"

// Validate external data before loading into DevRev
function processExternalTicket(externalData: any) {
  const devrevTicket = {
    id: `ticket-${externalData.id}`,
    created_date: externalData.created_at,
    modified_date: externalData.updated_at,
    title: externalData.subject,
    body: externalData.description,
    applies_to_part_id: "part-support",
    severity: mapPriorityToSeverity(externalData.priority),
    stage: "new" as const,
    owned_by_ids: [externalData.assignee_id],
    account_id: externalData.customer_id,
    item_url_field: `https://external.com/tickets/${externalData.id}`
  }

  const result = ticketSchema.safeParse(devrevTicket)
  if (result.success) {
    return result.data
  } else {
    throw new Error(`Invalid ticket data: ${result.error.message}`)
  }
}
```

### 2. Form Validation

```typescript
import { accountSchema } from "@/src/types/devrev-objects"

function validateAccountForm(formData: unknown) {
  const result = accountSchema.safeParse(formData)
  
  if (!result.success) {
    // Return user-friendly error messages
    return {
      isValid: false,
      errors: result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    }
  }
  
  return { isValid: true, data: result.data }
}
```

### 3. API Response Validation

```typescript
import { articleSchema } from "@/src/types/devrev-objects"

async function fetchArticle(id: string) {
  const response = await fetch(`/api/articles/${id}`)
  const data = await response.json()
  
  const result = articleSchema.safeParse(data)
  if (result.success) {
    return result.data // Typed as Article
  } else {
    throw new Error(`Invalid article data received from API`)
  }
}
```

### 4. Code Generation

```typescript
import { getSupportedDevRevObjectTypes, getDevRevObjectSchema } from "@/src/types/devrev-objects"

// Generate TypeScript interfaces for all objects
function generateInterfaces() {
  const types = getSupportedDevRevObjectTypes()
  
  return types.map(type => {
    const schema = getDevRevObjectSchema(type)
    return `export interface ${capitalize(type)} {
      // Generated from ${type} schema
      ${generateFieldsFromSchema(schema)}
    }`
  }).join('\n\n')
}
```

## Integration with Type Generator

The schemas integrate with the existing type generator:

```typescript
// In type-generator.ts
import { devRevObjectSchemas, type DevRevObjectType } from "@/src/types/devrev-objects"

export function generateTypesFromSchemas(config: AirdropProjectConfig) {
  const objectTypes = config.devrevObjects as DevRevObjectType[]
  
  return objectTypes.map(type => {
    const schema = devRevObjectSchemas[type]
    return generateTypeFromSchema(type, schema)
  }).join('\n')
}
```

## Error Handling

Zod provides detailed error information:

```typescript
const result = ticketSchema.safeParse(invalidData)
if (!result.success) {
  result.error.issues.forEach(issue => {
    console.log(`Field: ${issue.path.join('.')}`)
    console.log(`Error: ${issue.message}`)
    console.log(`Code: ${issue.code}`)
    if (issue.code === 'invalid_enum_value') {
      console.log(`Expected: ${issue.options.join(', ')}`)
      console.log(`Received: ${issue.received}`)
    }
  })
}
```

## Performance Considerations

- Schemas are compiled once and reused
- Use `safeParse()` for validation without throwing exceptions
- Consider caching parsed results for repeated validation
- Use discriminated unions for efficient type narrowing

## Contributing

When adding new DevRev object types:

1. Add the schema in `devrev-objects.ts`
2. Add it to the `devRevObjectSchemas` map
3. Add it to the discriminated union
4. Export the TypeScript type
5. Add tests in `devrev-objects.test.ts`
6. Update this documentation

## Related Files

- `src/types/devrev-objects.ts` - Main schemas file
- `src/types/devrev-objects.test.ts` - Test suite
- `examples/devrev-object-validation.ts` - Usage examples
- `src/utils/generators/type-generator.ts` - Type generation integration
- `apps/fern-api-docs/fern/docs/pages/airdrop/supported-object-types.mdx` - Source documentation 