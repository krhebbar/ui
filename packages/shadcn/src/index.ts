#!/usr/bin/env node
import { add } from "@/src/commands/add"
import { config } from "@/src/commands/config"
import { init } from "@/src/commands/init"
import { mcp as registryMcp } from "@/src/commands/registry/mcp"
import { Command } from "commander"

// New command imports
import { doctor } from "@/src/commands/doctor";
import { dev } from "@/src/commands/dev";
import { build } from "@/src/commands/build";
import { release } from "@/src/commands/release";
import { logs } from "@/src/commands/logs";
import { createKeyring } from "@/src/commands/keyring";
import { testConnection } from "@/src/commands/connection";
import { generateTypes } from "@/src/commands/generate-types";
// New command group imports
import { packageCommands } from "@/src/commands/package";
import { contextCommands } from "@/src/commands/context";

import packageJson from "../package.json"

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

async function main() {
  const program = new Command()
    .name("shadcn") // Consider using CLI_NAME from constants here
    .description("add components and dependencies to your project. Also includes Airdrop/Snap-in lifecycle commands.") // Updated description
    .version(
      packageJson.version || "1.0.0", // Or CLI_VERSION from constants
      "-v, --version",
      "display the version number"
    );

  program
    .addCommand(init)
    // .addCommand(add)
    // .addCommand(config)
    // Register new commands
    .addCommand(doctor)
    .addCommand(createKeyring)
    .addCommand(testConnection)
    .addCommand(generateTypes)
    .addCommand(registryMcp)
    // Register new command groups
    .addCommand(packageCommands)
    .addCommand(contextCommands)
    .addCommand(dev)
    .addCommand(build)
    .addCommand(release)
    .addCommand(logs)
  // Registry commands

  program.parse()
}

main()

export * from "./registry/api"
