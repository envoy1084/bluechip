// Made-up ids in the shapes the API checks (TypeIDs of UUIDv7s), the same on every load, so a toggle saved before a
// reload finds its record again.
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

/** The `n`th made-up id with `prefix`: `previewId("agent", 1)`. */
export const previewId = <P extends string>(prefix: P, n: number): `${P}_${string}` => {
  let counter = ""
  for (let rest = n; counter.length < 12; rest = Math.floor(rest / 32)) counter = ALPHABET[rest % 32] + counter
  return `${prefix}_01kqpv000070089${counter.slice(1)}` as `${P}_${string}`
}

/** A made-up UUID for request ids and the like, the same for the same `n`. */
export const previewUuid = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`
