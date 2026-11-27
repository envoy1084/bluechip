import { assert, describe, it } from "@effect/vitest"
import { passkeyFailureReason, passkeyProblem } from "../../../src/lib/passkeyProblem.ts"

const domError = (name: string) => Object.assign(new Error("The operation failed."), { name })

describe("passkeyProblem", () => {
  it.each([
    {
      name: "you closed the prompt",
      error: domError("NotAllowedError"),
      expected: { cancelled: true, text: "You cancelled Face ID. Nothing was sent." }
    },
    {
      name: "the prompt was aborted",
      error: domError("AbortError"),
      expected: { cancelled: true, text: "You cancelled Face ID. Nothing was sent." }
    },
    {
      name: "a cancel wrapped in causes, as Effect and SimpleWebAuthn pass it on",
      error: new Error("An unknown error occurred", {
        cause: { name: "WebAuthnError", cause: domError("NotAllowedError") }
      }),
      expected: { cancelled: true, text: "You cancelled Face ID. Nothing was sent." }
    },
    {
      name: "a browser without passkeys",
      error: domError("NotSupportedError"),
      expected: {
        cancelled: false,
        text: "This browser can't use passkeys. Try Safari or Chrome on your phone. Nothing was sent."
      }
    },
    {
      name: "an address passkeys don't work on",
      error: domError("SecurityError"),
      expected: {
        cancelled: false,
        text: "Passkeys don't work on this address. Open bluechip from its usual link. Nothing was sent."
      }
    },
    {
      name: "a passkey that can't be used here",
      error: domError("InvalidStateError"),
      expected: {
        cancelled: false,
        text: "This passkey can't be used here. Try one of your other devices. Nothing was sent."
      }
    },
    {
      name: "anything else",
      error: new Error("Failed to fetch"),
      expected: { cancelled: false, text: "Face ID didn't finish, or the request couldn't be sent. Nothing was sent." }
    },
    {
      name: "not an error at all",
      error: "nope",
      expected: { cancelled: false, text: "Face ID didn't finish, or the request couldn't be sent. Nothing was sent." }
    }
  ])("$name", ({ error, expected }) => {
    assert.deepStrictEqual(passkeyProblem(error), expected)
  })

  it("says what was left as it was", () => {
    assert.deepStrictEqual(passkeyProblem(domError("NotAllowedError"), "Nothing changed."), {
      cancelled: true,
      text: "You cancelled Face ID. Nothing changed."
    })
  })
})

describe("passkeyFailureReason", () => {
  it.each([
    { name: "the prompt was aborted", error: domError("AbortError"), expected: "cancelled" },
    { name: "the browser refused (closed or timed out)", error: domError("NotAllowedError"), expected: "not_allowed" },
    { name: "a passkey that can't be used here", error: domError("InvalidStateError"), expected: "not_allowed" },
    { name: "out of time", error: domError("TimeoutError"), expected: "timeout" },
    { name: "a browser without passkeys", error: domError("NotSupportedError"), expected: "unsupported" },
    { name: "an address passkeys don't work on", error: domError("SecurityError"), expected: "unsupported" },
    {
      name: "a refusal wrapped in causes",
      error: new Error("An unknown error occurred", { cause: domError("NotAllowedError") }),
      expected: "not_allowed"
    },
    { name: "a failure that isn't the prompt's", error: new Error("Failed to fetch"), expected: null }
  ])("$name", ({ error, expected }) => {
    assert.strictEqual(passkeyFailureReason(error), expected)
  })
})
