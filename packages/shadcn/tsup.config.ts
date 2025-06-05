import { defineConfig } from "tsup"
import { BUILTIN_MODULES } from "./src/registry/constants"

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/registry/index.ts", "src/mcp/index.ts"],
  format: ["esm"],
  sourcemap: true,
  minify: false,
  target: "esnext",
  outDir: "dist",
  treeshake: true,
  external: [
    // Node.js built-in modules from constants
    ...Array.from(BUILTIN_MODULES),
    // Only externalize npm packages, not internal modules
    "@antfu/ni",
    "@babel/core",
    "@babel/parser", 
    "@babel/plugin-transform-typescript",
    "@modelcontextprotocol/sdk",
    "@types/yaml",
    "change-case",
    "commander",
    "cosmiconfig",
    "deepmerge",
    "diff",
    "dotenv",
    "execa",
    "fast-glob",
    "fs-extra",
    "https-proxy-agent",
    "js-yaml",
    "kleur",
    "node-fetch",
    "ora",
    "postcss",
    "prompts",
    "recast", 
    "stringify-object",
    "ts-morph",
    "tsconfig-paths",
    "yaml",
    "zod",
    "zod-to-json-schema"
  ],
  platform: "node"
})