import { assert, describe, it } from "@effect/vitest"
import { deviceOf } from "../../../../src/modules/auth/UserAgents.ts"

describe("deviceOf", () => {
  it.each([
    {
      name: "Chrome on Mac",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    {
      name: "Safari on iPhone",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Safari/604.1"
    },
    {
      name: "Edge on Windows",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
    },
    { name: "Firefox on Linux", userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0" },
    { name: "Android", userAgent: "Mozilla/5.0 (Linux; Android 15) Mobile" },
    { name: "A browser", userAgent: "curl/8.0" },
    { name: "A browser", userAgent: undefined }
  ])("$name", ({ name, userAgent }) => {
    assert.strictEqual(deviceOf(userAgent), name)
  })
})
