import { paramCase, pascalCase, camelCase, snakeCase } from "change-case";

// Kebab-case conversion
export function toKebabCase(str: string): string {
  return paramCase(str);
}

// Slugification from a name (similar to kebab-case but often implies more URL-friendliness)
export function slugify(str: string): string {
  return paramCase(str)
    .toLowerCase() // Ensure lowercase
    .replace(/[^a-z0-9-]/g, ""); // Remove any non-alphanumeric (except hyphens)
}

// Project name validation (regex: /^airdrop-[a-z0-9\-]+$/)
const AIRDROP_PROJECT_NAME_REGEX = /^airdrop-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidAirdropProjectName(name: string): boolean {
  return AIRDROP_PROJECT_NAME_REGEX.test(name);
}

export function generateAirdropSnapInFolderName(baseName: string): string {
  const slugifiedBase = slugify(baseName);
  return `${slugifiedBase}-snap-in`; // Removed "airdrop-" prefix
}

// Other case conversions that might be useful
export function toPascalCase(str: string): string {
  return pascalCase(str);
}

export function toCamelCase(str: string): string {
  return camelCase(str);
}

export function toSnakeCase(str: string): string {
  return snakeCase(str);
}
