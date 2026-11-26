// Face ID in preview mode: the browser's WebAuthn calls answer with a made-up credential after a short pause, or are
// cancelled as a person would cancel them, as the panel says. The mock API accepts any credential.
import type { FaceIdMode } from "./store.ts"

const bytes = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer

const credential = (kind: "create" | "get") => {
  const response = kind === "create" ?
    {
      clientDataJSON: bytes("{\"type\":\"webauthn.create\"}"),
      attestationObject: bytes("preview"),
      getTransports: () => ["internal"],
      getPublicKey: () => bytes("preview-key"),
      getPublicKeyAlgorithm: () => -7,
      getAuthenticatorData: () => bytes("preview-data")
    } :
    {
      clientDataJSON: bytes("{\"type\":\"webauthn.get\"}"),
      authenticatorData: bytes("preview-data"),
      signature: bytes("preview-signature"),
      userHandle: bytes("preview-user")
    }
  return {
    id: "cHJldmlldy1wYXNza2V5",
    rawId: bytes("preview-passkey"),
    type: "public-key",
    authenticatorAttachment: "platform",
    response,
    getClientExtensionResults: () => ({})
  }
}

/** Answers WebAuthn with made-up credentials, as `mode()` says at each prompt. */
export const fakePasskeys = (mode: () => FaceIdMode) => {
  const answer = (kind: "create" | "get") => async () => {
    await new Promise((resolve) => setTimeout(resolve, 700))
    if (mode() === "cancel") throw new DOMException("The operation was cancelled (preview).", "NotAllowedError")
    return credential(kind) as unknown as Credential
  }
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: {
      create: answer("create"),
      get: answer("get"),
      store: async () => undefined,
      preventSilentAccess: async () => undefined
    }
  })
  if (typeof window.PublicKeyCredential !== "function") {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: function PublicKeyCredential() {}
    })
  }
}
