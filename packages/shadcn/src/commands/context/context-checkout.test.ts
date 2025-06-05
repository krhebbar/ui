import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { contextCheckout } from "./context-checkout"; // Adjust path
import * as devrevWrapper from "../../utils/devrev-cli-wrapper"; // Adjust path
import inquirer from "inquirer";

// Mock the wrapper module
vi.mock("../../utils/devrev-cli-wrapper", () => ({
  checkoutSnapInContext: vi.fn(),
  listSnapInContexts: vi.fn(),
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

describe("context checkout command", () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    const contextCmd = new Command().name("context");
    contextCmd.addCommand(contextCheckout);
    program.addCommand(contextCmd);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any); // Mock process.exit
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call checkoutSnapInContext with context name from argument", async () => {
    const contextName = "my-context";
    const successMsg = `Context '${contextName}' is now active.`;
    vi.mocked(devrevWrapper.checkoutSnapInContext).mockResolvedValue(successMsg);

    await program.parseAsync(["node", "test", "context", "checkout", contextName]);

    expect(devrevWrapper.checkoutSnapInContext).toHaveBeenCalledWith(contextName);
    expect(mockLogger.info).toHaveBeenCalledWith(`Checking out Snap-in context: ${contextName}...`);
    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in context checkout successful:");
    expect(console.log).toHaveBeenCalledWith(successMsg);
  });

  it("should prompt for context name if not provided and call checkoutSnapInContext", async () => {
    const availableContexts = ["context1", "context2 (current)"];
    const chosenContext = "context1";
    const successMsg = `Context '${chosenContext}' is now active.`;

    vi.mocked(devrevWrapper.listSnapInContexts).mockResolvedValue(availableContexts);
    vi.mocked(inquirer.prompt).mockResolvedValue({ contextName: chosenContext });
    vi.mocked(devrevWrapper.checkoutSnapInContext).mockResolvedValue(successMsg);

    await program.parseAsync(["node", "test", "context", "checkout"]);

    expect(devrevWrapper.listSnapInContexts).toHaveBeenCalled();
    expect(inquirer.prompt).toHaveBeenCalled();
    // The "(current)" part should be removed before calling checkout
    expect(devrevWrapper.checkoutSnapInContext).toHaveBeenCalledWith(chosenContext.replace(" (current)", "").trim());
    expect(mockLogger.info).toHaveBeenCalledWith("Snap-in context checkout successful:");
  });

  it("should remove ' (current)' marker from prompted selection", async () => {
    const availableContexts = ["context1", "context2 (current)"];
    const chosenContextFromPrompt = "context2 (current)";
    const expectedContextForCheckout = "context2";
    const successMsg = `Context '${expectedContextForCheckout}' is now active.`;

    vi.mocked(devrevWrapper.listSnapInContexts).mockResolvedValue(availableContexts);
    vi.mocked(inquirer.prompt).mockResolvedValue({ contextName: chosenContextFromPrompt });
    vi.mocked(devrevWrapper.checkoutSnapInContext).mockResolvedValue(successMsg);

    await program.parseAsync(["node", "test", "context", "checkout"]);

    expect(devrevWrapper.checkoutSnapInContext).toHaveBeenCalledWith(expectedContextForCheckout);
  });


  it("should exit if no contexts available to prompt", async () => {
    vi.mocked(devrevWrapper.listSnapInContexts).mockResolvedValue([]);
    await program.parseAsync(["node", "test", "context", "checkout"]);
    expect(mockLogger.warn).toHaveBeenCalledWith("No Snap-in contexts available to checkout. You might need to create or sync contexts first.");
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("should exit if no context name provided after prompt (e.g. inquirer returns empty)", async () => {
    vi.mocked(devrevWrapper.listSnapInContexts).mockResolvedValue(["ctx1"]); // Ensure it prompts
    vi.mocked(inquirer.prompt).mockResolvedValue({ contextName: "" }); // Simulate empty selection

    await program.parseAsync(["node", "test", "context", "checkout"]);

    expect(mockLogger.error).toHaveBeenCalledWith("No context name provided or selected.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });


  it("should handle 'devrev CLI not found' error", async () => {
    const error = new Error("DevRev CLI command failed: devrev not found");
    vi.mocked(devrevWrapper.checkoutSnapInContext).mockRejectedValue(error);

    await program.parseAsync(["node", "test", "context", "checkout", "some-context"]);

    expect(mockLogger.error).toHaveBeenCalledWith("Failed to checkout Snap-in context 'some-context'.");
    expect(mockLogger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should handle 'context not found' error from CLI", async () => {
    const contextName = "nonexistent-context";
    const error = new Error(`Context '${contextName}' not found`); // Simulate error from wrapper
    vi.mocked(devrevWrapper.checkoutSnapInContext).mockRejectedValue(error);

    await program.parseAsync(["node", "test", "context", "checkout", contextName]);

    expect(mockLogger.error).toHaveBeenCalledWith(`Failed to checkout Snap-in context '${contextName}'.`);
    expect(mockLogger.error).toHaveBeenCalledWith(`Error: Snap-in context '${contextName}' not found.`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should handle generic errors from checkoutSnapInContext", async () => {
    const contextName = "generic-error-context";
    const errorMessage = "Some other checkout error";
    const error = new Error(errorMessage);
    vi.mocked(devrevWrapper.checkoutSnapInContext).mockRejectedValue(error);

    await program.parseAsync(["node", "test", "context", "checkout", contextName]);

    expect(mockLogger.error).toHaveBeenCalledWith(`Failed to checkout Snap-in context '${contextName}'.`);
    expect(mockLogger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${errorMessage}`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
