import path from "path"
import { expect, test } from "vitest"

import { getConfig } from "../../src/utils/get-config"

test("get config from project without manifest", async () => {
  expect(
    await getConfig(path.resolve(__dirname, "../fixtures/config-none"))
  ).toEqual(null)
})

test("get config generates from project structure", async () => {
  // Since we now generate config from manifest.yml/project structure,
  // we expect null for projects without proper airdrop structure
  expect(
    await getConfig(path.resolve(__dirname, "../fixtures/config-invalid"))
  ).toEqual(null)

  expect(
    await getConfig(path.resolve(__dirname, "../fixtures/config-partial"))
  ).toEqual(null)
})
