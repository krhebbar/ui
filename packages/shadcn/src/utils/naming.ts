import { kebabCase } from "change-case";

// Kebab-case conversion
export function toKebabCase(str: string): string {
  return kebabCase(str);
}

export function generateAirdropSnapInFolderName(baseName: string): string {
  const slugifiedBase = toKebabCase(baseName);
  return `${slugifiedBase}-snap-in`; // Removed "airdrop-" prefix
}
