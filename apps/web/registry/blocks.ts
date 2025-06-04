import { type Registry, type RegistryItem } from "shadcn/registry";
import { clients } from "./clients";
import { registryItemAppend } from "./utils";

import dropzone from "./default/blocks/dropzone/registry-item.json" with { type: "json" };

const combine = (component: Registry["items"][number]) => {
  return clients.flatMap((client) => {
    return registryItemAppend(
      {
        ...component,
        name: `${component.name}-${client.name.replace("supabase-client-", "")}`,
      },
      [client]
    );
  });
};

export const blocks = [
  ...combine(dropzone as RegistryItem),
] as Registry["items"];
