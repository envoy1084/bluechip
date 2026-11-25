import { assert, describe, it } from "@effect/vitest"
import { passkeyLabel } from "../../src/auth/PasskeyLabel.ts"

const mac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
const android =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36"

describe("passkeyLabel", () => {
  it("names the provider and the device", () => {
    assert.strictEqual(
      passkeyLabel({ aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4", userAgent: android }),
      "Google Password Manager on Android"
    )
    assert.strictEqual(
      passkeyLabel({ aaguid: "BADA5566-A7AA-401F-BD96-45619A55120D", userAgent: mac }),
      "1Password on Mac"
    )
  })

  it("falls back to the device, then to a plain name", () => {
    assert.strictEqual(
      passkeyLabel({ aaguid: "00000000-0000-0000-0000-000000000000", userAgent: mac }),
      "Passkey on Mac"
    )
    assert.strictEqual(
      passkeyLabel({ aaguid: "00000000-0000-0000-0000-000000000000", userAgent: undefined }),
      "Passkey"
    )
  })
})
