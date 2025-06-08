import { execa } from "execa";
import fs from "fs";
import { execDevRevCommand } from "./devrev-auth";

/**
 * Executes a DevRev CLI command with automatic authentication.
 * This function now uses the PAT-based authentication from devrev-auth.ts
 *
 * @param subcommand - The subcommand to execute.
 * @param args - An array of arguments for the subcommand.
 * @returns A promise that resolves with the stdout of the command.
 * @throws If the command fails or returns a non-zero exit code.
 */
async function executeDevrevCommand(
  subcommand: string,
  args: string[] = []
): Promise<string> {
  try {
    // Use the PAT-based authentication from devrev-auth.ts
    const result = await execDevRevCommand(process.cwd(), [subcommand, ...args]);

    if (result.exitCode !== 0) {
      throw new Error(
        `DevRev CLI command failed with exit code ${result.exitCode}: ${result.stderr}`
      );
    }

    return result.stdout;
  } catch (error) {
    console.error(`Error executing DevRev CLI command: ${error}`);
    throw error;
  }
}

/**
 * Validates a Snap-in manifest file.
 *
 * @param manifestPath - Path to the manifest file.
 * @returns A promise that resolves with the validation result.
 * @throws If the command fails or the output cannot be parsed.
 */
export async function validateManifest(manifestPath: string): Promise<any> {
  try {
    const output = await executeDevrevCommand("snap_in_version", [
      "validate-manifest",
      manifestPath,
    ]);
    return JSON.parse(output);
  } catch (error) {
    console.error(`Error validating manifest ${manifestPath}: ${error}`);
    throw error;
  }
}



/**
 * Updates a Snap-in.
 *
 * @param snapInId - ID of the Snap-in to update.
 * @param versionId - ID of the Snap-in version to update to.
 * @returns A promise that resolves with the update result.
 * @throws If the command fails or the output cannot be parsed.
 */
export async function updateSnapIn(
  snapInId: string,
  versionId: string
): Promise<any> {
  try {
    const output = await executeDevrevCommand("snap_in", [
      "update",
      "--id",
      snapInId,
      "--version",
      versionId,
    ]);
    return JSON.parse(output);
  } catch (error) {
    console.error(
      `Error updating Snap-in ${snapInId} to version ${versionId}: ${error}`
    );
    throw error;
  }
}

/**
 * Lists all available Snap-in contexts.
 * The output of 'devrev snap_in_context list' is plain text, one context name per line.
 *
 * @returns A promise that resolves with an array of context names.
 * @throws If the command fails.
 */
export async function listSnapInContexts(): Promise<string[]> {
  try {
    const output = await executeDevrevCommand("snap_in_context", ["list"]);
    // Output is plain text, each context name on a new line.
    // Filter out any empty lines or lines that are not actual context names (e.g., headers if any).
    return output.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith("Available contexts:") && !line.startsWith("Current context:") && line !== "");
  } catch (error) {
    console.error(`Error listing Snap-in contexts: ${error}`);
    throw error;
  }
}

/**
 * Checks out a specific Snap-in context.
 *
 * @param contextName - The name of the context to checkout.
 * @returns A promise that resolves with the success message from the CLI.
 * @throws If the command fails.
 */
export async function checkoutSnapInContext(contextName: string): Promise<string> {
  try {
    const output = await executeDevrevCommand("snap_in_context", ["checkout", contextName]);
    return output; // Usually a confirmation message like "Context '<contextName>' is now active."
  } catch (error) {
    console.error(`Error checking out Snap-in context '${contextName}': ${error}`);
    throw error;
  }
}

/**
 * Creates a new Snap-in version.
 *
 * @param path - Path to the Snap-in code.
 * @param options - Optional parameters for creating the Snap-in version.
 * @returns A promise that resolves with the created version information.
 * @throws If the command fails or the output cannot be parsed.
 */
export async function createSnapInVersion(
  path: string,
  options: {
    packageId?: string;
    manifestPath?: string;
    archivePath?: string;
    createPackage?: boolean;
    testingUrl?: string;
  } = {}
): Promise<any> {
  const args = ["create-one"];
  
  // Add path or archive, but not both
  if (options.archivePath) {
    args.push("--archive", options.archivePath);
  } else if (path) {
    args.push("--path", path);
  }
  
  if (options.packageId) {
    args.push("--package", options.packageId);
  }
  
  // Only add manifest if we're not using --path (since --path expects manifest to be in the directory)
  // or if we're using --archive (archives can have separate manifest files)
  if (options.manifestPath && options.archivePath) {
    args.push("--manifest", options.manifestPath);
  }
  
  if (options.createPackage) {
    args.push("--create-package");
  }
  if (options.testingUrl) {
    args.push("--testing-url", options.testingUrl);
  }

  try {
    const output = await executeDevrevCommand("snap_in_version", args);
    return JSON.parse(output);
  } catch (error) {
    console.error(`Error creating Snap-in version: ${error}`);
    throw error;
  }
}





/**
 * Drafts a Snap-in.
 *
 * @param snapInVersionId - Optional ID of the Snap-in version to draft.
 * @returns A promise that resolves with the drafted Snap-in information, including the interface link.
 * @throws If the command fails or the output cannot be parsed.
 */
export async function draftSnapIn(snapInVersionId?: string): Promise<any> {
  const args = ["draft"];
  if (snapInVersionId) {
    args.push("--snap_in_version", snapInVersionId);
  }
  try {
    const output = await executeDevrevCommand("snap_in", args);
    return JSON.parse(output);
  } catch (error) {
    console.error(`Error drafting Snap-in: ${error}`);
    throw error;
  }
}

/**
 * Activates a Snap-in.
 *
 * @param id - Optional ID of the Snap-in to activate.
 * @returns A promise that resolves when the Snap-in is activated.
 * @throws If the command fails.
 */
export async function activateSnapIn(id?: string): Promise<string> {
  const args = ["activate"];
  if (id) {
    args.push(id);
  }
  try {
    // Activate command might not return JSON, adjust parsing if needed.
    const output = await executeDevrevCommand("snap_in", args);
    return output; // Assuming output is a confirmation message or similar
  } catch (error) {
    console.error(`Error activating Snap-in: ${error}`);
    throw error;
  }
}

/**
 * Retrieves logs for a Snap-in package.
 *
 * @param options - Optional parameters for filtering logs.
 * @returns A promise that resolves with the logs.
 * @throws If the command fails or the output cannot be parsed.
 */
export async function getSnapInLogs(options: {
  after?: string;
  before?: string;
  filters?: string; // JSON string
  limit?: number;
} = {}): Promise<any> {
  const args = [];
  if (options.after) {
    args.push("--after", options.after);
  }
  if (options.before) {
    args.push("--before", options.before);
  }
  if (options.filters) {
    args.push("--filters", options.filters);
  }
  if (options.limit !== undefined) {
    args.push("--limit", options.limit.toString());
  }

  try {
    const output = await executeDevrevCommand("snap_in_package", ["logs", ...args]);
    return JSON.parse(output);
  } catch (error) {
    console.error(`Error getting Snap-in logs: ${error}`);
    throw error;
  }
}

/**
 * Retrieves the Snap-in context.
 *
 * @returns A promise that resolves with an object containing the Snap-in context IDs.
 * @throws If the command fails or the output cannot be parsed.
 */
export async function getSnapInContext(): Promise<{
  snap_in_id: string;
  snap_in_package_id: string;
  snap_in_version_id: string;
}> {
  try {
    const output = await executeDevrevCommand("snap_in_context", ["show"]);
    // Assuming the output is in a parsable format, e.g., "ID: value"
    // This parsing logic might need adjustment based on the actual output format.
    const lines = output.split("\n");
    const context = {} as any;
    lines.forEach((line) => {
      const [key, value] = line.split(":").map((s) => s.trim());
      if (key && value) {
        context[key.toLowerCase().replace(/ /g, "_")] = value;
      }
    });
    return {
      snap_in_id: context.snap_in_id,
      snap_in_package_id: context.snap_in_package_id,
      snap_in_version_id: context.snap_in_version_id,
    };
  } catch (error) {
    console.error(`Error getting Snap-in context: ${error}`);
    throw error;
  }
}

/**
 * Creates a new Snap-in package.
 *
 * @param slug - The slug name for the new package.
 * @returns A promise that resolves with the created package information.
 * @throws If the command fails or the output cannot be parsed.
 */
export async function createSnapInPackage(
  slug: string
): Promise<any> {
  try {
    const output = await executeDevrevCommand("snap_in_package", [
      "create-one",
      "--slug",
      slug,
    ]);
    return JSON.parse(output);
  } catch (error) {
    console.error(`Error creating Snap-in package: ${error}`);
    throw error;
  }
}

/**
 * Lists all Snap-in packages.
 *
 * @returns A promise that resolves with an array of Snap-in packages.
 * @throws If the command fails or the output cannot be parsed.
 */
export async function listSnapInPackages(): Promise<any[]> {
  try {
    const output = await executeDevrevCommand("snap_in_package", ["list"]);
    return JSON.parse(output);
  } catch (error) {
    console.error(`Error listing Snap-in packages: ${error}`);
    throw error;
  }
}
