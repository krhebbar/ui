export interface SnapInTemplate {
  name: string;
  description: string;
  url: string;
}

export interface InitConfig {
  defaultApiBaseUrl: string;
  defaultTestEndpoint: string;
  defaultSnapInTemplateName: string;
  snapInTemplates: SnapInTemplate[];
}

const initConfig: InitConfig = {
  defaultApiBaseUrl: "https://api.example.com/v1",
  defaultTestEndpoint: "/me", // Relative to apiBaseUrl typically, or an absolute path
  defaultSnapInTemplateName: "default-snapin-template", // Key to find in snapInTemplates
  snapInTemplates: [
    {
      name: "default-snapin-template",
      description: "Default Airdrop Snap-in template",
      url: "https://github.com/devrev/airdrop-snap-in-template.git", // Example URL
    },
    // Future templates can be added here
    // {
    //   name: "another-snapin-template",
    //   description: "Another Airdrop Snap-in template with more features",
    //   url: "https://github.com/user/another-snap-in-template.git",
    // },
  ],
};

export function getInitConfig(): InitConfig {
  // In the future, this could read from a user-level config file
  // or merge defaults with some overrides. For now, just returns the constant.
  return initConfig;
}

export function getDefaultSnapInTemplate(): SnapInTemplate | undefined {
  const config = getInitConfig();
  return config.snapInTemplates.find(t => t.name === config.defaultSnapInTemplateName);
}

export function getSnapInTemplateByName(name: string): SnapInTemplate | undefined {
  const config = getInitConfig();
  return config.snapInTemplates.find(t => t.name === name);
}
