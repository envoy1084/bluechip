// A virtual platform authenticator (Chromium's WebAuthn domain over CDP): the page's Face ID. Passkeys live in it, in
// the test's own browser, never in a real profile.
import type { CDPSession, Page } from "@playwright/test"

interface Credential {
  readonly credentialId: string
  readonly isResidentCredential: boolean
  readonly rpId?: string
  readonly privateKey: string
  readonly userHandle?: string
  readonly signCount: number
}

export interface Authenticator {
  /** The passkeys it holds. */
  readonly credentials: () => Promise<ReadonlyArray<Credential>>
  /** Whether Face ID succeeds: `false` makes every ceremony fail, as when you cancel it. */
  readonly setVerified: (verified: boolean) => Promise<void>
  /** Copies its passkeys into another page's authenticator: the same person on a new device with synced passkeys. */
  readonly copyTo: (other: Authenticator) => Promise<void>
  readonly add: (credential: Credential) => Promise<void>
}

export const addAuthenticator = async (page: Page): Promise<Authenticator> => {
  const cdp: CDPSession = await page.context().newCDPSession(page)
  await cdp.send("WebAuthn.enable")
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  })

  const authenticator: Authenticator = {
    credentials: async () => (await cdp.send("WebAuthn.getCredentials", { authenticatorId })).credentials,
    setVerified: async (verified) => {
      await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: verified })
      // A failed verification otherwise waits for a person to answer the prompt.
      await cdp.send("WebAuthn.setAutomaticPresenceSimulation", { authenticatorId, enabled: true })
    },
    add: async (credential) => {
      await cdp.send("WebAuthn.addCredential", { authenticatorId, credential })
    },
    copyTo: async (other) => {
      for (const credential of await authenticator.credentials()) await other.add(credential)
    }
  }
  return authenticator
}
