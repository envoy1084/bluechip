import { assert, describe, it } from "@effect/vitest"
import { passkeyLabel } from "../../../../src/modules/auth/PasskeyLabel.ts"

const safariOnMac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
const chromeOnMac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
const android =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36"
const unknown = "00000000-0000-0000-0000-000000000000"

describe("passkeyLabel", () => {
  it.each([
    {
      name: "the provider on the device",
      input: { aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4", userAgent: android },
      expected: "Google Password Manager on Android"
    },
    {
      name: "the provider's AAGUID in capitals",
      input: { aaguid: "BADA5566-A7AA-401F-BD96-45619A55120D", userAgent: safariOnMac },
      expected: "1Password on Mac"
    },
    {
      name: "the provider, on a device the user agent doesn't name",
      input: { aaguid: "bada5566-a7aa-401f-bd96-45619a55120d", userAgent: undefined },
      expected: "1Password"
    },
    {
      name: "no provider: the browser on the device",
      input: { aaguid: unknown, userAgent: chromeOnMac },
      expected: "Passkey from Chrome on Mac"
    },
    {
      name: "no provider, Safari on the same Mac: a different name",
      input: { aaguid: unknown, userAgent: safariOnMac },
      expected: "Passkey from Safari on Mac"
    },
    {
      name: "no provider and no browser named: the device",
      input: { aaguid: unknown, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      expected: "Passkey on Mac"
    },
    {
      name: "a user agent that says nothing",
      input: { aaguid: unknown, userAgent: undefined },
      expected: "Passkey"
    },
    {
      name: "a name none of the other passkeys has",
      input: { aaguid: unknown, userAgent: chromeOnMac, taken: ["iCloud Keychain on Mac"] },
      expected: "Passkey from Chrome on Mac"
    },
    {
      name: "the second passkey with the same name",
      input: { aaguid: unknown, userAgent: chromeOnMac, taken: ["Passkey from Chrome on Mac"] },
      expected: "Passkey from Chrome on Mac (2)"
    },
    {
      name: "the next number free",
      input: {
        aaguid: unknown,
        userAgent: chromeOnMac,
        taken: ["Passkey from Chrome on Mac", "Passkey from Chrome on Mac (2)"]
      },
      expected: "Passkey from Chrome on Mac (3)"
    },
    {
      name: "a number freed by a removed passkey is used again",
      input: { aaguid: unknown, userAgent: chromeOnMac, taken: ["Passkey from Chrome on Mac (2)"] },
      expected: "Passkey from Chrome on Mac"
    }
  ])("$name", ({ input, expected }) => {
    assert.strictEqual(passkeyLabel(input), expected)
  })
})
