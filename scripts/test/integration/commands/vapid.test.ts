import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"

import { makeVapidKeys, writeVapidKeys } from "../../../commands/vapid.ts"
import { makeTempFolder } from "../../utils/TempFolder.ts"

const keys = { publicKey: "B-public", privateKey: "private" }

describe("writeVapidKeys", () => {
  it.effect.each([
    {
      name: "a file without keys: added at the end",
      before: "PORT=8080\n",
      after: "PORT=8080\nVAPID_PUBLIC_KEY=B-public\nVAPID_PRIVATE_KEY=private\n"
    },
    {
      name: "empty entries: filled in",
      before: "PORT=8080\nVAPID_PUBLIC_KEY=\nVAPID_PRIVATE_KEY=\n",
      after: "PORT=8080\nVAPID_PUBLIC_KEY=B-public\nVAPID_PRIVATE_KEY=private\n"
    },
    {
      name: "commented-out entries: replaced",
      before: "# VAPID_PUBLIC_KEY=\n# VAPID_PRIVATE_KEY=\nPORT=8080\n",
      after: "PORT=8080\nVAPID_PUBLIC_KEY=B-public\nVAPID_PRIVATE_KEY=private\n"
    }
  ])("$name", ({ after, before }) =>
    Effect.gen(function*() {
      const root = yield* makeTempFolder("vapid-", { ".env.local": before })
      const file = (yield* Path.Path).join(root, ".env.local")

      const wrote = yield* writeVapidKeys(file, keys, { replace: false })

      assert.deepStrictEqual([wrote, yield* (yield* FileSystem.FileSystem).readFileString(file)], [true, after])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("keys set already: kept", () =>
    Effect.gen(function*() {
      const before = "VAPID_PUBLIC_KEY=B-old\nVAPID_PRIVATE_KEY=old\n"
      const root = yield* makeTempFolder("vapid-", { ".env.local": before })
      const file = (yield* Path.Path).join(root, ".env.local")

      const wrote = yield* writeVapidKeys(file, keys, { replace: false })

      assert.deepStrictEqual([wrote, yield* (yield* FileSystem.FileSystem).readFileString(file)], [false, before])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("keys set already, replaced on request", () =>
    Effect.gen(function*() {
      const root = yield* makeTempFolder("vapid-", { ".env.local": "VAPID_PUBLIC_KEY=B-old\nVAPID_PRIVATE_KEY=old\n" })
      const file = (yield* Path.Path).join(root, ".env.local")

      yield* writeVapidKeys(file, keys, { replace: true })

      assert.strictEqual(
        yield* (yield* FileSystem.FileSystem).readFileString(file),
        "VAPID_PUBLIC_KEY=B-public\nVAPID_PRIVATE_KEY=private\n"
      )
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("no file yet: made", () =>
    Effect.gen(function*() {
      const root = yield* makeTempFolder("vapid-", {})
      const file = (yield* Path.Path).join(root, ".env.local")

      yield* writeVapidKeys(file, keys, { replace: false })

      assert.strictEqual(
        yield* (yield* FileSystem.FileSystem).readFileString(file),
        "VAPID_PUBLIC_KEY=B-public\nVAPID_PRIVATE_KEY=private\n"
      )
    }).pipe(Effect.provide(NodeServices.layer)))
})

describe("makeVapidKeys", () => {
  it("a raw P-256 key pair: 65-byte public key, 32-byte private key", () => {
    const made = makeVapidKeys()

    assert.deepStrictEqual(
      [Buffer.from(made.publicKey, "base64url").length, Buffer.from(made.privateKey, "base64url").length],
      [65, 32]
    )
  })
})
