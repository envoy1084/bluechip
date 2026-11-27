// Which way imports may point inside the web app and the server (AGENTS.md "Web app layout", "Server layout"): shared
// code never imports features, features never import each other, and the server's infrastructure never imports its
// modules. oxlint can't express these, so `lint` checks them.
import * as Path from "node:path"

/** A source file: its path from the repository root, and its text. */
interface SourceFile {
  readonly path: string
  readonly source: string
}

const WEB = "apps/web/src/"
const SERVER = "apps/server/src/"
const SHARED_WEB = ["components", "hooks", "lib", "providers", "atoms"]
const COMPOSITION_ROOT = ["Api.ts", "Services.ts", "Server.ts", "main.ts"]

// The relative imports of a file, resolved from the repository root.
const importsOf = (file: SourceFile): ReadonlyArray<string> =>
  [...file.source.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].map((match) =>
    Path.posix.join(Path.posix.dirname(file.path), match[1]!)
  )

const webProblem = (from: string, to: string): string | undefined => {
  const [fromTop, fromFeature] = from.slice(WEB.length).split("/")
  const [toTop, toFeature] = to.slice(WEB.length).split("/")
  // Preview mode's made-up data never ships: only the browser entry loads it, in development.
  if (toTop === "preview" && fromTop !== "preview" && from !== `${WEB}client.tsx`) {
    return "imports preview/ (made-up data, development only): only client.tsx may load it"
  }
  if (fromTop === "preview" && (toTop === "features" || toTop === "routes")) {
    return "preview/ imports the app's features or routes: it stands in for the server, not the app"
  }
  if (SHARED_WEB.includes(fromTop!) && (toTop === "features" || toTop === "routes")) {
    return `shared code (${fromTop}/) imports ${toTop}/`
  }
  if (fromTop === "features" && toTop === "routes") return "a feature imports a route"
  if (fromTop === "features" && toTop === "features" && fromFeature !== toFeature) {
    return `feature ${fromFeature} imports feature ${toFeature}: move the shared piece to components/, hooks/ or lib/`
  }
  return undefined
}

const serverProblem = (from: string, to: string): string | undefined => {
  const fromPath = from.slice(SERVER.length)
  const [fromTop, fromModule] = fromPath.split("/")
  const toPath = to.slice(SERVER.length)
  const [toTop, toModule, toFile] = toPath.split("/")
  if (toTop !== undefined && COMPOSITION_ROOT.includes(toTop) && !COMPOSITION_ROOT.includes(fromTop!)) {
    return `imports the composition root (${toTop})`
  }
  // The schema aggregate is the one platform file that gathers every module's tables, for drizzle-kit.
  if ((fromTop === "platform" || fromTop === "config") && toTop === "modules" && fromPath !== "platform/db/schema.ts") {
    return `${fromTop}/ imports modules/`
  }
  if (fromTop === "modules" && toTop === "modules" && fromModule !== toModule && toFile === "http.ts") {
    return `module ${fromModule} imports module ${toModule}'s handlers`
  }
  return undefined
}

/** Every import in `files` that points the wrong way, as `file: problem (target)`. */
export const importProblems = (files: ReadonlyArray<SourceFile>): ReadonlyArray<string> =>
  files.flatMap((file) =>
    importsOf(file).flatMap((target) => {
      const problem = file.path.startsWith(WEB)
        ? webProblem(file.path, target)
        : file.path.startsWith(SERVER)
        ? serverProblem(file.path, target)
        : undefined
      return problem === undefined ? [] : [`${file.path}: ${problem} (${target})`]
    })
  )
