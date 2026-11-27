import { Console, Effect, FileSystem } from "effect"
import { Command, Flag } from "effect/cli"
import { createECDH } from "node:crypto"

/** A web push identity: a P-256 key pair, raw and base64url, as browsers and the server take it. */
interface VapidKeys {
  readonly publicKey: string
  readonly privateKey: string
}

/** A new VAPID key pair. */
export const makeVapidKeys = (): VapidKeys => {
  const keys = createECDH("prime256v1")
  keys.generateKeys()
  return {
    publicKey: keys.getPublicKey().toString("base64url"),
    privateKey: keys.getPrivateKey().toString("base64url")
  }
}

/**
 * Writes `keys` into the env file at `file` (made if missing), as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. A file
 * that has both already keeps them, so subscribed browsers keep working, unless `replace`; empty or commented-out
 * entries are filled in. Returns whether it wrote them.
 */
export const writeVapidKeys = Effect.fn("vapid.writeVapidKeys")(function*(
  file: string,
  keys: VapidKeys,
  options: { readonly replace: boolean }
) {
  const fs = yield* FileSystem.FileSystem
  const text = (yield* fs.exists(file)) ? yield* fs.readFileString(file) : ""
  const set = /^VAPID_PUBLIC_KEY=\S+$/m.test(text) && /^VAPID_PRIVATE_KEY=\S+$/m.test(text)
  if (set && !options.replace) return false

  const lines = text.split("\n").filter((line) => !/^#?\s*VAPID_(PUBLIC|PRIVATE)_KEY=/.test(line))
  while (lines.length > 0 && lines.at(-1) === "") lines.pop()
  const entries = [`VAPID_PUBLIC_KEY=${keys.publicKey}`, `VAPID_PRIVATE_KEY=${keys.privateKey}`]
  yield* fs.writeFileString(file, [...lines, ...entries].join("\n") + "\n")
  return true
})

const env = Flag.String("env").pipe(
  Flag.optional,
  Flag.withDescription("The env file to write the keys into (apps/server/.env.local); printed when left out")
)

const replace = Flag.Boolean("replace").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Replace keys the file already has: every browser subscribed must subscribe again")
)

export const vapid = Command.make("vapid", { env, replace }).pipe(
  Command.withDescription("Make the server's web push (VAPID) key pair"),
  Command.withHandler(({ env, replace }) =>
    Effect.gen(function*() {
      const keys = makeVapidKeys()
      if (env._tag === "None") {
        return yield* Console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}`)
      }
      const wrote = yield* writeVapidKeys(env.value, keys, { replace })
      yield* Console.log(wrote ? `vapid: keys written to ${env.value}` : `vapid: ${env.value} has keys already`)
    })
  )
)
