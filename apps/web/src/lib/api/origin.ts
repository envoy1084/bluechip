/**
 * The server's origin from `VITE_API_URL` (`https://api.bluechip.markets` on production): paper and production call
 * the API on its own domain, with the session cookie (`credentials: "include"`, the server allows this site's origin).
 * Empty under `vite dev`, the browser suite and preview mode, where the server's paths are on the page's own origin
 * (Vite proxies them).
 */
export const apiOrigin: string = (import.meta.env["VITE_API_URL"] ?? "").replace(/\/+$/, "")

/** A server path (`/api/rpc`) as an absolute URL, for clients that need one; a prerendered page has no origin. */
export const apiUrl = (path: string): string => {
  if (apiOrigin !== "") return `${apiOrigin}${path}`
  return typeof window === "undefined" ? `http://localhost${path}` : `${window.location.origin}${path}`
}
