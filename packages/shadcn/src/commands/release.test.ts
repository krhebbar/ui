import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { release } from "./release"; // Adjust path as needed
import * as devrevWrapper from "../utils/devrev-cli-wrapper"; // Adjust path
import inquirer from "inquirer";

// Mock the wrapper module
vi.mock("../utils/devrev-cli-wrapper", () => ({
  draftSnapIn: vi.fn(),
  activateSnapIn: vi.fn(),
  getSnapInContext: vi.fn(),
  showSnapInVersion: vi.fn(),
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

describe("release command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    program.addCommand(release);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockDraftResponse = { id: "snap_rel_789", url: "http://release-draft.example.com" };
  const mockActivationResponse = "Snap-in release activated successfully.";
  const mockVersionDetails = { id: "ver_rel_123", name: "v_release" };

  it("should run full release cycle with version ID from option and activate", async () => {
    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);
    vi.mocked(devrevWrapper.activateSnapIn).mockResolvedValue(mockActivationResponse);
    vi.mocked(inquirer.prompt).mockResolvedValue({ activate: true }); // Confirm activation

    const versionId = "ver_from_option";
    await program.parseAsync(["node", "test", "release", "--version-id", versionId]);

    expect(devrevWrapper.getSnapInContext).not.toHaveBeenCalled(); // Should not be called if versionId is provided
    expect(devrevWrapper.draftSnapIn).toHaveBeenCalledWith(versionId);
    expect(inquirer.prompt).toHaveBeenCalled(); // For activation confirmation
    expect(devrevWrapper.activateSnapIn).toHaveBeenCalledWith(mockDraftResponse.id);

    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in drafted successfully:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockDraftResponse, null, 2));
    expect(mockLogger.info).toHaveBeenCalledWith(`Activating Snap-in ID '${mockDraftResponse.id}'...`);
    expect(console.log).toHaveBeenCalledWith(mockActivationResponse);
  });

  it("should use version ID from context, show details, and skip activation", async () => {
    const versionIdFromContext = "ver_ctx_rel_456";
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({ snap_in_version_id: versionIdFromContext } as any);
    vi.mocked(devrevWrapper.showSnapInVersion).mockResolvedValue(mockVersionDetails);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ useContextVersion: true }) // Confirm use of context version
      .mockResolvedValueOnce({ activate: false });      // Deny activation

    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);

    await program.parseAsync(["node", "test", "release"]);

    expect(devrevWrapper.getSnapInContext).toHaveBeenCalled();
    expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    expect(devrevWrapper.showSnapInVersion).toHaveBeenCalledWith(versionIdFromContext);
    expect(mockLogger.info).toHaveBeenCalledWith("Details of the version from context:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockVersionDetails, null, 2));
    expect(devrevWrapper.draftSnapIn).toHaveBeenCalledWith(versionIdFromContext);
    expect(devrevWrapper.activateSnapIn).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in activation skipped by user.");
  });

  it("should prompt for version ID if context version is declined", async () => {
    const versionIdFromContext = "ver_ctx_declined";
    const promptedVersionId = "ver_prompted_for_release";
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({ snap_in_version_id: versionIdFromContext } as any);
    vi.mocked(devrevWrapper.showSnapInVersion).mockResolvedValue(mockVersionDetails); // For context version
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ useContextVersion: false }) // Decline context version
      .mockResolvedValueOnce({ versionId: promptedVersionId }) // Prompt for new version ID
      .mockResolvedValueOnce({ activate: true });      // Confirm activation

    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);
    vi.mocked(devrevWrapper.activateSnapIn).mockResolvedValue(mockActivationResponse);

    await program.parseAsync(["node", "test", "release"]);

    expect(devrevWrapper.draftSnapIn).toHaveBeenCalledWith(promptedVersionId);
    expect(devrevWrapper.activateSnapIn).toHaveBeenCalledWith(mockDraftResponse.id);
  });


  it("should prompt for version ID if no context and no option", async () => {
    const promptedVersionId = "ver_fully_prompted";
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({} as any); // No version in context
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ versionId: promptedVersionId }) // Prompt for version ID
      .mockResolvedValueOnce({ activate: true });      // Confirm activation

    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);
    vi.mocked(devrevWrapper.activateSnapIn).mockResolvedValue(mockActivationResponse);

    await program.parseAsync(["node", "test", "release"]);

    expect(devrevWrapper.draftSnapIn).toHaveBeenCalledWith(promptedVersionId);
    expect(devrevWrapper.activateSnapIn).toHaveBeenCalledWith(mockDraftResponse.id);
  });

  it("should exit if draftSnapIn fails (e.g. no snap ID)", async () => {
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({ snap_in_version_id: "ver_test" } as any);
     vi.mocked(inquirer.prompt) // Confirm context, confirm activation
      .mockResolvedValueOnce({ useContextVersion: true })
      .mockResolvedValueOnce({ activate: true });
    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue({} as any); // No ID in draft response

    await program.parseAsync(["node", "test", "release"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to get Snap-in ID from draft response.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should handle errors from draftSnapIn (CLI not found)", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.draftSnapIn).mockRejectedValue(error);
    // To ensure it gets to draftSnapIn call
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({ snap_in_version_id: "ver_test_fail" } as any);
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ useContextVersion: true });


    await program.parseAsync(["node", "test", "release"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed during Snap-in release process.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should handle generic errors from activateSnapIn", async () => {
    const errorMessage = "Activation for release failed";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.draftSnapIn).mockResolvedValue(mockDraftResponse);
    vi.mocked(devrevWrapper.activateSnapIn).mockRejectedValue(error);
    // Setup to reach activateSnapIn
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({ snap_in_version_id: "ver_test_act_fail" } as any);
    vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ useContextVersion: true })
        .mockResolvedValueOnce({ activate: true });


    await program.parseAsync(["node", "test", "release"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed during Snap-in release process.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
