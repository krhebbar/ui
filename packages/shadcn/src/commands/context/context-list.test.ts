import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { contextList } from "./context-list"; // Adjust path
import * as devrevWrapper from "../../utils/devrev-cli-wrapper"; // Adjust path

// Mock the wrapper module
vi.mock("../../utils/devrev-cli-wrapper", () => ({
  listSnapInContexts: vi.fn(),
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

describe("context list command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    const contextCmd = new Command().name("context");
    contextCmd.addCommand(contextList);
    program.addCommand(contextCmd);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call listSnapInContexts and display the list", async () => {
    const mockContexts = ["context1", "context2 (current)", "context3"];
    vi.mocked(devrevWrapper.listSnapInContexts).mockResolvedValue(mockContexts);

    await program.parseAsync(["node", "test", "context", "list"]);

    expect(devrevWrapper.listSnapInContexts).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("Fetching list of available Snap-in contexts...");
    expect(mockLogger.info).toHaveBeenCalledWith("Available Snap-in contexts:");
    expect(console.log).toHaveBeenCalledWith("  context1"); // Non-current
    expect(mockLogger.info).toHaveBeenCalledWith("  context2 (current)"); // Current goes to logger.info
    expect(console.log).toHaveBeenCalledWith("  context3"); // Non-current
  });

  it("should display 'No Snap-in contexts found' if list is empty", async () => {
    vi.mocked(devrevWrapper.listSnapInContexts).mockResolvedValue([]);

    await program.parseAsync(["node", "test", "context", "list"]);

    expect(mockLogger.info).toHaveBeenCalledWith("No Snap-in contexts found or defined.");
  });

   it("should display 'No Snap-in contexts found' if list is null", async () => {
    vi.mocked(devrevWrapper.listSnapInContexts).mockResolvedValue(null as any);

    await program.parseAsync(["node", "test", "context", "list"]);

    expect(mockLogger.info).toHaveBeenCalledWith("No Snap-in contexts found or defined.");
  });


  it("should handle 'devrev CLI not found' error", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.listSnapInContexts).mockRejectedValue(error);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "context", "list"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to list Snap-in contexts.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle generic errors from listSnapInContexts", async () => {
    const errorMessage = "Some other context list error";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.listSnapInContexts).mockRejectedValue(error);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "context", "list"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to list Snap-in contexts.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
