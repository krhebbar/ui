"use client";
import { Check, Copy, Wrench } from "lucide-react";
import { useState } from "react";

interface MCPToolsProps {
  className?: string;
  mcpTools: any[];
}
const mcpTools = [
  {
    name: "codegen_init",
    prompt: "Initialize a new codegen project",
    description: "Set up project structure and configuration",
  },
  {
    name: "codegen_get_rules",
    prompt: "Show me all coding rules",
    description: "List all available coding rules",
  },
  {
    name: "codegen_get_rule",
    prompt: "Get the React component rule",
    description: "Retrieve a specific coding rule",
  },
  {
    name: "codegen_add_rule",
    prompt: "Add a new TypeScript rule",
    description: "Create a new coding rule",
  },
  {
    name: "codegen_get_snippets",
    prompt: "Show me all code snippets",
    description: "List all available code snippets",
  },
  {
    name: "codegen_get_snippet",
    prompt: "Get the API route snippet",
    description: "Retrieve a specific code snippet",
  },
  {
    name: "codegen_add_snippet",
    prompt: "Add a new React hook snippet",
    description: "Create a new code snippet",
  },
  {
    name: "codegen_get_flows",
    prompt: "Show me all workflows",
    description: "List all available workflows",
  },
  {
    name: "codegen_get_flow",
    prompt: "Get the authentication flow",
    description: "Retrieve a specific workflow",
  },
  {
    name: "codegen_add_flow",
    prompt: "Add a new deployment flow",
    description: "Create a new workflow",
  },
];

export function MCPTools({ className = "" }: MCPToolsProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const copyToolPrompt = (toolName: string) => {
    const prompt = mcpTools.find((tool) => tool.name === toolName)?.prompt;
    if (prompt) {
      copyToClipboard(prompt, `tool-${toolName}`);
    }
  };
  const copyToClipboard = async (text: string, commandKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(commandKey);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };
  return (
    <div className="space-y-8 mt-8">
      {/* MCP Tools Section */}
      <div className="">
        <h2 className="text-lg font-semibold flex items-center">
             <Wrench className="h-5 w-5 mr-2" />
             MCP Tools
             </h2>
        <p className="text-sm text-muted-foreground">
          Configure and use these tools with your preferred IDE or CLI
        </p>

        <div className="space-y-1">
          {mcpTools.map((tool, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-0 hover:bg-muted/30 rounded-md transition-colors group cursor-pointer"
              onMouseEnter={() => setHoveredTool(tool.name)}
              onMouseLeave={() => setHoveredTool(null)}
              onClick={() => copyToolPrompt(tool.name)}
            >
              <div className="flex-1">
                <span className="font-mono text-sm font-medium">
                  {tool.name}
                </span>
                <span className="text-muted-foreground text-sm">
                  {" "}
                  – {tool.description}
                </span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                {copiedCommand === `tool-${tool.name}` ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
