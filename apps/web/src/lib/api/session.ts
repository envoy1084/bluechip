// Whether this browser's session is still live, from the API's answers. The account's answer (`GET /api/account`)
// says it is; a 401 from anything else signed in says it ended (expired, or signed out on another device or tab).
// Signing in and recovering answer 401 for their own reasons, so they never end a session.

/** What an answer tells about the session: `ended` once, on the first 401 after the account was shown. */
export interface SessionAnswer {
  readonly live: boolean
  readonly ended: boolean
}

/** The session after an answer of `status` to `url`, from whether it was `live` before. */
export const sessionAfter = (live: boolean, status: number, url: string): SessionAnswer => {
  const path = new URL(url, "http://localhost").pathname
  // The account's own 401 already shows the session ended where it is read.
  if (path === "/api/account") {
    return { live: status >= 200 && status < 300 ? true : status === 401 ? false : live, ended: false }
  }

  const ownReasons = path.startsWith("/api/auth/") || path.startsWith("/api/recovery")
  if (status === 401 && live && !ownReasons) return { live: false, ended: true }
  return { live, ended: false }
}
