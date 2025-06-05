// CLI Info
export const CLI_NAME = "shadcn"; // Or your actual CLI name if different
export const CLI_VERSION = "0.0.1"; // Placeholder, can be dynamically injected at build time

// Links
export const DOCS_URL_AIA_PROJECT_STRUCTURE = "https://developer.devrev.ai/airdrop/project-structure"; // Example
export const DOCS_URL_MANIFEST_REFERENCE = "https://developer.devrev.ai/airdrop/manifest-reference"; // Example
export const DOCS_URL_AIA_CONFIG_REFERENCE = "https://developer.devrev.ai/airdrop/airdrop-config-mjs"; // Example

// Default file names
export const MANIFEST_FILE_YML = "manifest.yml";
export const MANIFEST_FILE_YAML = "manifest.yaml";
export const AIRDROP_CONFIG_FILE = "snapin.config.mjs";
export const ENV_FILE = ".env";

// Project patterns
export const AIRDROP_PROJECT_DIR_PREFIX = "airdrop-";

// Required Dev Tools for `doctor` command
export interface DevTool {
  name: string;
  command: string; // Command to check for existence, e.g., "devrev --version"
  installLink: string;
  purpose: string;
}
export const REQUIRED_DEV_TOOLS: DevTool[] = [
  {
    name: "DevRev CLI",
    command: "devrev --version",
    installLink: "https://developer.devrev.ai/public/snapin-development/references/cli-install",
    purpose: "Interacting with the DevRev platform."
  },
  {
    name: "jq",
    command: "jq --version",
    installLink: "https://jqlang.github.io/jq/download/",
    purpose: "JSON processor, often used with CLI tools."
  },
  {
    name: "ngrok",
    command: "ngrok version",
    installLink: "https://ngrok.com/download",
    purpose: "Secure introspectable tunnels to localhost, useful for webhook development."
  },
  {
    name: "Chef CLI (chef-cli)",
    command: "chef-cli --version", // Assuming this is the command
    installLink: "https://github.com/devrev/adaas-chef-cli", // Example link
    purpose: "Tool for Airdrop development and deployment."
  },
  // Node and a package manager are also required but checked differently (e.g. via process.version and checking npm/pnpm/yarn)
];

// Default .env content for `doctor --fix`
export const DEFAULT_ENV_CONTENT = `# DevRev Organization and User Info
DEV_ORG=your-devorg-slug
USER_IMAIL=your-email@example.com

# Add other environment specific variables below
# e.g., EXTERNAL_SYSTEM_API_KEY=your_api_key_here
`;

// Prompt Messages (Examples - can be expanded)
export const PROMPT_MESSAGES = {
  overwriteConfirm: (fileName: string) => `The file '${fileName}' already exists. Overwrite?`,
  navigateToprojectRoot: "You are inside an Airdrop project, but not at its root. Please navigate to the root directory to proceed.",
  notAnAirdropProject: "This does not appear to be an Airdrop project. Initialize one with 'init' or navigate to a valid project.",
};

// Placeholder messages for new CLI commands
export const COMMAND_PLACEHOLDERS = {
  build: "🏗️ Building project...",
  release: "🚀 Releasing snap-in...", // or "🚀 Releasing Airdrop project..."
  dev: "🛠️ Starting local development server...",
  logs: "📜 Fetching logs...",
};

// Add other constants as needed:
// - Default template URLs (already in init-config.ts, decide if they move here or stay)
// - Sync directions
// - Object mappings
// - etc.
