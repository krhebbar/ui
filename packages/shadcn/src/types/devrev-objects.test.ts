import { describe, it, expect } from "vitest"
import { 
  accountSchema, 
  ticketSchema, 
  articleSchema,
  validateDevRevObject,
  getSupportedDevRevObjectTypes,
  isValidDevRevObjectType,
  devRevObjectSchema
} from "./devrev-objects"

describe("DevRev Object Schemas", () => {
  describe("accountSchema", () => {
    it("should validate a valid account object", () => {
      const validAccount = {
        id: "acc-123",
        created_date: "2023-01-01T00:00:00Z",
        modified_date: "2023-01-01T00:00:00Z",
        display_name: "Acme Corp",
        description: "Leading technology company",
        environment: "production" as const,
        owned_by: ["user-123"],
        phone_numbers: ["+1-555-0100"],
        state: "active" as const,
        websites: ["https://acme.com"],
        tags: ["enterprise", "key-account"]
      }

      const result = accountSchema.safeParse(validAccount)
      expect(result.success).toBe(true)
    })

    it("should reject an account object missing required fields", () => {
      const invalidAccount = {
        id: "acc-123",
        created_date: "2023-01-01T00:00:00Z",
        // missing display_name, owned_by, state
      }

      const result = accountSchema.safeParse(invalidAccount)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it("should reject an account with invalid state enum", () => {
      const invalidAccount = {
        id: "acc-123",
        created_date: "2023-01-01T00:00:00Z",
        modified_date: "2023-01-01T00:00:00Z",
        display_name: "Acme Corp",
        owned_by: ["user-123"],
        state: "invalid_state" // Invalid enum value
      }

      const result = accountSchema.safeParse(invalidAccount)
      expect(result.success).toBe(false)
    })
  })

  describe("ticketSchema", () => {
    it("should validate a valid ticket object", () => {
      const validTicket = {
        id: "ticket-123",
        created_date: "2023-01-01T00:00:00Z",
        modified_date: "2023-01-01T00:00:00Z",
        title: "Unable to login to dashboard",
        body: "Users are reporting issues logging into the dashboard",
        applies_to_part_id: "part-auth",
        severity: "sev2" as const,
        stage: "new" as const,
        owned_by_ids: ["user-456"],
        account_id: "acc-123",
        needs_response: true,
        tags: ["bug", "auth"]
      }

      const result = ticketSchema.safeParse(validTicket)
      expect(result.success).toBe(true)
    })

    it("should reject a ticket with invalid severity", () => {
      const invalidTicket = {
        id: "ticket-123",
        created_date: "2023-01-01T00:00:00Z",
        modified_date: "2023-01-01T00:00:00Z",
        title: "Test ticket",
        applies_to_part_id: "part-test",
        severity: "invalid_severity", // Invalid enum
        stage: "new" as const,
        owned_by_ids: ["user-456"]
      }

      const result = ticketSchema.safeParse(invalidTicket)
      expect(result.success).toBe(false)
    })
  })

  describe("articleSchema", () => {
    it("should validate a valid article object", () => {
      const validArticle = {
        id: "article-123",
        created_date: "2023-01-01T00:00:00Z",
        modified_date: "2023-01-01T00:00:00Z",
        title: "How to Setup Authentication",
        content: "This guide explains how to set up authentication...",
        authored_by_ids: ["user-789"],
        owned_by_ids: ["user-789"],
        status: "published" as const,
        language: "en",
        published_date: "2023-01-01T12:00:00Z",
        access_level: "public" as const
      }

      const result = articleSchema.safeParse(validArticle)
      expect(result.success).toBe(true)
    })
  })

  describe("discriminated union schema", () => {
    it("should validate objects with object_type discriminator", () => {
      const accountWithType = {
        object_type: "account" as const,
        id: "acc-123",
        created_date: "2023-01-01T00:00:00Z",
        modified_date: "2023-01-01T00:00:00Z",
        display_name: "Acme Corp",
        owned_by: ["user-123"],
        state: "active" as const
      }

      const result = devRevObjectSchema.safeParse(accountWithType)
      expect(result.success).toBe(true)
    })

    it("should reject objects with mismatched object_type", () => {
      const invalidObject = {
        object_type: "ticket" as const,
        // Account fields instead of ticket fields
        display_name: "Acme Corp",
        owned_by: ["user-123"],
        state: "active" as const
      }

      const result = devRevObjectSchema.safeParse(invalidObject)
      expect(result.success).toBe(false)
    })
  })

  describe("utility functions", () => {
    it("should return all supported object types", () => {
      const types = getSupportedDevRevObjectTypes()
      expect(types).toContain("account")
      expect(types).toContain("ticket")
      expect(types).toContain("article")
      expect(types).toContain("comment")
      expect(types.length).toBe(33) // All 33 supported types
    })

    it("should validate object type strings", () => {
      expect(isValidDevRevObjectType("account")).toBe(true)
      expect(isValidDevRevObjectType("ticket")).toBe(true)
      expect(isValidDevRevObjectType("invalid_type")).toBe(false)
      expect(isValidDevRevObjectType("")).toBe(false)
    })

    it("should validate objects using the utility function", () => {
      const validAccount = {
        id: "acc-123",
        created_date: "2023-01-01T00:00:00Z",
        modified_date: "2023-01-01T00:00:00Z",
        display_name: "Acme Corp",
        owned_by: ["user-123"],
        state: "active" as const
      }

      const result = validateDevRevObject("account", validAccount)
      expect(result.success).toBe(true)
    })

    it("should reject invalid objects using the utility function", () => {
      const invalidAccount = {
        id: "acc-123",
        // Missing required fields
      }

      const result = validateDevRevObject("account", invalidAccount)
      expect(result.success).toBe(false)
    })
  })
}) 