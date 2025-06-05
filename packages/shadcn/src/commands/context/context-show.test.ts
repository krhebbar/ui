import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { contextShow } from "./context-show"; // Adjust path
import * as devrevWrapper from "../../utils/devrev-cli-wrapper"; // Adjust path

// Mock the wrapper module
vi.mock("../../utils/devrev-cli-wrapper", () => ({
  getSnapInContext: vi.fn(),
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

describe("context show command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    const contextCmd = new Command().name("context");
    contextCmd.addCommand(contextShow);
    program.addCommand(contextCmd);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call getSnapInContext and display the context", async () => {
    const mockContext = { snap_in_id: "snap_1", snap_in_package_id: "pkg_1" };
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue(mockContext);

    await program.parseAsync(["node", "test", "context", "show"]);

    expect(devrevWrapper.getSnapInContext).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("Fetching current Snap-in context...");
    expect(mockLogger.info).toHaveBeenCalledWith("Current Snap-in context:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockContext, null, 2));
  });

  it("should display 'No active Snap-in context found' if context is empty or null", async () => {
    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue({} as any); // Empty object
    await program.parseAsync(["node", "test", "context", "show"]);
    expect(mockLogger.info).toHaveBeenCalledWith("No active Snap-in context found or context is empty.");

    vi.mocked(devrevWrapper.getSnapInContext).mockResolvedValue(null as any); // Null
    await program.parseAsync(["node", "test", "context", "show"]);
    expect(mockLogger.info).toHaveBeenCalledWith("No active Snap-in context found or context is empty.");
  });

  it("should handle 'devrev CLI not found' error", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.getSnapInContext).mockRejectedValue(error);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "context", "show"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to get Snap-in context.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle 'No active context found' error from CLI", async () => {
    const error = new Error("No active context found");
    vi.mocked(devrevWrapper.getSnapInContext).mockRejectedValue(error);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "context", "show"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to get Snap-in context.");
    expect(mockLogger.error).toHaveBeenCalledWith("Error: No active Snap-in context is currently set in DevRev CLI.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle generic errors from getSnapInContext", async () => {
    const errorMessage = "Some other context error";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.getSnapInContext).mockRejectedValue(error);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "context", "show"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to get Snap-in context.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
