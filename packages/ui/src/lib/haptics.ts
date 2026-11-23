import { WebHaptics } from "web-haptics"

/**
 * A haptic, by what it means: `tap` for a press that does something, `select` for a setting flipping or a value
 * landing on a preset, `success` when something you asked for worked (Face ID, a trade filled), `nudge` before
 * something weighty (pausing every agent), `error` when a limit says no.
 */
export type Haptic = "tap" | "select" | "success" | "nudge" | "error"

const PRESET: Readonly<Record<Haptic, string>> = {
  tap: "light",
  select: "selection",
  success: "success",
  nudge: "nudge",
  error: "error"
}

// One instance for the page: web-haptics adds a hidden switch to the page for iOS, and one is enough.
let haptics: WebHaptics | undefined

// Desktop Chrome has `navigator.vibrate` but nothing to vibrate, so only touch screens get haptics.
const hasTouchScreen = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches

/** Fired on `window` for every haptic, with the `Haptic` as `detail`, so a page can show one where nothing vibrates. */
export const HAPTIC_EVENT = "bluechip:haptic"

/**
 * Plays a haptic on phones (web-haptics: the Vibration API, or the switch trick on iOS). Does nothing on desktop,
 * on the server, or where the device can't, apart from the `HAPTIC_EVENT`. Safe to call from any event handler or
 * effect.
 */
export const haptic = (kind: Haptic): void => {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<Haptic>(HAPTIC_EVENT, { detail: kind }))
  if (!hasTouchScreen()) return
  haptics ??= new WebHaptics()
  void haptics.trigger(PRESET[kind])
}
