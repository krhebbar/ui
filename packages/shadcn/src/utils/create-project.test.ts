import { existsSync } from "fs"
import path from "path"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { TEMPLATES, createProject } from "./create-project"

// Mock all external dependencies
vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs-extra", () => ({
  existsSync: vi.fn().mockReturnValue(false),
  access: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("prompts", () => ({
  default: vi.fn().mockResolvedValue({ name: "airdrop-project" }),
}))

vi.mock("../get-package-manager", () => ({
  getPackageManager: vi.fn().mockResolvedValue("npm"),
}))

const FIXTURES = path.resolve(__dirname, "../fixtures")

describe("createProject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test("should create an airdrop project with default options", async () => {
    const result = await createProject({
      cwd: "/test",
      force: false,
      components: [],
    })

    expect(result).toEqual({
      projectPath: "/test/airdrop-project",
      projectName: "airdrop-project",
      template: "airdrop",
    })
  })

  test("should create an airdrop project when monorepo is requested", async () => {
    const prompts = await import("prompts")
    vi.mocked(prompts.default).mockResolvedValueOnce({
      name: "airdrop-monorepo",
    })

    const result = await createProject({
      cwd: "/test",
      force: false,
      components: [],
    })

    expect(result).toEqual({
      projectPath: "/test/airdrop-monorepo",
      projectName: "airdrop-monorepo",
      template: "airdrop",
    })
  })

  test("should default to airdrop template", async () => {
    const result = await createProject({
      cwd: "/test",
      force: false,
      components: ["button"],
    })

    expect(result.template).toBe("airdrop")
  })

  test("should throw error if project path already exists", async () => {
    const fs = await import("fs-extra")
    vi.mocked(fs.existsSync).mockReturnValueOnce(true)

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

    await createProject({
      cwd: "/test",
      force: false,
      components: [],
    })

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  test("should throw error if path is not writable", async () => {
    const fs = await import("fs-extra")
    vi.mocked(fs.access).mockRejectedValueOnce(new Error("Permission denied"))

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

    await createProject({
      cwd: "/test",
      force: false,
      components: [],
    })

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})

