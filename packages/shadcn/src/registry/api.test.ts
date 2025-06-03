import { HttpResponse, http } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { clearRegistryCache, fetchRegistry } from "./api"

const REGISTRY_URL = "http://localhost:3000"

const server = setupServer(
  http.get(`${REGISTRY_URL}/r/airdrop-connection-secret.json`, () => {
    return HttpResponse.json({
      name: "airdrop-connection-secret",
      type: "registry:file",
      dependencies: [],
      files: [
        {
          path: "registry/default/airdrop/connection/secret/manifest.yaml",
          content: "// airdrop connection secret manifest.yaml content",
          type: "registry:file",
        },
      ],
    })
  }),
  http.get(`${REGISTRY_URL}/r/airdrop-connection-oauth2.json`, () => {
    return HttpResponse.json({
      name: "airdrop-connection-oauth2",
      type: "registry:file",
      dependencies: [],
      files: [
        {
          path: "registry/default/airdrop/connection/oauth2/manifest.yaml",
          content: "// airdrop connection oauth2 manifest.yaml content",
          type: "registry:file",
        },
      ],
    })
  }),
)

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => server.close())

describe("fetchRegistry", () => {
  it("should fetch registry data for files", async () => {
    const paths = ["r/airdrop-connection-secret.json"]
    const result = await fetchRegistry(paths)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "airdrop-connection-secret",
      type: "registry:file",
      dependencies: [],
    })
  })

  it("should fetch registry data for files", async () => {
    const paths = ["r/airdrop-connection-oauth2.json"]
    const result = await fetchRegistry(paths)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "airdrop-connection-oauth2",
      type: "registry:file",
      dependencies: [],
    })
  })

  it("should use cache for subsequent requests", async () => {
    const paths = ["r/airdrop-connection-secret.json"]
    let fetchCount = 0

    // Clear any existing cache before test
    clearRegistryCache()

    // Define the handler with counter before making requests
    server.use(
      http.get(`${REGISTRY_URL}/r/airdrop-connection-secret.json`, async () => {
        // Add a small delay to simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 10))
        fetchCount++
        return HttpResponse.json({
          name: "airdrop-connection-secret",
          type: "registry:file",
          dependencies: [],
          files: [
            {
              path: "registry/default/airdrop/connection/secret/manifest.yaml",
              content: "// airdrop connection secret manifest.yaml content",
              type: "registry:file",
            },
          ],
        })
      })
    )

    // First request
    const result1 = await fetchRegistry(paths)
    expect(fetchCount).toBe(1)
    expect(result1).toHaveLength(1)
    expect(result1[0]).toMatchObject({ name: "airdrop-connection-secret" })

    // Second request - should use cache
    const result2 = await fetchRegistry(paths)
    expect(fetchCount).toBe(1) // Should still be 1
    expect(result2).toHaveLength(1)
    expect(result2[0]).toMatchObject({ name: "airdrop-connection-secret" })

    // Third request - double check cache
    const result3 = await fetchRegistry(paths)
    expect(fetchCount).toBe(1) // Should still be 1
    expect(result3).toHaveLength(1)
    expect(result3[0]).toMatchObject({ name: "airdrop-connection-secret" })
  })

  it("should handle multiple paths", async () => {
    const paths = ["r/airdrop-connection-secret.json", "r/airdrop-connection-oauth2.json"]
    const result = await fetchRegistry(paths)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ name: "airdrop-connection-secret" })
    expect(result[1]).toMatchObject({ name: "airdrop-connection-oauth2" })
  })
})
