import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { packageCreate } from "./package-create"; // Adjust path
import * as devrevWrapper from "../../utils/devrev-cli-wrapper"; // Adjust path
import inquirer from "inquirer";

// Mock the wrapper module
vi.mock("../../utils/devrev-cli-wrapper", () => ({
  createSnapInPackage: vi.fn(),
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

describe("package create command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    // Attach the command to a subcommand of 'package' to match its structure
    const packageCmd = new Command().name("package");
    packageCmd.addCommand(packageCreate);
    program.addCommand(packageCmd);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call createSnapInPackage with slug from option", async () => {
    const mockSlug = "test-package-slug";
    const mockResponse = { id: "pkg_123", slug: mockSlug };
    vi.mocked(devrevWrapper.createSnapInPackage).mockResolvedValue(mockResponse);

    await program.parseAsync(["node", "test", "package", "create", "--slug", mockSlug]);

    expect(devrevWrapper.createSnapInPackage).toHaveBeenCalledWith(mockSlug);
    expect(mockLogger.info).toHaveBeenCalledWith(`Creating Snap-in package with slug: ${mockSlug}...`);
    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in package created successfully:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockResponse, null, 2));
  });

  it("should prompt for slug if not provided and call createSnapInPackage", async () => {
    const mockSlug = "prompted-slug";
    const mockResponse = { id: "pkg_456", slug: mockSlug };
    vi.mocked(inquirer.prompt).mockResolvedValue({ slug: mockSlug });
    vi.mocked(devrevWrapper.createSnapInPackage).mockResolvedValue(mockResponse);

    await program.parseAsync(["node", "test", "package", "create"]);

    expect(inquirer.prompt).toHaveBeenCalled();
    expect(devrevWrapper.createSnapInPackage).toHaveBeenCalledWith(mockSlug);
    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in package created successfully:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockResponse, null, 2));
  });

  it("should handle 'devrev CLI not found' error", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.createSnapInPackage).mockRejectedValue(error);

    // Mock process.exit to prevent test runner from exiting
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "package", "create", "--slug", "error-slug"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to create Snap-in package.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle 'package already exists' error", async () => {
    const slug = "existing-slug";
    const error = new Error(`A Snap-in package with slug '${slug}' already exists.`);
    vi.mocked(devrevWrapper.createSnapInPackage).mockRejectedValue(error);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "package", "create", "--slug", slug]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to create Snap-in package.");
    expect(mockLogger.error).toHaveBeenCalledWith(`Error: A Snap-in package with slug '${slug}' already exists.`);
    expect(mockExit).toHaveBeenCalledWith(1);
  });


  it("should handle generic errors from createSnapInPackage", async () => {
    const errorMessage = "Some other error";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.createSnapInPackage).mockRejectedValue(error);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);


    await program.parseAsync(["node", "test", "package", "create", "--slug", "generic-error-slug"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to create Snap-in package.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
