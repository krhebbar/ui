import { defineConfig } from "tsup"
import { BUILTIN_MODULES } from "./src/registry/constants"

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/registry/index.ts", "src/mcp/index.ts"],
  format: ["esm"],
  sourcemap: true,
  minify: false,
  target: "node18",
  outDir: "dist",
  treeshake: true,
  external: [
    // Node.js built-in modules from constants
    ...Array.from(BUILTIN_MODULES),
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  platform: "node"
})
