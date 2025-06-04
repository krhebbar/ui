import fs from "fs-extra";
import path from "path";
import { glob } from "glob"; // Using glob for finding files matching a pattern

// Define an interface for the expected structure of registry-item.json (can be expanded)
export interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: Array<{
    path: string;
    type: string; // e.g., "registry:file"
    target: string;
    content?: string; // Some registry items might have inline content
  }>;
  [key: string]: any; // Allow other properties
}

/**
 * Loads and parses a single registry-item.json file.
 * @param registryItemJsonPath - Absolute path to the registry-item.json file.
 * @returns Parsed JSON data as RegistryItem, or null if an error occurs.
 */
export async function loadRegistryItem(
  registryItemJsonPath: string
): Promise<RegistryItem | null> {
  if (!(await fs.pathExists(registryItemJsonPath))) {
    console.error(`Registry item JSON file not found: ${registryItemJsonPath}`);
    return null;
  }
  try {
    const item: RegistryItem = await fs.readJson(registryItemJsonPath);
    return item;
  } catch (error) {
    console.error(`Error parsing registry item JSON ${registryItemJsonPath}:`, error);
    return null;
  }
}

/**
 * Finds all registry-item.json files under a given base path.
 * @param absoluteBaseRegistryPath - The absolute path to the base directory to search within (e.g., path.resolve(__dirname, "../../../apps/web/registry/default")).
 * @param typeFilter - Optional string to filter items by the 'type' field in their JSON content.
 * @returns A promise that resolves to an array of absolute paths to found registry-item.json files.
 */
export async function findRegistryItems(
  absoluteBaseRegistryPath: string,
  typeFilter?: string
): Promise<string[]> {
  if (!(await fs.pathExists(absoluteBaseRegistryPath))) {
    console.error(`Base registry path does not exist: ${absoluteBaseRegistryPath}`);
    return [];
  }

  const pattern = path.join(absoluteBaseRegistryPath, "**", "registry-item.json").replace(/\\/g, "/"); // Ensure forward slashes for glob

  try {
    const files = await glob(pattern, { nodir: true, windowsPathsNoEscape: true });

    if (!typeFilter) {
      return files.map(f => path.resolve(f)); // Ensure absolute paths
    }

    const filteredItems: string[] = [];
    for (const filePath of files) {
      const absoluteFilePath = path.resolve(filePath); // Ensure absolute path before loading
      const item = await loadRegistryItem(absoluteFilePath);
      if (item && item.type === typeFilter) {
        filteredItems.push(absoluteFilePath);
      }
    }
    return filteredItems;

  } catch (error) {
    console.error("Error finding registry items:", error);
    return [];
  }
}

/**
 * Loads all registry items found under a given base path that match an optional type filter.
 * @param absoluteBaseRegistryPath - The absolute path to the base directory to search within.
 * @param typeFilter - Optional string to filter items by the 'type' field.
 * @returns A promise that resolves to an array of loaded RegistryItem objects.
 */
export async function loadAllRegistryItems(
    absoluteBaseRegistryPath: string,
    typeFilter?: string
): Promise<RegistryItem[]> {
    const itemPaths = await findRegistryItems(absoluteBaseRegistryPath, typeFilter);
    const loadedItems: RegistryItem[] = [];
    for (const itemPath of itemPaths) {
        const item = await loadRegistryItem(itemPath);
        if (item) {
            loadedItems.push(item);
        }
    }
    return loadedItems;
}
