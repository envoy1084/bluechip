// What a passkey prompt that didn't finish means for you. The browser says why only by the error's name
// (WebAuthn's DOMExceptions), which SimpleWebAuthn and Effect keep in the error or along its `cause` chain.

/** Why Face ID didn't finish, in words; `cancelled` when you closed the prompt, which isn't a problem to show in red. */
export interface PasskeyProblem {
  readonly cancelled: boolean
  readonly text: string
}

const namesOf = (error: unknown): Array<string> => {
  const names: Array<string> = []
  let current: unknown = error
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth++) {
    const { name, cause } = current as { readonly name?: unknown; readonly cause?: unknown }
    if (typeof name === "string") names.push(name)
    current = cause
  }
  return names
}

/**
 * Why Face ID didn't finish: you cancelled it ("You cancelled Face ID. Nothing was sent."), this browser or address
 * can't use passkeys, or the passkey can't be used here; anything else didn't finish. `nothing` says what that left
 * as it was: "Nothing was sent." by default, "Nothing changed.", "Nothing was bought.".
 */
export const passkeyProblem = (error: unknown, nothing = "Nothing was sent."): PasskeyProblem => {
  const names = namesOf(error)
  if (names.includes("NotAllowedError") || names.includes("AbortError")) {
    return { cancelled: true, text: `You cancelled Face ID. ${nothing}` }
  }
  if (names.includes("NotSupportedError")) {
    return { cancelled: false, text: `This browser can't use passkeys. Try Safari or Chrome on your phone. ${nothing}` }
  }
  if (names.includes("SecurityError")) {
    return {
      cancelled: false,
      text: `Passkeys don't work on this address. Open bluechip from its usual link. ${nothing}`
    }
  }
  if (names.includes("InvalidStateError")) {
    return { cancelled: false, text: `This passkey can't be used here. Try one of your other devices. ${nothing}` }
  }
  return { cancelled: false, text: `Face ID didn't finish, or the request couldn't be sent. ${nothing}` }
}
