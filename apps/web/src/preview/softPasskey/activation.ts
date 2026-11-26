// Whether this browser answers passkey prompts with the software passkey. `?softPasskey` turns it on and
// `?softPasskey=off` turns it off; the choice is kept in local storage, so new tabs keep it too.
const KEY = "bluechip:softPasskey"

export const softPasskeyOn = (): boolean => {
  const asked = new URLSearchParams(window.location.search).get("softPasskey")
  if (asked === "off") {
    localStorage.removeItem(KEY)
    return false
  }
  if (asked !== null) localStorage.setItem(KEY, "on")
  return localStorage.getItem(KEY) === "on"
}

/** Turns it off and reloads, so the browser's own WebAuthn answers again. */
export const turnSoftPasskeyOff = () => {
  localStorage.removeItem(KEY)
  const url = new URL(window.location.href)
  url.searchParams.delete("softPasskey")
  window.location.assign(url.toString())
}
