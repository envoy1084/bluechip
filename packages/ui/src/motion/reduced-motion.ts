const QUERY = "(prefers-reduced-motion: reduce)"

const query = (): MediaQueryList | undefined =>
  typeof window === "undefined" || typeof window.matchMedia !== "function" ? undefined : window.matchMedia(QUERY)

/** Whether the person asked their device for reduced motion. False on the server. */
export const prefersReducedMotion = (): boolean => query()?.matches ?? false

/** Call `onChange` whenever the reduced-motion preference changes; returns the unsubscribe function. */
export const subscribeReducedMotion = (onChange: () => void): () => void => {
  const list = query()
  if (!list) return () => {}
  list.addEventListener("change", onChange)
  return () => list.removeEventListener("change", onChange)
}
