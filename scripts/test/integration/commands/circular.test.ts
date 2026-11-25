import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Path } from "effect"

import { findCycles } from "../../../commands/circular.ts"
import { makeTempFolder } from "../../utils/TempFolder.ts"

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
      const path = yield* Path.Path
      const dir = yield* makeTempFolder("circular-", modules)

      const cycles = yield* findCycles(Object.keys(modules).map((name) => path.join(dir, name)))

      assert.deepStrictEqual(cycles, expected)
    }).pipe(Effect.provide(NodeServices.layer)))
})
