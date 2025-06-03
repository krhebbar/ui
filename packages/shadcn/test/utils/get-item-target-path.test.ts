import path from "path"
import { expect, test } from "vitest"

import { getItemTargetPath } from "../../src/registry/api"
import { getConfig } from "../../src/utils/get-config"

test("get item target path", async () => {
  // Full config - registry:block should map to components
  let appDir = path.resolve(__dirname, "../fixtures/config-full")
  expect(
    await getItemTargetPath(await getConfig(appDir), {
      type: "registry:block",
    })
  ).toEqual(path.resolve(appDir, "./src/components"))

  // Partial config - registry:file should map to components
  appDir = path.resolve(__dirname, "../fixtures/config-partial")
  expect(
    await getItemTargetPath(await getConfig(appDir), {
      type: "registry:file",
    })
  ).toEqual(path.resolve(appDir, "./components"))

  // JSX - registry:block should map to components
  appDir = path.resolve(__dirname, "../fixtures/config-jsx")
  expect(
    await getItemTargetPath(await getConfig(appDir), {
      type: "registry:block",
    })
  ).toEqual(path.resolve(appDir, "./components"))

  // Custom paths - registry:file should map to components
  appDir = path.resolve(__dirname, "../fixtures/config-ui")
  expect(
    await getItemTargetPath(await getConfig(appDir), {
      type: "registry:file",
    })
  ).toEqual(path.resolve(appDir, "./src/components"))
})
