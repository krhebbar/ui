import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import { logger } from "./logger"; // Assuming logger is available
import { spinner } from "./spinner"; // Assuming spinner is available

interface CloneOptions {
  repoUrl: string;
  targetPath: string;
  depth?: number;
  branch?: string;
  path?: string;
}

export async function cloneTemplate(options: CloneOptions): Promise<boolean> {
  const { repoUrl, targetPath, depth = 1, branch, path: repoPath } = options; // Renamed path to repoPath to avoid conflict with 'path' module

  const cloningSpinner = spinner(`Cloning template from ${repoUrl}...`).start();

  try {
    // Ensure the target directory exists and is empty or remove it if allowed (be cautious)
    if (await fs.pathExists(targetPath)) {
      // Simple check: if directory is not empty, fail for safety.
      // More sophisticated handling might involve prompting the user or having a --force flag.
      const files = await fs.readdir(targetPath);
      if (files.length > 0) {
        cloningSpinner.fail(`Target directory ${targetPath} already exists and is not empty.`);
        return false;
      }
    } else {
      await fs.ensureDir(targetPath);
    }

    const gitArgs = ["clone", "--depth", depth.toString()];
    if (branch) {
      gitArgs.push("--branch", branch);
    }
    gitArgs.push(repoUrl, targetPath);
    logger.info(`Executing: git ${gitArgs.join(" ")}`); // Log the command

    const result = await execa("git", gitArgs);

    if (result.exitCode !== 0) {
      cloningSpinner.fail(`Failed to clone template from ${repoUrl}. Exit code: ${result.exitCode}`);
      logger.error(`Git clone stderr: ${result.stderr}`);
      return false;
    }

    if (repoPath && repoPath.trim() !== "" && repoPath.trim() !== ".") {
      const sourcePath = path.join(targetPath, repoPath); // Use 'path' module alias
      // Check if sourcePath actually exists and is a directory
      if (await fs.pathExists(sourcePath) && (await fs.stat(sourcePath)).isDirectory()) {
        logger.info(`Moving contents from ${sourcePath} to ${targetPath}`);
        const tempPath = path.join(targetPath, `__temp_clone_path_${Date.now()}`);
        await fs.ensureDir(tempPath); // Create a temporary directory

        // Move contents of sourcePath to tempPath
        const itemsToMove = await fs.readdir(sourcePath);
        for (const item of itemsToMove) {
          await fs.move(path.join(sourcePath, item), path.join(tempPath, item), { overwrite: true });
        }

        // Clear out the entire target directory (except temp directory)
        const allItems = await fs.readdir(targetPath);
        for (const item of allItems) {
          const itemPath = path.join(targetPath, item);
          if (item !== path.basename(tempPath)) { // Don't remove the temp directory
            await fs.remove(itemPath);
          }
        }

        // Move contents from tempPath to targetPath
        const tempItemsToMove = await fs.readdir(tempPath);
        for (const item of tempItemsToMove) {
            await fs.move(path.join(tempPath, item), path.join(targetPath, item), { overwrite: true });
        }

        // Remove the temporary directory
        await fs.remove(tempPath);
        logger.info(`Successfully moved contents from ${repoPath} to project root.`);
      } else {
        logger.warn(`Specified path '${repoPath}' does not exist or is not a directory within the cloned repository. Skipping move operation.`);
      }
    }

    // Remove the .git directory after cloning to make it a fresh project
    const gitDirPath = path.join(targetPath, ".git");
    if (await fs.pathExists(gitDirPath)) {
      await fs.remove(gitDirPath);
    }

    cloningSpinner.succeed(`Template cloned successfully to ${targetPath}.`);
    return true;
  } catch (error: any) {
    cloningSpinner.fail(`Error cloning template: ${error.message}`);
    logger.error(error);
    return false;
  }
}
