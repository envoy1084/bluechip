import { Console, Effect } from "effect"
import { Command } from "effect/cli"
import { globSync } from "glob"
import { readFileSync } from "node:fs"
import * as Path from "node:path"

import { CheckFailed } from "../errors.ts"
import { importProblems } from "../lint/ImportDirections.ts"

/** JavaScript files under `root/scripts`: repository tooling is TypeScript, written as commands of this CLI. */
export const javaScriptScripts = (root: string) =>
  globSync("scripts/**/*.{js,mjs,cjs,jsx}", { cwd: root, ignore: "**/node_modules/**" }).sort()

export const lint = Command.make("lint").pipe(
  Command.withDescription("Check the repository rules oxlint cannot express"),
  Command.withHandler(
    Effect.fn("lint")(function*() {
      const root = process.cwd()
      const sources = globSync("apps/{web,server}/src/**/*.{ts,tsx}", { cwd: root, ignore: "**/routeTree.gen.ts" })
        .map((path) => ({ path, source: readFileSync(Path.join(root, path), "utf8") }))
      const problems = [
        ...javaScriptScripts(root).map((file) =>
          `${file}: repository scripts are TypeScript commands in scripts/commands/`
        ),
        ...importProblems(sources)
      ]
      if (problems.length > 0) return yield* CheckFailed.make({ check: "lint", problems })
      yield* Console.log("lint: ok")
    })
  )
)
