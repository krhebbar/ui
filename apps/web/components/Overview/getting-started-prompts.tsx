"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { ChevronDown, ChevronRight, Copy } from "lucide-react"
import { useState } from "react"

const CONNECTOR_CONFIG = {
  connectorName: "Gmail",
  authMethod: "OAuth",
  syncDirection: "one-way",
}

const TASKS = [
  {
    key: "initial-setup",
    title: "Connector Initial Setup",
    status: "pending",
    estimatedTime: "15-20 min",
    content: [
      "Use `codegen_init` to scaffold a Gmail Connector project",
      "Run `codegen_add_rule` to add all rules",
      "Run `codegen_devrev_auth` to authenticate with DevRev using your email/org",
      "Run `codegen_generate_keyring` to generate keyring for OAuth credentials",
      "Run `codegen_add_snippet` to configure OAuth auth with scopes",
      "Run `codegen_snappin_build` & `codegen_snappin_deploy` to build and deploy",
      "Finally, test connection using `codegen_test_connection`",
    ],
  },
  {
    key: "sync-units",
    title: "External Sync Units Extraction",
    status: "pending",
    estimatedTime: "10-15 min",
    content: [
      "Add `external-sync-units-extraction.ts` using `codegen_add_snippet`",
      "Validate with `codegen_test_sync_units`",
      "Generate `external_sync_units.json` for testing",
      "Trigger extraction with `codegen_run_phase EXTRACTION_EXTERNAL_SYNC_UNITS_START`",
      "Confirm with `EXTRACTION_EXTERNAL_SYNC_UNITS_DONE`",
    ],
  },
  {
    key: "metadata",
    title: "Metadata Extraction",
    status: "pending",
    estimatedTime: "10-15 min",
    content: [
      "Implement `metadata-extraction.ts` using `codegen_add_snippet`",
      "Define entities in `external_domain_metadata.json`",
      "Validate metadata with `chef-cli validate-metadata`",
      "Start with `EXTRACTION_METADATA_START`, finish with `EXTRACTION_METADATA_DONE`",
    ],
  },
  {
    key: "data-extraction",
    title: "Data Extraction",
    status: "pending",
    estimatedTime: "20-25 min",
    content: [
      "Run `codegen_add_snippet` to implement data-extraction.ts",
      "Implement logic to handle initial and incremental data syncs",
      "Run `codegen_test_data_extraction` to validate data retrieval",
      "Run `codegen_run_phase` with EXTRACTION_DATA_START",
      "Confirm the phase completion with EXTRACTION_DATA_DONE event",
    ],
  },
  {
    key: "attachments",
    title: "Attachments Extraction",
    status: "pending",
    estimatedTime: "15-20 min",
    content: [
      "Run `codegen_add_snippet` to implement attachments-extraction.ts",
      "Utilize S3Interact API to upload attachments to DevRev's S3",
      "Run `codegen_test_attachments_extraction` to validate attachment handling",
      "Run `codegen_run_phase` with EXTRACTION_ATTACHMENTS_START",
      "Confirm the phase completion with EXTRACTION_ATTACHMENTS_DONE event",
    ],
  },
]

export function GettingStartedPrompts() {
  const [openTask, setOpenTask] = useState(TASKS[0]?.key ?? "")

  const copyTaskContent = (task: (typeof TASKS)[0]) => {
    const markdownContent = `## ${task.title}\n\n${task.content.map((line) => `- ${line}`).join("\n")}`
    navigator.clipboard.writeText(markdownContent).catch((err) => console.error("Failed to copy content:", err))
  }

  return (
    <TooltipProvider>
      <div className="space-y-3 w-full">
        <div className="mb-4">
          <h2 className="text-lg font-medium mb-1">Getting Started Prompts</h2>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <span>
              Example Connector: <strong>{CONNECTOR_CONFIG.connectorName}</strong>
            </span>
            <span>•</span>
            <span>
              Auth Method: <strong>{CONNECTOR_CONFIG.authMethod}</strong>
            </span>
            <span>•</span>
            <span>
              Sync Direction: <strong>{CONNECTOR_CONFIG.syncDirection}</strong>
            </span>
          </div>
        </div>

        {TASKS.map((task) => {
          const isOpen = openTask === task.key

          return (
            <div key={task.key} className="border bg-primary-foreground rounded-md shadow-sm">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setOpenTask(isOpen ? "" : task.key)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{task.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {task.estimatedTime}
                  </Badge>
                </div>
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>

              {isOpen && (
                <div className="px-3 py-2 border-t relative">
                  <div className="space-y-1.5 text-sm">
                    {task.content.map((step, index) => (
                      <div key={index} className="text-muted-foreground">
                        {step}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex items-center gap-1 absolute top-2 right-2"
                          onClick={() => copyTaskContent(task)}
                        >
                          <Copy className="h-3 w-3" />
                          Copy All
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy as Markdown</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
