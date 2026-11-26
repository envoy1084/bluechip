// Where the software passkey keeps its credentials: the browser's local storage, so an account outlives reloads and
// tabs. Private keys are JWKs in the clear; this is development only.

/** One credential the software passkey made. */
export interface SoftCredential {
  /** The credential id, base64url. */
  readonly id: string
  readonly privateKey: JsonWebKey
  readonly rpId: string
  /** The user handle the site gave at registration, base64url. */
  readonly userHandle: string
  readonly userName: string
  /** "Owner 1", "Recovery key 1". */
  readonly label: string
  readonly counter: number
  /** Milliseconds since the epoch. */
  readonly createdAt: number
}

export interface Keyring {
  readonly list: () => ReadonlyArray<SoftCredential>
  readonly save: (credentials: ReadonlyArray<SoftCredential>) => void
}

const STORAGE_KEY = "bluechip:softPasskey:keys"

/** Credentials kept in `localStorage`. */
export const localKeyring = (): Keyring => ({
  list: () => {
    const kept = localStorage.getItem(STORAGE_KEY)
    return kept === null ? [] : JSON.parse(kept) as ReadonlyArray<SoftCredential>
  },
  save: (credentials) => localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials))
})

/** Credentials kept in memory, gone with the page: for tests. */
export const memoryKeyring = (): Keyring => {
  let credentials: ReadonlyArray<SoftCredential> = []
  return {
    list: () => credentials,
    save: (next) => {
      credentials = next
    }
  }
}
