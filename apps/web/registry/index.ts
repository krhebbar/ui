import { type Registry } from "shadcn/registry";

import type { RegistryItem } from "shadcn/registry";
import aiEditorRules from "./default/ai-editor-rules/registry-item.json" with { type: "json" };
import airdropConnectionOauth2 from "./default/airdrop/connection/oauth2/registry-item.json" with { type: "json" };
import airdropConnectionSecret from "./default/airdrop/connection/secret/registry-item.json" with { type: "json" };
import mcp from "./default/mcp/registry-item.json" with { type: "json" };

export const registry = {
  name: "Supabase UI Library",
  homepage: "https://supabase.com/ui",
  items: [
    aiEditorRules as RegistryItem,
    airdropConnectionSecret as RegistryItem,
    airdropConnectionOauth2 as RegistryItem,
    mcp as RegistryItem,
  ],
} satisfies Registry;
