import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import { logger } from "./logger"; // Assuming logger is available
import { spinner } from "./spinner"; // Assuming spinner is available

interface CloneOptions {
  repoUrl: string;
  targetPath: string;
  depth?: number;
}

export async function cloneTemplate(options: CloneOptions): Promise<boolean> {
  const { repoUrl, targetPath, depth = 1 } = options;

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

    const gitArgs = ["clone", "--depth", depth.toString(), repoUrl, targetPath];
    logger.info(`Executing: git ${gitArgs.join(" ")}`); // Log the command

    const result = await execa("git", gitArgs);

    if (result.exitCode !== 0) {
      cloningSpinner.fail(`Failed to clone template from ${repoUrl}. Exit code: ${result.exitCode}`);
      logger.error(`Git clone stderr: ${result.stderr}`);
      return false;
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
