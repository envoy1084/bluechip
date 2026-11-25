import { passkeyProviders } from "./passkeyProviders.ts"

const devices: ReadonlyArray<readonly [RegExp, string]> = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "Chromebook"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"]
]

/**
 * A name a person recognizes for a passkey: its provider (from the AAGUID, when the authenticator shares one) and
 * the device it was created on (from the browser's user agent), such as "iCloud Keychain on Mac" or "Passkey on
 * Android".
 */
export const passkeyLabel = (input: { readonly aaguid: string; readonly userAgent: string | undefined }): string => {
  const provider = passkeyProviders[input.aaguid.toLowerCase()]
  const device = devices.find(([pattern]) => pattern.test(input.userAgent ?? ""))?.[1]
  if (provider !== undefined && device !== undefined) return `${provider} on ${device}`
  return provider ?? (device === undefined ? "Passkey" : `Passkey on ${device}`)
}
