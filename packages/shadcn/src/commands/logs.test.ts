import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { logs } from "./logs"; // Adjust path as needed
import * as devrevWrapper from "../utils/devrev-cli-wrapper"; // Adjust path

// Mock the wrapper module
vi.mock("../utils/devrev-cli-wrapper", () => ({
  getSnapInLogs: vi.fn(),
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  break: vi.fn(), // if used
};
vi.mock("@/src/utils/logger", () => ({ // Adjust path for logger
  logger: mockLogger,
}));


describe("logs command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks(); // Reset mocks before each test

    program = new Command();
    program.addCommand(logs);

    // Suppress actual console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore console.log
  });

  it("should call getSnapInLogs with default limit and display logs", async () => {
    const mockLogData = [{ timestamp: "2024-01-01T00:00:00Z", message: "Log entry 1" }];
    vi.mocked(devrevWrapper.getSnapInLogs).mockResolvedValue(mockLogData);

    await program.parseAsync(["node", "test", "logs"]);

    expect(devrevWrapper.getSnapInLogs).toHaveBeenCalledWith({ limit: 100 }); // Default limit
    expect(mockLogger.info).toHaveBeenCalledWith("Fetching Snap-in logs using devrev-cli...");
    expect(mockLogger.info).toHaveBeenCalledWith("Logs retrieved successfully:");
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockLogData[0], null, 2));
  });

  it("should call getSnapInLogs with all provided options", async () => {
    const options = {
      after: "1h",
      before: "30m",
      filters: '{"level":"info"}',
      limit: 50,
    };
    vi.mocked(devrevWrapper.getSnapInLogs).mockResolvedValue([]);

    await program.parseAsync([
      "node",
      "test",
      "logs",
      "--after", options.after,
      "--before", options.before,
      "--filters", options.filters,
      "--limit", options.limit.toString(),
    ]);

    expect(devrevWrapper.getSnapInLogs).toHaveBeenCalledWith(options);
  });

  it("should display 'No logs found' if getSnapInLogs returns empty", async () => {
    vi.mocked(devrevWrapper.getSnapInLogs).mockResolvedValue([]);
    await program.parseAsync(["node", "test", "logs"]);
    expect(mockLogger.info).toHaveBeenCalledWith("No logs found for the given criteria.");
  });

  it("should display 'No logs found' if getSnapInLogs returns null", async () => {
    vi.mocked(devrevWrapper.getSnapInLogs).mockResolvedValue(null as any); // Simulate null response
    await program.parseAsync(["node", "test", "logs"]);
    expect(mockLogger.info).toHaveBeenCalledWith("No logs found for the given criteria.");
  });


  it("should handle errors from getSnapInLogs (devrev CLI not found)", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.getSnapInLogs).mockRejectedValue(error);

    await program.parseAsync(["node", "test", "logs"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to fetch Snap-in logs.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
  });

  it("should handle errors from getSnapInLogs (snap_in_package_id not found)", async () => {
    const error = new Error("DevRev CLI command failed: snap_in_package_id not found in context");
    vi.mocked(devrevWrapper.getSnapInLogs).mockRejectedValue(error);

    await program.parseAsync(["node", "test", "logs"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to fetch Snap-in logs.");
    expect(mockLogger.error).toHaveBeenCalledWith("Snap-in package ID not found in the current DevRev context.");
  });


  it("should handle generic errors from getSnapInLogs", async () => {
    const errorMessage = "Some other error";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.getSnapInLogs).mockRejectedValue(error);

    await program.parseAsync(["node", "test", "logs"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to fetch Snap-in logs.");
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
  });
});
