"use client"

import { Button } from "@workspace/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Check, Copy, Settings } from "lucide-react"
import { useState } from "react"

interface GettingStartedProps {
  projectSlug: string
  className?: string
}

export function GettingStarted({ projectSlug, className = "" }: GettingStartedProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const copyToClipboard = async (text: string, commandKey: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCommand(commandKey)
      setTimeout(() => setCopiedCommand(null), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const installConfigs = {
    cursor: {
      name: "Cursor",
      config: {
        mcpServers: {
          "snapping-cli": {
            command: "npx",
            args: ["snapping-cli", "mcp"],
            env: {
              PROJECT_URL: `http://localhost:3000/projects/${projectSlug}`,
            },
          },
        },
      },
    },
    cloudDesktop: {
      name: "Cloud Desktop",
      config: {
        mcp: {
          servers: {
            "snapping-cli": {
              command: "npx snapping-cli mcp",
              environment: {
                PROJECT_URL: `http://localhost:3000/projects/${projectSlug}`,
              },
            },
          },
        },
      },
    },
    codex: {
      name: "Codex",
      config: {
        tools: {
          "snapping-cli": {
            type: "mcp",
            executable: "npx snapping-cli mcp",
            config: {
              PROJECT_URL: `http://localhost:3000/projects/${projectSlug}`,
            },
          },
        },
      },
    },
  }



  return (
    <>
      {/* Installation Instructions */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <Settings className="h-5 w-5" />
            MCP Setup
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose your IDE and copy the configuration
          </p>
        </div>

        <Tabs defaultValue="cursor" className="w-full bg-muted/50 p-2 rounded-lg">
          <TabsList className="bg-muted/50 border-none shadow-none h-8">
            <TabsTrigger
              value="cursor"
              className="data-[state=active]:bg-background data-[state=active]:shadow-none border-none"
            >
              {installConfigs.cursor.name}
            </TabsTrigger>
            <TabsTrigger
              value="cloudDesktop"
              className="data-[state=active]:bg-background data-[state=active]:shadow-none border-none"
            >
              {installConfigs.cloudDesktop.name}
            </TabsTrigger>
            <TabsTrigger
              value="codex"
              className="data-[state=active]:bg-background data-[state=active]:shadow-none border-none"
            >
              {installConfigs.codex.name}
            </TabsTrigger>
          </TabsList>

          {Object.entries(installConfigs).map(([key, config]) => (
            <TabsContent key={key} value={key}>
              <div className="relative">
                <pre className="border-none p-4 text-xs overflow-x-auto">
                  <code>{JSON.stringify(config.config, null, 2)}</code>
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute -top-10 -right-0 h-8 w-8 p-0 hover:bg-muted"
                  onClick={() => copyToClipboard(JSON.stringify(config.config, null, 2), key)}
                >
                  {copiedCommand === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  )
}
