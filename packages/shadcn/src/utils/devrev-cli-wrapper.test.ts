import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { execa } from "execa";
import {
  // executeDevrevCommand, // Not exporting this one, but it's tested via others
  getSnapInContext,
  createSnapInPackage,
  listSnapInPackages,
  createSnapInVersion,
  showSnapInVersion,
  listSnapInVersions,
  draftSnapIn,
  activateSnapIn,
  getSnapInLogs,
  listSnapInContexts,
  checkoutSnapInContext,
} from "./devrev-cli-wrapper"; // Adjust path as needed

// Mock execa
vi.mock("execa");

describe("DevRev CLI Wrapper", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });

  describe("executeDevrevCommand (indirectly tested)", () => {
    it("should resolve with stdout on successful command execution", async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: "Success",
        stderr: "",
        exitCode: 0,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any); // Type assertion for simplicity

      // Example: Using getSnapInContext to test underlying executeDevrevCommand
      await expect(getSnapInContext()).resolves.toBeTruthy(); // Will fail on parsing, but execa part is tested
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_context", "show"]);
    });

    it("should throw an error if command fails (non-zero exit code)", async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: "",
        stderr: "Command failed",
        exitCode: 1,
        failed: true,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      await expect(getSnapInContext()).rejects.toThrow(
        "DevRev CLI command failed with exit code 1: Command failed"
      );
    });

    it("should throw an error if execa itself throws", async () => {
      vi.mocked(execa).mockRejectedValue(new Error("execa error"));
      await expect(getSnapInContext()).rejects.toThrow("execa error");
    });
  });

  describe("getSnapInContext", () => {
    it("should parse snap_in_context show output", async () => {
      const mockOutput = `
        Snap-in ID: snap_in_123
        Snap-in Package ID: pkg_456
        Snap-in Version ID: ver_789
        Some Other Info: test
      `;
      vi.mocked(execa).mockResolvedValue({ stdout: mockOutput, exitCode: 0 } as any);
      const context = await getSnapInContext();
      expect(context).toEqual({
        snap_in_id: "snap_in_123",
        snap_in_package_id: "pkg_456",
        snap_in_version_id: "ver_789",
      });
    });

    it("should handle malformed output for getSnapInContext", async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: "Malformed output", exitCode: 0 } as any);
      // Expecting specific parsing to result in undefined/empty rather than throwing,
      // unless the parsing itself is designed to throw on malformed.
      // Current implementation will likely return { snap_in_id: undefined, ... }
      const context = await getSnapInContext();
      expect(context.snap_in_id).toBeUndefined();
      expect(context.snap_in_package_id).toBeUndefined();
    });
  });

  describe("createSnapInPackage", () => {
    it("should create and parse JSON output", async () => {
      const mockPkg = { id: "pkg_123", name: "test-pkg" };
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockPkg), exitCode: 0 } as any);
      const result = await createSnapInPackage("test-pkg");
      expect(result).toEqual(mockPkg);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_package", "create-one", "--slug", "test-pkg"]);
    });
  });

  describe("listSnapInPackages", () => {
    it("should list and parse JSON output", async () => {
      const mockPkgs = [{ id: "pkg_123" }, { id: "pkg_456" }];
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockPkgs), exitCode: 0 } as any);
      const result = await listSnapInPackages();
      expect(result).toEqual(mockPkgs);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_package", "list"]);
    });
  });

  describe("createSnapInVersion", () => {
    it("should create with path and parse JSON", async () => {
      const mockVersion = { id: "ver_123", path: "./dist" };
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockVersion), exitCode: 0 } as any);
      const result = await createSnapInVersion("./dist");
      expect(result).toEqual(mockVersion);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_version", "create-one", "--path", "./dist"]);
    });

    it("should create with all options", async () => {
      const mockVersion = { id: "ver_123" };
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockVersion), exitCode: 0 } as any);
      const options = {
        packageId: "pkg_1",
        manifestPath: "mf.yaml",
        archivePath: "archive.zip", // Note: if archivePath is given, path arg to createSnapInVersion is ""
        createPackage: true,
        testingUrl: "http://localhost:3000",
      };
      // When archivePath is used, the first argument to createSnapInVersion (path) should be an empty string or handled appropriately by the wrapper.
      // Current wrapper passes path as first arg, then options.archivePath as --archive.
      // If archivePath is present, the initial 'path' argument to createSnapInVersion itself should be the archive path, or the logic needs adjustment.
      // For this test, assuming 'path' is the primary identifier if not archive.
      // Let's assume the wrapper passes path as the first arg and archivePath as an option.
      // If createSnapInVersion expects archivePath to replace 'path', this test needs adjustment.
      // Based on current wrapper: createSnapInVersion(path, options)
      // If options.archivePath is set, the `path` argument to `executeDevrevCommand` for `snap_in_version create-one` is still the first arg.
      // The devrev CLI itself might prioritize --archive over --path if both are somehow passed.
      // Let's test with path being the archive path itself for clarity with CLI behavior.

      // If archivePath is used, the main path arg to createSnapInVersion becomes the archive path.
      // The wrapper currently takes `path` and `options.archivePath`. If `options.archivePath` is used, `path` is still passed.
      // This test assumes `path` is provided, and `options.archivePath` is an *additional* option.
      // If the CLI intends `archivePath` to *replace* the positional path, the wrapper or test needs adjustment.
      // For this test, let's assume `path` is "src" and `archivePath` is an option.
      await createSnapInVersion("src", options);

      expect(execa).toHaveBeenCalledWith("devrev", [
        "snap_in_version",
        "create-one",
        "--path", "src", // This is the main path argument
        "--package", options.packageId,
        "--manifest", options.manifestPath,
        "--archive", options.archivePath, // This is passed as an option
        "--create-package",
        "--testing-url", options.testingUrl,
      ]);
    });
  });

  describe("showSnapInVersion", () => {
    it("should show with ID and parse JSON", async () => {
      const mockVersion = { id: "ver_123" };
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockVersion), exitCode: 0 } as any);
      const result = await showSnapInVersion("ver_123");
      expect(result).toEqual(mockVersion);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_version", "show", "ver_123"]);
    });
     it("should show without ID (context) and parse JSON", async () => {
      const mockVersion = { id: "ver_ctx" };
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockVersion), exitCode: 0 } as any);
      const result = await showSnapInVersion();
      expect(result).toEqual(mockVersion);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_version", "show"]);
    });
  });

  describe("listSnapInVersions", () => {
    it("should list and parse JSON", async () => {
      const mockVersions = [{ id: "ver_123" }];
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockVersions), exitCode: 0 } as any);
      const result = await listSnapInVersions();
      expect(result).toEqual(mockVersions);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_version", "list"]);
    });
     it("should list with package ID and parse JSON", async () => {
      const mockVersions = [{ id: "ver_456" }];
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockVersions), exitCode: 0 } as any);
      const result = await listSnapInVersions("pkg_1");
      expect(result).toEqual(mockVersions);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_version", "list", "--package", "pkg_1"]);
    });
  });

  describe("draftSnapIn", () => {
    it("should draft with version ID and parse JSON", async () => {
      const mockDraft = { id: "snap_1", url: "http://draft.url" };
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockDraft), exitCode: 0 } as any);
      const result = await draftSnapIn("ver_123");
      expect(result).toEqual(mockDraft);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in", "draft", "--snap_in_version", "ver_123"]);
    });
     it("should draft without version ID (context) and parse JSON", async () => {
      const mockDraft = { id: "snap_ctx" };
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockDraft), exitCode: 0 } as any);
      const result = await draftSnapIn();
      expect(result).toEqual(mockDraft);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in", "draft"]);
    });
  });

  describe("activateSnapIn", () => {
    it("should activate with ID", async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: "Activated", exitCode: 0 } as any);
      const result = await activateSnapIn("snap_1");
      expect(result).toBe("Activated");
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in", "activate", "snap_1"]);
    });
     it("should activate without ID (context)", async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: "Activated context", exitCode: 0 } as any);
      const result = await activateSnapIn();
      expect(result).toBe("Activated context");
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in", "activate"]);
    });
  });

  describe("getSnapInLogs", () => {
    it("should get logs and parse JSON", async () => {
      const mockLogs = [{ message: "log1" }];
      vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockLogs), exitCode: 0 } as any);
      const result = await getSnapInLogs();
      expect(result).toEqual(mockLogs);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_package", "logs"]);
    });

    it("should get logs with all filters", async () => {
      const mockLogs = [{ message: "log2" }];
       vi.mocked(execa).mockResolvedValue({ stdout: JSON.stringify(mockLogs), exitCode: 0 } as any);
      const options = {
        after: "1h",
        before: "now",
        filters: '{"level":"error"}',
        limit: 50,
      };
      const result = await getSnapInLogs(options);
      expect(result).toEqual(mockLogs);
      expect(execa).toHaveBeenCalledWith("devrev", [
        "snap_in_package", "logs",
        "--after", options.after,
        "--before", options.before,
        "--filters", options.filters,
        "--limit", options.limit.toString(),
      ]);
    });
  });

   describe("listSnapInContexts", () => {
    it("should parse plain text output", async () => {
      const mockOutput = `
Available contexts:
  ctx1
  ctx2 (current)
  ctx3
`;
      vi.mocked(execa).mockResolvedValue({ stdout: mockOutput, exitCode: 0 } as any);
      const contexts = await listSnapInContexts();
      // The filter in the function removes "Available contexts:" and empty lines
      expect(contexts).toEqual(["ctx1", "ctx2 (current)", "ctx3"]);
    });

    it("should handle empty output", async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: "", exitCode: 0 } as any);
      const contexts = await listSnapInContexts();
      expect(contexts).toEqual([]);
    });

    it("should handle output with only header or current context line", async () => {
      const mockOutput = "Current context: ctx1";
      vi.mocked(execa).mockResolvedValue({ stdout: mockOutput, exitCode: 0 } as any);
      const contexts = await listSnapInContexts();
      expect(contexts).toEqual([]); // "Current context: ..." is filtered out
    });
  });

  describe("checkoutSnapInContext", () => {
    it("should checkout context", async () => {
      const successMsg = "Context 'ctx1' is now active.";
      vi.mocked(execa).mockResolvedValue({ stdout: successMsg, exitCode: 0 } as any);
      const result = await checkoutSnapInContext("ctx1");
      expect(result).toBe(successMsg);
      expect(execa).toHaveBeenCalledWith("devrev", ["snap_in_context", "checkout", "ctx1"]);
    });

    it("should throw if context not found (simulated by stderr)", async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: "",
        stderr: "Context not found",
        exitCode: 1,
      } as any);
      await expect(checkoutSnapInContext("nonexistent")).rejects.toThrow(
        "DevRev CLI command failed with exit code 1: Context not found"
      );
    });
  });

  // Generic error case for all functions that parse JSON
  const functionsReturningPromiseAny = [
    { fn: createSnapInPackage, name: "createSnapInPackage", args: ["test"] },
    { fn: listSnapInPackages, name: "listSnapInPackages", args: [] },
    { fn: createSnapInVersion, name: "createSnapInVersion", args: ["./path"] },
    { fn: showSnapInVersion, name: "showSnapInVersion", args: [] },
    { fn: listSnapInVersions, name: "listSnapInVersions", args: [] },
    { fn: draftSnapIn, name: "draftSnapIn", args: [] },
    // activateSnapIn doesn't parse JSON by default, so excluded here
    { fn: getSnapInLogs, name: "getSnapInLogs", args: [] },
  ];

  for (const { fn, name, args } of functionsReturningPromiseAny) {
    it(`${name} should throw if JSON parsing fails`, async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: "invalid JSON", exitCode: 0 } as any);
      // @ts-ignore
      await expect(fn(...args)).rejects.toThrow(/JSON.parse/);
    });
  }
});
