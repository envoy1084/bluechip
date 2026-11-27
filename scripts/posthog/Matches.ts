import { Predicate } from "effect"

/**
 * Whether `current` (an object as a remote API returns it) already says everything `desired` says. APIs add their own
 * fields and defaults, so only what `desired` sets is compared: objects by `desired`'s keys, arrays of objects in
 * order, arrays of plain values as sets (domains, ids, event names), `null` matching a field that is absent.
 */
export const matches = (desired: unknown, current: unknown): boolean => {
  if (desired === null || desired === undefined) return current === null || current === undefined
  if (Array.isArray(desired)) {
    if (!Array.isArray(current) || current.length !== desired.length) return false
    if (desired.every((value) => !Predicate.isObject(value))) {
      return desired.every((value) => current.some((other) => matches(value, other)))
    }
    return desired.every((value, index) => matches(value, current[index]))
  }
  if (Predicate.isObject(desired)) {
    if (!Predicate.isObject(current) || Array.isArray(current)) return false
    const fields = current as Readonly<Record<string, unknown>>
    return Object.entries(desired).every(([key, value]) => matches(value, fields[key]))
  }
  return desired === current
}
