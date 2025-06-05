import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { build } from "./build"; // Adjust path as needed
import * as devrevWrapper from "../utils/devrev-cli-wrapper"; // Adjust path
import inquirer from "inquirer";

// Mock the wrapper module
vi.mock("../utils/devrev-cli-wrapper", () => ({
  createSnapInVersion: vi.fn(),
  getSnapInContext: vi.fn(),
}));

// Mock inquirer
vi.mock("inquirer");

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};
vi.mock("@/src/utils/logger", () => ({ // Adjust path for logger
  logger: mockLogger,
}));

describe("build command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    program.addCommand(build);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockVersionResponse = { id: "ver_123", name: "v1.0.0" };

  it("should call createSnapInVersion with all options from CLI flags", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    const options = {
      path: "./dist",
      packageId: "pkg_abc",
      manifestPath: "manifest.yml",
      archivePath: "archive.tar.gz",
      createPackage: true,
    };

    await program.parseAsync([
      "node", "test", "build",
      "--path", options.path,
      "--package-id", options.packageId,
      "--manifest", options.manifestPath,
      "--archive", options.archivePath,
      "--create-package",
    ]);

    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith(options.path, {
      packageId: options.packageId,
      manifestPath: options.manifestPath,
      archivePath: options.archivePath,
      createPackage: options.createPackage,
    });
    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in version created successfully:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockVersionResponse, null, 2));
  });

  it("should prompt for path and manifest if not provided", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({ snap_in_package_id: "pkg_ctx" } as any); // Context provides packageId
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ pathOrArchive: "./prompted-dist", type: "Code Path" }) // path
      .mockResolvedValueOnce({ manifestPath: "prompted-manifest.yaml" }); // manifest

    await program.parseAsync(["node", "test", "build"]);

    expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith("./prompted-dist", {
        packageId: "pkg_ctx", // From context
        manifestPath: "prompted-manifest.yaml", // From prompt
        archivePath: undefined, // Not prompted for if path is given
        createPackage: undefined, // Not specified
    });
  });

  it("should use archivePath from prompt", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({} as any); // No context packageId
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ pathOrArchive: "./prompted.zip", type: "Archive Path" }) // archive
      .mockResolvedValueOnce({ packageId: "prompted-pkg-id" }) // packageId (since no context and no --create-package)
      .mockResolvedValueOnce({ manifestPath: "" }); // manifest (empty for auto-detect)


    await program.parseAsync(["node", "test", "build"]);

    expect(inquirer.prompt).toHaveBeenCalledTimes(3);
    // When archivePath is used, the first arg to createSnapInVersion is "" if path was not also set.
    // The wrapper handles passing the actual archive path as options.archivePath
    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith("", { // main path arg is empty as archive is used
        packageId: "prompted-pkg-id",
        manifestPath: undefined, // Inquirer gave "", so it should be undefined for wrapper
        archivePath: "./prompted.zip",
        createPackage: undefined,
    });
  });


  it("should use packageId from context if available and not overridden", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({ snap_in_package_id: "ctx_pkg_id" } as any);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ pathOrArchive: "./dist", type: "Code Path" })
      .mockResolvedValueOnce({ manifestPath: "" }); // No specific manifest path

    await program.parseAsync(["node", "test", "build"]);

    expect(devrevWrapper.getSnapInContext).toHaveBeenCalled();
    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith("./dist", {
      packageId: "ctx_pkg_id",
      manifestPath: undefined,
      archivePath: undefined,
      createPackage: undefined,
    });
  });

  it("should prompt for packageId if no context and --create-package is not set", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({} as any); // No context
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ pathOrArchive: "./dist", type: "Code Path" })
      .mockResolvedValueOnce({ packageId: "prompted-pkg-for-build" }) // Prompt for packageId
      .mockResolvedValueOnce({ manifestPath: "" });

    await program.parseAsync(["node", "test", "build"]);

    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith("./dist", {
      packageId: "prompted-pkg-for-build",
      manifestPath: undefined,
      archivePath: undefined,
      createPackage: undefined,
    });
  });


  it("should handle --create-package flag", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    // No context needed as --create-package is specified
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({} as any);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ pathOrArchive: "./dist", type: "Code Path" })
      .mockResolvedValueOnce({ manifestPath: "" });

    await program.parseAsync(["node", "test", "build", "--create-package"]);

    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith("./dist", {
      packageId: undefined, // Not specified, relies on manifest slug + createPackage
      manifestPath: undefined,
      archivePath: undefined,
      createPackage: true,
    });
  });

  it("should exit if path or archivePath is not provided (after prompts)", async () => {
     vi.mocked(inquirer.prompt).mockResolvedValueOnce({ pathOrArchive: "", type: "Code Path" }); // Empty path

    await program.parseAsync(["node", "test", "build"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Either a code path or an archive path must be provided.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should handle errors from createSnapInVersion (CLI not found)", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.createSnapInVersion).mockRejectedValue(error);
    vi.mocked(inquirer.prompt) // Ensure prompts don't hang
      .mockResolvedValueOnce({ pathOrArchive: "./dist", type: "Code Path" })
      .mockResolvedValueOnce({ manifestPath: "" });


    await program.parseAsync(["node", "test", "build"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to create Snap-in version.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should handle generic errors from createSnapInVersion", async () => {
    const errorMessage = "Some other build error";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.createSnapInVersion).mockRejectedValue(error);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ pathOrArchive: "./dist", type: "Code Path" })
      .mockResolvedValueOnce({ manifestPath: "" });

    await program.parseAsync(["node", "test", "build"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to create Snap-in version.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
