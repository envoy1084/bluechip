import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"

import { javaScriptScripts } from "../../../commands/lint.ts"
import { makeTempFolder } from "../../utils/TempFolder.ts"

describe("javaScriptScripts", () => {
  it.effect.each([
    { name: "a .js file", files: ["scripts/old.js"], expected: ["scripts/old.js"] },
    { name: "a .mjs file", files: ["scripts/old.mjs"], expected: ["scripts/old.mjs"] },
    { name: "a .cjs file", files: ["scripts/old.cjs"], expected: ["scripts/old.cjs"] },
    { name: "a .jsx file", files: ["scripts/old.jsx"], expected: ["scripts/old.jsx"] },
    { name: "a nested file", files: ["scripts/commands/x.js"], expected: ["scripts/commands/x.js"] },
    { name: "TypeScript", files: ["scripts/bin.ts"], expected: [] },
    { name: "a dependency's file", files: ["scripts/node_modules/dep/index.js"], expected: [] },
    { name: "a file outside scripts/", files: ["packages/core/index.js"], expected: [] },
    {
      name: "several files, sorted",
      files: ["scripts/old.mjs", "scripts/commands/x.js", "scripts/a.cjs"],
      expected: ["scripts/a.cjs", "scripts/commands/x.js", "scripts/old.mjs"]
    },
    { name: "an empty repository", files: [], expected: [] }
  ])("finds $name", ({ expected, files }) =>
    Effect.gen(function*() {
      const root = yield* makeTempFolder("lint-", Object.fromEntries(files.map((file) => [file, ""])))

      const scripts = javaScriptScripts(root)

      assert.deepStrictEqual(scripts, expected)
    }).pipe(Effect.provide(NodeServices.layer)))
})
