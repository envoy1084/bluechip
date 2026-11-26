// What the mock API's signing flows share: WebAuthn options shaped as SimpleWebAuthn makes them (preview's fake
// passkeys answer any of them), and an operation landing on Base a few seconds after it is sent.
import type { LiveEvent } from "@bluechip/domain/Events"
import { Ceremony } from "@bluechip/domain/WebAuthn"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import type { PreviewStore } from "../../store.ts"
import { nextNumber } from "../../world/account/changes.ts"
import type { World } from "../../world/World.ts"

const base64Url = (text: string) => btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")

const RP_ID = typeof location === "undefined" ? "localhost" : location.hostname

/** Options to make a passkey, listing the account's own so the browser doesn't make a second on one device. */
export const registrationCeremony = (
  world: World,
  options: { readonly securityKey?: boolean } = {}
): Ceremony => {
  const n = nextNumber(world.account)
  const name = world.account.user.displayName ?? "bluechip"
  return new Ceremony({
    challengeId: `preview-challenge-${n}`,
    options: {
      challenge: base64Url(`preview-registration-${n}`),
      rp: { name: "bluechip", id: RP_ID },
      user: { id: base64Url(world.account.user.id), name, displayName: name },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      timeout: 60_000,
      attestation: "none",
      excludeCredentials: [],
      authenticatorSelection: { residentKey: "required", userVerification: "required", requireResidentKey: true },
      extensions: { credProps: true },
      hints: options.securityKey === true ? ["security-key"] : []
    }
  })
}

/** Options for a passkey to sign a challenge: signing in, or an operation's hash. */
export const authenticationOptions = (world: World): Record<string, unknown> => ({
  challenge: base64Url(`preview-signature-${nextNumber(world.account)}`),
  rpId: RP_ID,
  timeout: 60_000,
  userVerification: "required",
  allowCredentials: []
})

/** A sign-in ceremony. */
export const authenticationCeremony = (world: World): Ceremony =>
  new Ceremony({ challengeId: `preview-challenge-${nextNumber(world.account)}`, options: authenticationOptions(world) })

/** When a prepared change stops working if it isn't signed. */
export const expiresSoon = (): DateTime.Utc => DateTime.add(DateTime.nowUnsafe(), { minutes: 5 })

/** How long Base takes to include an operation in preview. */
const LANDING_MS = 3_000

/** Changes the world now, then sends the live events the change returns. */
export const changeNow = (preview: PreviewStore, change: (world: World) => ReadonlyArray<LiveEvent>) => {
  let events: ReadonlyArray<LiveEvent> = []
  preview.update((world) => {
    events = change(world)
  })
  for (const event of events) preview.emit(event)
}

/** An operation sent now lands on Base in a few seconds: `change` applies then, and its live events tell the app. */
export const landLater = (preview: PreviewStore, change: (world: World) => ReadonlyArray<LiveEvent>) =>
  Effect.sync(() => {
    setTimeout(() => changeNow(preview, change), LANDING_MS)
  })
