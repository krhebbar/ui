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
      description: "Default Snap-in template",
      url: "https://github.com/krhebbar/snapin-template.git", // Example URL
    },
    // Future templates can be added here
    {
      name: "custom-webhook-snapin-template",
      description: "Custom Webhook Snap-in template",
      url: "https://github.com/krhebbar/snapin-custom-webhook-template.git",
    },
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
