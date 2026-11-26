import { useCallback, useSyncExternalStore } from "react"

/** The person's appearance setting: follow the system, or always light or always dark. */
export type ThemeChoice = "system" | "light" | "dark"

/** The localStorage key holding the choice, per browser. Absent means "system". */
export const themeStorageKey = "bluechip-theme"

/** Reads a stored value; anything but "light" or "dark" (nothing stored, an old or edited value) is "system". */
export const parseThemeChoice = (stored: string | null): ThemeChoice =>
  stored === "light" || stored === "dark" ? stored : "system"

/**
 * Sets `data-theme` on the root element for an explicit choice, and removes it for "system", so the styles follow
 * `prefers-color-scheme`.
 */
export const applyThemeChoice = (choice: ThemeChoice, root: HTMLElement = document.documentElement): void => {
  if (choice === "system") root.removeAttribute("data-theme")
  else root.setAttribute("data-theme", choice)
}

/**
 * Runs in the document head before the page paints, so a stored choice never flashes the other theme first. Kept in
 * step with `parseThemeChoice` and `applyThemeChoice`.
 */
export const themeScript = `try{var t=localStorage.getItem(${
  JSON.stringify(themeStorageKey)
});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`

/**
 * The choice stored in this browser. Storage can throw (blocked site data, some private windows); the choice then
 * lasts until the page reloads, kept on the root element.
 */
export const readThemeChoice = (): ThemeChoice => {
  try {
    return parseThemeChoice(localStorage.getItem(themeStorageKey))
  } catch {
    return parseThemeChoice(document.documentElement.getAttribute("data-theme"))
  }
}

const storeChoice = (choice: ThemeChoice): void => {
  try {
    if (choice === "system") localStorage.removeItem(themeStorageKey)
    else localStorage.setItem(themeStorageKey, choice)
  } catch {
    // Not saved: `readThemeChoice` falls back to the attribute set below, so this page still shows the choice.
  }
}

const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  // Another tab changing the setting changes this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== themeStorageKey && event.key !== null) return
    applyThemeChoice(readThemeChoice())
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** The appearance setting and a setter that applies it to the page and remembers it in this browser. */
export function useThemeChoice(): readonly [ThemeChoice, (choice: ThemeChoice) => void] {
  // The server can't see this browser's storage, so it renders "system"; the client reads the real choice after.
  const choice = useSyncExternalStore(subscribe, readThemeChoice, () => "system" as const)
  const setChoice = useCallback((next: ThemeChoice) => {
    storeChoice(next)
    applyThemeChoice(next)
    for (const listener of listeners) listener()
  }, [])
  return [choice, setChoice] as const
}
