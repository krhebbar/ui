import { Command } from "commander";
import { contextShow } from "./context-show";
import { contextList } from "./context-list";
import { contextCheckout } from "./context-checkout";

export const contextCommands = new Command()
  .name("context")
  .description("Manage Snap-in contexts using devrev-cli.");

contextCommands.addCommand(contextShow);
contextCommands.addCommand(contextList);
contextCommands.addCommand(contextCheckout);
