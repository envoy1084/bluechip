import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"

import { findCycles } from "../commands/circular.ts"

// Writes `modules` into a new temporary folder and finds the cycles between them.
const cyclesIn = Effect.fn(function*(modules: Record<string, string>) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "circular-" })
  for (const [name, source] of Object.entries(modules)) yield* fs.writeFileString(path.join(dir, name), source)

  return yield* findCycles(Object.keys(modules).map((name) => path.join(dir, name)))
})

describe("findCycles", () => {
  it.effect.each([
    {
      name: "two modules importing each other",
      modules: {
        "a.ts": `import { b } from "./b.ts"\nexport const a = () => b\n`,
        "b.ts": `import { a } from "./a.ts"\nexport const b = () => a\n`
      },
      expected: ["a.ts -> b.ts"]
    },
    {
      name: "three modules in a ring",
      modules: {
        "a.ts": `import { b } from "./b.ts"\nexport const a = () => b\n`,
        "b.ts": `import { c } from "./c.ts"\nexport const b = () => c\n`,
        "c.ts": `import { a } from "./a.ts"\nexport const c = () => a\n`
      },
      expected: ["a.ts -> b.ts -> c.ts"]
    },
    {
      name: "a cycle between .tsx modules",
      modules: {
        "a.tsx": `import { b } from "./b.tsx"\nexport const a = () => b\n`,
        "b.tsx": `import { a } from "./a.tsx"\nexport const b = () => a\n`
      },
      expected: ["a.tsx -> b.tsx"]
    },
    {
      name: "one module importing another",
      modules: {
        "a.ts": `import { b } from "./b.ts"\nexport const a = () => b\n`,
        "b.ts": `export const b = 1\n`
      },
      expected: []
    },
    {
      name: "a cycle closed by an import type",
      modules: {
        "a.ts": `import type { B } from "./b.ts"\nexport const a = 1\nexport type A = { readonly b: B }\n`,
        "b.ts": `import { a } from "./a.ts"\nexport const b = a\nexport type B = number\n`
      },
      expected: []
    },
    {
      name: "a cycle closed by an inline type specifier",
      modules: {
        "a.ts": `import { type B } from "./b.ts"\nexport const a = 1\nexport type A = { readonly b: B }\n`,
        "b.ts": `import { a } from "./a.ts"\nexport const b = a\nexport type B = number\n`
      },
      expected: []
    },
    { name: "no modules", modules: {}, expected: [] }
  ])("$name", ({ expected, modules }) =>
    Effect.gen(function*() {
      assert.deepStrictEqual(yield* cyclesIn(modules), expected)
    }).pipe(Effect.provide(NodeServices.layer)))
})
