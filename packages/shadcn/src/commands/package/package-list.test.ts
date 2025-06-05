import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { packageList } from "./package-list"; // Adjust path
import * as devrevWrapper from "../../utils/devrev-cli-wrapper"; // Adjust path

// Mock the wrapper module
vi.mock("../../utils/devrev-cli-wrapper", () => ({
  listSnapInPackages: vi.fn(),
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};
vi.mock("@/src/utils/logger", () => ({ // Adjust path for logger
  logger: mockLogger,
}));

describe("package list command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    const packageCmd = new Command().name("package");
    packageCmd.addCommand(packageList);
    program.addCommand(packageCmd);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call listSnapInPackages and display the list", async () => {
    const mockPackages = [{ id: "pkg_1", name: "Package 1" }, { id: "pkg_2", name: "Package 2" }];
    vi.mocked(devrevWrapper.listSnapInPackages).mockResolvedValue(mockPackages);

    await program.parseAsync(["node", "test", "package", "list"]);

    expect(devrevWrapper.listSnapInPackages).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("Fetching list of Snap-in packages...");
    expect(mockLogger.info).toHaveBeenCalledWith("Available Snap-in packages:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockPackages, null, 2));
  });

  it("should display 'No Snap-in packages found' if list is empty", async () => {
    vi.mocked(devrevWrapper.listSnapInPackages).mockResolvedValue([]);

    await program.parseAsync(["node", "test", "package", "list"]);

    expect(mockLogger.info).toHaveBeenCalledWith("No Snap-in packages found.");
  });

  it("should display 'No Snap-in packages found' if list is null", async () => {
    vi.mocked(devrevWrapper.listSnapInPackages).mockResolvedValue(null as any);

    await program.parseAsync(["node", "test", "package", "list"]);

    expect(mockLogger.info).toHaveBeenCalledWith("No Snap-in packages found.");
  });


  it("should handle 'devrev CLI not found' error", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.listSnapInPackages).mockRejectedValue(error);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "package", "list"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to list Snap-in packages.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle generic errors from listSnapInPackages", async () => {
    const errorMessage = "Some other list error";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.listSnapInPackages).mockRejectedValue(error);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "package", "list"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to list Snap-in packages.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
