import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { dev } from "./dev"; // Adjust path as needed
import * as devrevWrapper from "../utils/devrev-cli-wrapper"; // Adjust path
import inquirer from "inquirer";

// Mock the wrapper module
vi.mock("../utils/devrev-cli-wrapper", () => ({
  createSnapInVersion: vi.fn(),
  draftSnapIn: vi.fn(),
  activateSnapIn: vi.fn(),
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

describe("dev command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    program.addCommand(dev);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockVersionResponse = { id: "ver_dev_123", name: "v_dev" };
  const mockDraftResponse = { id: "snap_dev_456", url: "http://draft.example.com" };
  const mockActivationResponse = "Snap-in activated successfully.";

  const defaultPath = "./";
  const defaultUrl = "http://localhost:8080";

  it("should run full dev cycle with CLI options and activate", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);
    vi.mocked(devrevWrapper.activateSnapIn).mockResolvedValue(mockActivationResponse);
    vi.mocked(inquirer.prompt).mockResolvedValue({ activate: true }); // Confirm activation

    const options = {
      path: "./src",
      url: "https://ngrok.io/test1",
      packageId: "pkg_dev_001",
      manifestPath: "dev-manifest.yml",
      createPackage: false, // Explicitly false
    };

    await program.parseAsync([
      "node", "test", "dev",
      "--path", options.path,
      "--url", options.url,
      "--package-id", options.packageId,
      "--manifest", options.manifestPath,
      // Not passing --create-package
    ]);

    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith(options.path, {
      testingUrl: options.url,
      packageId: options.packageId,
      createPackage: undefined, // Not passed, so undefined
      manifestPath: options.manifestPath,
    });
    expect(devrevWrapper.draftSnapIn).toHaveBeenCalledWith(mockVersionResponse.id);
    expect(inquirer.prompt).toHaveBeenCalled(); // For activation confirmation
    expect(devrevWrapper.activateSnapIn).toHaveBeenCalledWith(mockDraftResponse.id);

    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in test version created successfully:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockVersionResponse, null, 2));
    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in drafted successfully:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockDraftResponse, null, 2));
    expect(mockLogger.info).toHaveBeenCalledWith(`Activating Snap-in ID '${mockDraftResponse.id}'...`);
    expect(console.log).toHaveBeenCalledWith(mockActivationResponse);
  });

  it("should prompt for path and URL if not provided, use context, and skip activation", async () => {
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({ snap_in_package_id: "ctx_pkg_dev" } as any);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: defaultPath }) // Path prompt
      .mockResolvedValueOnce({ url: defaultUrl })   // URL prompt
      .mockResolvedValueOnce({ activate: false }); // Deny activation

    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);

    await program.parseAsync(["node", "test", "dev"]);

    expect(inquirer.prompt).toHaveBeenCalledTimes(3); // path, url, activate
    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith(defaultPath, {
      testingUrl: defaultUrl,
      packageId: "ctx_pkg_dev", // from context
      createPackage: undefined, // not specified
      manifestPath: undefined, // not specified
    });
    expect(devrevWrapper.draftSnapIn).toHaveBeenCalledWith(mockVersionResponse.id);
    expect(devrevWrapper.activateSnapIn).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in activation skipped by user.");
  });

  it("should use --create-package flag", async () => {
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({} as any); // No context for packageId
    vi.mocked(inquirer.prompt) // Path, URL, activation
      .mockResolvedValueOnce({ path: defaultPath })
      .mockResolvedValueOnce({ url: defaultUrl })
      .mockResolvedValueOnce({ activate: true });

    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);
    vi.mocked(devrevWrapper.activateSnapIn).mockResolvedValue(mockActivationResponse);

    await program.parseAsync(["node", "test", "dev", "--create-package"]);

    expect(devrevWrapper.createSnapInVersion).toHaveBeenCalledWith(defaultPath, {
      testingUrl: defaultUrl,
      packageId: undefined, // Not specified
      createPackage: true, // Flag is true
      manifestPath: undefined,
    });
    expect(devrevWrapper.activateSnapIn).toHaveBeenCalled();
  });

  it("should exit if createSnapInVersion fails (e.g. no version ID)", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue({} as any); // No ID in response
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: defaultPath })
      .mockResolvedValueOnce({ url: defaultUrl });

    await program.parseAsync(["node", "test", "dev"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to get Snap-in Version ID from creation response.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should exit if draftSnapIn fails (e.g. no snap ID)", async () => {
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue({} as any); // No ID in draft response
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: defaultPath })
      .mockResolvedValueOnce({ url: defaultUrl });

    await program.parseAsync(["node", "test", "dev"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to get Snap-in ID from draft response.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });


  it("should handle errors from createSnapInVersion (CLI not found)", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.createSnapInVersion).mockRejectedValue(error);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: defaultPath })
      .mockResolvedValueOnce({ url: defaultUrl });

    await program.parseAsync(["node", "test", "dev"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed during Snap-in development workflow.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should handle generic errors from draftSnapIn", async () => {
    const errorMessage = "Drafting failed";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.draftSnapIn).mockRejectedValue(error);
     vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: defaultPath })
      .mockResolvedValueOnce({ url: defaultUrl });

    await program.parseAsync(["node", "test", "dev"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed during Snap-in development workflow.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should handle errors from activateSnapIn", async () => {
    const errorMessage = "Activation failed";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.createSnapInVersion).mockResolvedValue(mockVersionResponse);
    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);
    vi.mocked(devrevWrapper.activateSnapIn).mockRejectedValue(error);
    vi.mocked(inquirer.prompt) // Path, URL, Activation
      .mockResolvedValueOnce({ path: defaultPath })
      .mockResolvedValueOnce({ url: defaultUrl })
      .mockResolvedValueOnce({ activate: true });


    await program.parseAsync(["node", "test", "dev"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed during Snap-in development workflow.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

});
