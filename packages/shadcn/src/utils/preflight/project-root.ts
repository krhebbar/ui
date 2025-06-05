import path from "path";
import fs from "fs-extra";

/**
 * Searches for a valid project root by looking for manifest.yml and code/ directory.
 * Traverses up a specified number of parent directories.
 *
 * @param cwd The current working directory to start searching from.
 * @param levels The number of parent directories to search upwards.
 * @returns The path to the project root if found, otherwise null.
 */
export function findProjectRoot(
  cwd: string,
  levels: number = 3
): string | null {
  let currentPath = cwd;
  for (let i = 0; i < levels; i++) {
    const manifestPath = path.join(currentPath, "manifest.yml");
    const codePath = path.join(currentPath, "code");

    if (fs.existsSync(manifestPath) && fs.existsSync(codePath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached the root directory
      break;
    }
    currentPath = parentPath;
  }

  return null;
}
