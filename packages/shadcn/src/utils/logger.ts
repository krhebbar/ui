import { red, yellow, cyan, green } from "kleur/colors"

// Global state for logger configuration
let isLoggerSilent = false

export const logger = {
  // Configure logger silence mode
  setSilent(silent: boolean) {
    isLoggerSilent = silent
  },
  
  error(...args: unknown[]) {
    // Always show errors, even in silent mode
    console.log(red(args.join(" ")))
  },
  warn(...args: unknown[]) {
    // Always show warnings, even in silent mode
    console.log(yellow(args.join(" ")))
  },
  info(...args: unknown[]) {
    // Show info messages unless in silent mode
    if (!isLoggerSilent) {
      console.log(cyan(args.join(" ")))
    }
  },
  success(...args: unknown[]) {
    // Always show success messages
    console.log(green(args.join(" ")))
  },
  log(...args: unknown[]) {
    // Show general logs unless in silent mode
    if (!isLoggerSilent) {
      console.log(args.join(" "))
    }
  },
  break() {
    // Show line breaks unless in silent mode
    if (!isLoggerSilent) {
      console.log("")
    }
  },
}
