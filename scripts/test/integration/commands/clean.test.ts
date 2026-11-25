import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { globSync } from "glob"

import { cleanWorkspace } from "../../../commands/clean.ts"
import { makeTempFolder } from "../../utils/TempFolder.ts"

describe("cleanWorkspace", () => {
  it.effect.each([
    { name: "dist in a package", files: ["packages/core/dist/index.js"] },
    { name: "build in an app", files: ["apps/web/build/index.js"] },
    { name: "coverage at the root", files: ["coverage/index.html"] },
    { name: ".data in an app", files: ["apps/web/.data/x.json"] },
    { name: "tmp at the root", files: ["tmp/a"] },
    { name: "tsconfig.tsbuildinfo in a package", files: ["packages/core/tsconfig.tsbuildinfo"] },
    { name: "any .tsbuildinfo at the root", files: ["tsconfig.tests.tsbuildinfo"] }
  ])("removes $name", ({ files }) =>
    Effect.gen(function*() {
      const root = yield* makeTempFolder("clean-", {
        ...Object.fromEntries(files.map((file) => [file, ""])),
        "packages/core/src/index.ts": ""
      })

      yield* cleanWorkspace(root)

      const left = globSync("**/*", { cwd: root, dot: true, nodir: true, posix: true }).sort()

      assert.deepStrictEqual(left, ["packages/core/src/index.ts"])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("keeps an output-named folder inside source", () =>
    Effect.gen(function*() {
      const root = yield* makeTempFolder("clean-", { "packages/core/src/dist/index.ts": "" })

      yield* cleanWorkspace(root)

      const left = globSync("**/*", { cwd: root, dot: true, nodir: true, posix: true }).sort()

      assert.deepStrictEqual(left, ["packages/core/src/dist/index.ts"])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("keeps a .tsbuildinfo other than tsconfig's in a package", () =>
    Effect.gen(function*() {
      const root = yield* makeTempFolder("clean-", { "packages/core/tsconfig.build.tsbuildinfo": "" })

      yield* cleanWorkspace(root)

      const left = globSync("**/*", { cwd: root, dot: true, nodir: true, posix: true }).sort()

      assert.deepStrictEqual(left, ["packages/core/tsconfig.build.tsbuildinfo"])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("cleans a workspace with nothing to remove", () =>
    Effect.gen(function*() {
      const root = yield* makeTempFolder("clean-", {})

      yield* cleanWorkspace(root)

      const left = globSync("**/*", { cwd: root, dot: true, nodir: true, posix: true }).sort()

      assert.deepStrictEqual(left, [])
    }).pipe(Effect.provide(NodeServices.layer)))
})
