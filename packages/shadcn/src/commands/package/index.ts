import { Command } from "commander";
import { packageCreate } from "./package-create";
import { packageList } from "./package-list";

export const packageCommands = new Command()
  .name("package")
  .description("Manage Snap-in packages using devrev-cli.");

packageCommands.addCommand(packageCreate);
packageCommands.addCommand(packageList);
