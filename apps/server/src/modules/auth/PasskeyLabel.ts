import { passkeyProviders } from "./passkeyProviders.ts"
import { browserOf, systemOf } from "./UserAgents.ts"

/**
 * A name a person recognizes for a passkey: its provider (from the AAGUID, when the authenticator shares one) and
 * the device it was created on (from the browser's user agent), such as "iCloud Keychain on Mac"; without a
 * provider, the browser it was made in ("Passkey from Chrome on Mac"). A name one of the user's other passkeys
 * already has (`taken`) gets the next number: "Passkey from Chrome on Mac (2)".
 */
export const passkeyLabel = (input: {
  readonly aaguid: string
  readonly userAgent: string | undefined
  readonly taken?: ReadonlyArray<string>
}): string => {
  const label = describe(input.aaguid, input.userAgent)
  const taken = new Set(input.taken ?? [])
  if (!taken.has(label)) return label

  let number = 2
  while (taken.has(`${label} (${number})`)) number++
  return `${label} (${number})`
}

const describe = (aaguid: string, userAgent: string | undefined): string => {
  const provider = passkeyProviders[aaguid.toLowerCase()]
  const device = systemOf(userAgent)
  if (provider !== undefined) return device === undefined ? provider : `${provider} on ${device}`

  const browser = browserOf(userAgent)
  if (browser !== undefined && device !== undefined) return `Passkey from ${browser} on ${device}`
  if (device !== undefined) return `Passkey on ${device}`
  return browser === undefined ? "Passkey" : `Passkey from ${browser}`
}
