"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { CommandCopyButton } from "./command-copy-button";
import { useLocalStorage } from "./use-local-storage";

interface CommandCopyProps {
  name: string;
  highlight?: boolean;
}

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const LOCAL_STORAGE_KEY = "package-manager-copy-command";

export function Command({ name, highlight }: CommandCopyProps) {
  const [value, setValue] = useLocalStorage(LOCAL_STORAGE_KEY, "npm");

  const getBaseUrl = () => {
    if (process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV === "production") {
      return `https://supabase.com`;
    } else if (process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV === "preview") {
      return `https://${process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL}`;
    } else {
      return "http://localhost:3000";
    }
  };

  const baseUrl = getBaseUrl();
  const componentPath = `/r/${name}.json`;

  const commands: Record<PackageManager, string> = {
    npm: `npx shadcn@latest add ${baseUrl}${componentPath}`,
    pnpm: `pnpm dlx shadcn@latest add ${baseUrl}${componentPath}`,
    yarn: `yarn dlx shadcn@latest add ${baseUrl}${componentPath}`,
    bun: `bunx --bun shadcn@latest add ${baseUrl}${componentPath}`,
  };

  return (
    <Tabs value={value} onValueChange={setValue} className="w-full">
      <div className="w-full group relative rounded-lg  bg-muted/30 px-4 py-2 overflow-hidden">
        <div className="flex flex-col">
          <TabsList className="gap-2 relative mb-2 z-10">
            {(Object.keys(commands) as PackageManager[]).map((manager) => (
              <TabsTrigger key={manager} value={manager} className="text-xs">
                {manager}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(commands) as PackageManager[]).map((manager) => (
            <TabsContent key={manager} value={manager} className="m-0">
              <div className="flex items-center">
                <div className="flex-1 font-mono text-sm text-foreground relative z-10">
                  <span className="mr-2 text-[#888]">$</span>
                  {commands[manager]}
                </div>
                <div className="relative z-10">
                  <CommandCopyButton command={commands[manager]} />
                </div>
              </div>
            </TabsContent>
          ))}
        </div>
      </div>
    </Tabs>
  );
}
