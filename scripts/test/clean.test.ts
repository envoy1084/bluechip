import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { globSync } from "glob"

import { cleanWorkspace } from "../commands/clean.ts"

// Writes `files` (empty) into a new temporary workspace, cleans it, and lists the files left.
const cleanFiles = Effect.fn(function*(files: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "clean-" })
  for (const file of files) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true })
    yield* fs.writeFileString(path.join(root, file), "")
  }

  yield* cleanWorkspace(root)

  return globSync("**/*", { cwd: root, dot: true, nodir: true, posix: true }).sort()
})

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
      const left = yield* cleanFiles([...files, "packages/core/src/index.ts"])

      assert.deepStrictEqual(left, ["packages/core/src/index.ts"])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("keeps an output-named folder inside source", () =>
    Effect.gen(function*() {
      const left = yield* cleanFiles(["packages/core/src/dist/index.ts"])

      assert.deepStrictEqual(left, ["packages/core/src/dist/index.ts"])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("keeps a .tsbuildinfo other than tsconfig's in a package", () =>
    Effect.gen(function*() {
      const left = yield* cleanFiles(["packages/core/tsconfig.build.tsbuildinfo"])

      assert.deepStrictEqual(left, ["packages/core/tsconfig.build.tsbuildinfo"])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("cleans a workspace with nothing to remove", () =>
    Effect.gen(function*() {
      const left = yield* cleanFiles([])

      assert.deepStrictEqual(left, [])
    }).pipe(Effect.provide(NodeServices.layer)))
})
