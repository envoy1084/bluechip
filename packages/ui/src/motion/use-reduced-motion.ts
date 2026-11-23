import { useSyncExternalStore } from "react"
import { prefersReducedMotion, subscribeReducedMotion } from "./reduced-motion.ts"

/** Whether the person prefers reduced motion, kept in sync with the OS setting. False while server rendering. */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
