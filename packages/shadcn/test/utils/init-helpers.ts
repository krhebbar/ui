import fs from "fs-extra";
import path from "path";
import os from "os";
import { execa } from "execa"; // Correctly import execa and its types

// Path to the CLI entry point
// process.cwd() should be /app/packages/shadcn when tests are run
const CLI_PATH = path.resolve(process.cwd(), "dist/index.js");

/**
 * Runs the init command with specified arguments and inputs.
 * @param cwd - The current working directory for the command.
 * @param args - An array of arguments to pass to the init command.
 * @param inputs - An array of strings to provide as input to prompts.
 * @returns The result of the command execution.
 */
export async function runInitCommand(
  cwd: string,
  args: string[] = [],
  inputs: string[] = []
): Promise<import("execa").ExecaReturnValue> {
  const commandArgs = ["init", ...args];
  // Make runInitCommand async and await the execa call
  return execa("node", [CLI_PATH, ...commandArgs], {
    cwd,
    input: inputs.join(os.EOL), // Join inputs with newline for prompts
    reject: false, // Do not throw on non-zero exit codes, so we can inspect the result
  });
}

/**
 * Creates a temporary directory with a specified file/folder structure.
 * @param baseDir - The base directory within os.tmpdir() to create the temp dir.
 * @param structure - An object where keys are file/folder paths (relative to temp dir)
 *                    and values are file content (string) or null for folders.
 * @returns The absolute path to the created temporary directory.
 */
export async function createTempDirWithStructure(
  baseDir: string = "shadcn-init-test",
  structure: Record<string, string | null> = {}
): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${baseDir}-`));

  for (const itemPath in structure) {
    const fullPath = path.join(tempDir, itemPath);
    const content = structure[itemPath];

    if (content === null) {
      // Create a directory
      await fs.ensureDir(fullPath);
    } else {
      // Create a file
      await fs.ensureDir(path.dirname(fullPath)); // Ensure parent directory exists
      await fs.writeFile(fullPath, content, "utf-8");
    }
  }

  return tempDir;
}

/**
 * Cleans up a temporary directory.
 * @param dirPath - The path to the directory to remove.
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  if (await fs.pathExists(dirPath)) {
    await fs.remove(dirPath);
  }
}
