import { SidebarNavGroup } from "types/nav";

export const gettingStarted: SidebarNavGroup = {
  title: "Getting Started",
  items: [
    {
      title: "Introduction",
      href: "/docs/getting-started/introduction",
      items: [],
      commandItemLabel: "Introduction",
    },
    {
      title: "Setup",
      href: "/docs/getting-started/setup",
      items: [],
      commandItemLabel: "Setup",
    },
  ],
};

export const aiEditorsRules: SidebarNavGroup = {
  title: "AI Editor",
  items: [
    {
      title: "Cursor Rules",
      href: "/docs/ai-editor/rules",
      items: [],
      commandItemLabel: "Cursor Rules",
    },
    {
      title: "Prompts",
      href: "/docs/ai-editor/prompts",
      items: [],
      commandItemLabel: "Prompts",
    },
  ],
};

export const airdropConnections: SidebarNavGroup = {
  title: "Airdrop Connections",
  items: [
    {
      title: "Secret Connection",
      href: "/docs/airdrop/connection/secret",
      items: [],
      commandItemLabel: "Secret Connection",
    },
    {
      title: "OAuth2 Connection",
      href: "/docs/airdrop/connection/oauth2",
      items: [],
      commandItemLabel: "OAuth2 Connection",
    },
  ],
};

export const COMMAND_ITEMS = [
  ...gettingStarted.items.map((item) => ({
    label: item.commandItemLabel,
    href: item.href,
  })),
  ...aiEditorsRules.items.map((item) => ({
    label: item.commandItemLabel,
    href: item.href,
  })),
  ...airdropConnections.items.map((item) => ({
    label: item.commandItemLabel,
    href: item.href,
  })),
];
