// Turns the software passkey on for this page, before the app starts: `navigator.credentials` answers WebAuthn with
// the credentials kept in local storage, and a badge in the corner lists them.
import { makeAuthenticator } from "./Authenticator.ts"
import { localKeyring } from "./Keyring.ts"
import { chooseCredential, mountBadge } from "./ui.ts"

export const install = () => {
  const keyring = localKeyring()
  const authenticator = makeAuthenticator({ origin: window.location.origin, keyring, choose: chooseCredential })
  const badge = mountBadge(keyring)
  const native = navigator.credentials

  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: {
      create: async (options: CredentialCreationOptions = {}) => {
        if (options.publicKey === undefined) return native.create(options)
        const credential = await authenticator.create(options)
        badge.refresh()
        return credential as unknown as Credential
      },
      get: async (options: CredentialRequestOptions = {}) => {
        // Conditional mediation (passkey autofill) waits for a person to pick a key in a form; there is none here.
        if (options.publicKey === undefined || options.mediation === "conditional") return native.get(options)
        const assertion = await authenticator.get(options)
        badge.refresh()
        return assertion as unknown as Credential
      },
      store: (credential: Credential) => native.store(credential),
      preventSilentAccess: () => native.preventSilentAccess()
    }
  })
}
