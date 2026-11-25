import { Effect, FileSystem, Path } from "effect"

/** A new temporary folder, removed with the scope, holding `files` (path to contents, in folders as needed). */
export const makeTempFolder = Effect.fn("test.makeTempFolder")(function*(
  prefix: string,
  files: Readonly<Record<string, string>>
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* fs.makeTempDirectoryScoped({ prefix })
  for (const [file, contents] of Object.entries(files)) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true })
    yield* fs.writeFileString(path.join(root, file), contents)
  }
  return root
})
