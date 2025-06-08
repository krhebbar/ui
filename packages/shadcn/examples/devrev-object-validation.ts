#!/usr/bin/env tsx

/**
 * Example: Using DevRev Object Zod Schemas for Validation
 * 
 * This example demonstrates how to use the generated Zod schemas
 * for validating DevRev objects in airdrop projects.
 */

import {
  accountSchema,
  ticketSchema,
  articleSchema,
  validateDevRevObject,
  getSupportedDevRevObjectTypes,
  isValidDevRevObjectType,
  devRevObjectSchema,
  type Account,
  type Ticket,
  type Article,
  type DevRevObject
} from "../src/types/devrev-objects"

// =============================================================================
// Example 1: Basic Object Validation
// =============================================================================

console.log("🔍 Example 1: Basic Object Validation\n")

// Valid account object
const validAccount: Account = {
  id: "acc-12345",
  created_date: "2023-01-01T00:00:00Z",
  modified_date: "2023-01-01T00:00:00Z",
  display_name: "Acme Corporation",
  description: "Leading technology solutions provider",
  environment: "production",
  owned_by: ["dev-user-001", "dev-user-002"],
  phone_numbers: ["+1-555-0100", "+1-555-0200"],
  state: "active",
  websites: ["https://acme.com", "https://support.acme.com"],
  tags: ["enterprise", "key-customer"]
}

// Validate using schema directly
const accountResult = accountSchema.safeParse(validAccount)
if (accountResult.success) {
  console.log("✅ Account validation successful")
  console.log(`   Account: ${accountResult.data.display_name}`)
  console.log(`   State: ${accountResult.data.state}`)
  console.log(`   Owners: ${accountResult.data.owned_by.length}`)
} else {
  console.log("❌ Account validation failed:", accountResult.error.message)
}

// =============================================================================
// Example 2: Ticket Validation with Error Handling
// =============================================================================

console.log("\n🎫 Example 2: Ticket Validation with Error Handling\n")

// Invalid ticket object (missing required fields)
const invalidTicket = {
  id: "ticket-789",
  created_date: "2023-01-15T00:00:00Z",
  title: "Login Issues",
  // Missing: applies_to_part_id, severity, stage, owned_by_ids
}

const ticketResult = ticketSchema.safeParse(invalidTicket)
if (ticketResult.success) {
  console.log("✅ Ticket validation successful")
} else {
  console.log("❌ Ticket validation failed:")
  ticketResult.error.issues.forEach((issue, index) => {
    console.log(`   ${index + 1}. ${issue.path.join('.')}: ${issue.message}`)
  })
}

// Now with a valid ticket
const validTicket: Ticket = {
  id: "ticket-789",
  created_date: "2023-01-15T00:00:00Z",
  modified_date: "2023-01-15T00:00:00Z",
  title: "Login Issues",
  body: "Users cannot log in to the dashboard after the recent update",
  applies_to_part_id: "part-authentication",
  severity: "sev2",
  stage: "new",
  owned_by_ids: ["dev-user-003"],
  account_id: "acc-12345",
  needs_response: true,
  tags: ["bug", "authentication", "urgent"]
}

const validTicketResult = ticketSchema.safeParse(validTicket)
if (validTicketResult.success) {
  console.log("✅ Valid ticket passed validation")
  console.log(`   Ticket: ${validTicketResult.data.title}`)
  console.log(`   Severity: ${validTicketResult.data.severity}`)
  console.log(`   Stage: ${validTicketResult.data.stage}`)
}

// =============================================================================
// Example 3: Using Utility Functions
// =============================================================================

console.log("\n🛠️  Example 3: Using Utility Functions\n")

// Get all supported object types
const supportedTypes = getSupportedDevRevObjectTypes()
console.log(`📋 Total supported DevRev object types: ${supportedTypes.length}`)
console.log(`   First 10: ${supportedTypes.slice(0, 10).join(', ')}...`)

// Validate object type strings
const testTypes = ["account", "ticket", "article", "invalid_type", "comment"]
console.log("\n🔍 Object type validation:")
testTypes.forEach(type => {
  const isValid = isValidDevRevObjectType(type)
  console.log(`   ${type}: ${isValid ? '✅' : '❌'}`)
})

// Use utility function for validation
console.log("\n🧪 Using validateDevRevObject utility:")
const utilityResult = validateDevRevObject("account", validAccount)
if (utilityResult.success) {
  console.log("✅ Utility validation successful")
} else {
  console.log("❌ Utility validation failed")
}

// =============================================================================
// Example 4: Discriminated Union Validation
// =============================================================================

console.log("\n🏷️  Example 4: Discriminated Union Validation\n")

// Create objects with object_type discriminator
const accountWithType = {
  object_type: "account" as const,
  ...validAccount
}

const ticketWithType = {
  object_type: "ticket" as const,
  ...validTicket
}

const objects = [accountWithType, ticketWithType]

console.log("Validating objects with discriminated union:")
objects.forEach((obj, index) => {
  const result = devRevObjectSchema.safeParse(obj)
  if (result.success) {
    console.log(`   ${index + 1}. ✅ ${result.data.object_type} (${result.data.id})`)
  } else {
    console.log(`   ${index + 1}. ❌ Validation failed`)
  }
})

// =============================================================================
// Example 5: Article with Rich Content
// =============================================================================

console.log("\n📄 Example 5: Article with Rich Content\n")

const knowledgeBaseArticle: Article = {
  id: "article-kb-001",
  created_date: "2023-01-20T00:00:00Z",
  modified_date: "2023-01-22T00:00:00Z",
  title: "How to Configure Single Sign-On (SSO)",
  content: `
# Single Sign-On Configuration Guide

This guide walks you through setting up SSO for your organization.

## Prerequisites
- Admin access to your identity provider
- DevRev organization admin permissions

## Steps
1. Navigate to Settings > Authentication
2. Click "Configure SSO"
3. Enter your SAML metadata URL
4. Test the configuration
5. Enable for all users

For support, contact our technical team.
  `.trim(),
  authored_by_ids: ["dev-user-004"],
  owned_by_ids: ["dev-user-004", "dev-user-005"],
  status: "published",
  language: "en",
  published_date: "2023-01-22T10:00:00Z",
  access_level: "public",
  aliases: ["sso-setup", "single-sign-on"],
  applies_to_part_ids: ["part-authentication", "part-security"],
  tags: ["sso", "authentication", "setup-guide"]
}

const articleResult = articleSchema.safeParse(knowledgeBaseArticle)
if (articleResult.success) {
  console.log("✅ Article validation successful")
  console.log(`   Title: ${articleResult.data.title}`)
  console.log(`   Status: ${articleResult.data.status}`)
  console.log(`   Language: ${articleResult.data.language}`)
  console.log(`   Content length: ${articleResult.data.content?.length || 0} chars`)
  console.log(`   Tags: ${articleResult.data.tags?.join(', ') || 'none'}`)
}

// =============================================================================
// Example 6: Data Transformation and Validation Pipeline
// =============================================================================

console.log("\n🔄 Example 6: Data Transformation and Validation Pipeline\n")

// Simulate external data that needs validation and transformation
const externalTicketData = {
  external_id: "ext-ticket-001",
  subject: "Payment Processing Error",
  description: "Customer unable to complete payment",
  priority_level: "high",
  assigned_to: "john.doe@company.com",
  customer_account: "customer-456",
  status: "open",
  created_at: "2023-01-25T14:30:00Z"
}

// Transform external data to DevRev format
const transformedTicket = {
  id: `ticket-${externalTicketData.external_id}`,
  created_date: externalTicketData.created_at,
  modified_date: externalTicketData.created_at,
  title: externalTicketData.subject,
  body: externalTicketData.description,
  applies_to_part_id: "part-payments",
  severity: externalTicketData.priority_level === "high" ? "sev1" as const : "sev2" as const,
  stage: externalTicketData.status === "open" ? "new" as const : "in_progress" as const,
  owned_by_ids: ["dev-user-006"], // Map from email to user ID
  account_id: externalTicketData.customer_account,
  tags: ["payment", "customer-issue"],
  item_url_field: `https://external-system.com/tickets/${externalTicketData.external_id}`
}

const transformationResult = ticketSchema.safeParse(transformedTicket)
if (transformationResult.success) {
  console.log("✅ External data transformed and validated successfully")
  console.log(`   Original: ${externalTicketData.subject}`)
  console.log(`   DevRev ID: ${transformationResult.data.id}`)
  console.log(`   Severity: ${transformationResult.data.severity}`)
  console.log(`   External URL: ${transformationResult.data.item_url_field}`)
} else {
  console.log("❌ Transformation validation failed")
  transformationResult.error.issues.forEach(issue => {
    console.log(`   ${issue.path.join('.')}: ${issue.message}`)
  })
}

console.log("\n🎉 DevRev Object Validation Examples Complete!\n")

// Export example data for use in other scripts
export {
  validAccount,
  validTicket,
  knowledgeBaseArticle,
  transformedTicket
} 