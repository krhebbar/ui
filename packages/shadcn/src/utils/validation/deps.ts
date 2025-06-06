import { execa } from "execa";
import { logger } from "@/src/utils/logger"; // Adjust path
import { REQUIRED_DEV_TOOLS, DevTool } from "@/src/utils/validation/constants"; // Adjust path
import { spinner } from "@/src/utils/spinner"; // Adjust path

export interface DepsValidationResult {
  isValid: boolean;
  summary: string;
  issues: string[];
  foundTools: string[];
  missingTools: DevTool[];
}

// Helper to check if a command exists and optionally matches a version pattern
async function checkCommand(toolName: string, commandWithArgs: string): Promise<boolean> {
  const checkingSpinner = spinner(`Checking for ${toolName}...`).start();
  try {
    const [cmd, ...args] = commandWithArgs.split(" ");
    const result = await execa(cmd, args, { stdio: "ignore" }); // Ignore stdio to prevent output unless error
    if (result.exitCode === 0) {
      checkingSpinner.succeed(`${toolName} found.`);
      return true;
    }
    checkingSpinner.fail(`${toolName} not found or command failed (exit code: ${result.exitCode}).`);
    return false;
  } catch (error) {
    checkingSpinner.fail(`${toolName} not found or command error.`);
    return false;
  }
}

// Helper to check for package managers
async function checkPackageManager(): Promise<{ name: string; found: boolean }> {
  const packageManagers = [
    { name: "npm", command: "npm --version" },
    { name: "pnpm", command: "pnpm --version" },
    { name: "yarn", command: "yarn --version" },
  ];

  for (const pm of packageManagers) {
    if (await checkCommand(pm.name, pm.command)) {
      return { name: pm.name, found: true };
    }
  }
  return { name: "npm, pnpm, or yarn", found: false };
}

export async function validateDependencies(
  attemptFix: boolean // attemptFix is not used here yet, could be for auto-install later
): Promise<DepsValidationResult> {
  const result: DepsValidationResult = {
    isValid: true,
    summary: "",
    issues: [],
    foundTools: [],
    missingTools: [],
  };

  logger.info("Checking for required command-line tools...");

  // Node.js (usually available if this CLI is running)
  if (typeof process !== "undefined" && process.version) {
    logger.success(`Node.js found (version ${process.version}).`);
    result.foundTools.push(`Node.js (${process.version})`);
  } else {
    result.isValid = false;
    const issue = "Node.js is not installed or not found in PATH. This is required to run the CLI.";
    logger.error(issue);
    result.issues.push(issue);
    // No DevTool object for Node.js here, as it's a fundamental requirement.
  }

  // Package Manager
  const pmCheck = await checkPackageManager();
  if (pmCheck.found) {
    // checkCommand already logs success for the specific manager
    result.foundTools.push(pmCheck.name);
  } else {
    result.isValid = false;
    const issue = "No supported package manager (npm, pnpm, or yarn) found. At least one is required.";
    logger.error(issue);
    result.issues.push(issue);
    result.missingTools.push({
        name: "npm, pnpm, or yarn",
        command: "npm --version / pnpm --version / yarn --version",
        installLink: "https://nodejs.org/ (comes with npm)",
        purpose: "Managing project dependencies."
    });
  }

  for (const tool of REQUIRED_DEV_TOOLS) {
    if (await checkCommand(tool.name, tool.command)) {
      result.foundTools.push(tool.name);
    } else {
      result.isValid = false;
      const issue = `${tool.name} not found. Purpose: ${tool.purpose}. Install from ${tool.installLink}`;
      result.issues.push(issue);
      result.missingTools.push(tool);
    }
  }

  if (result.isValid) {
    result.summary = "All required dependencies and tools are installed.";
    logger.success(result.summary);
  } else {
    result.summary = "Some required dependencies or tools are missing. Please install them.";
    logger.error("Dependency check failed. Missing tools:");
    result.missingTools.forEach(tool => logger.error(`- ${tool.name} (Install: ${tool.installLink})`));
  }

  return result;
}
