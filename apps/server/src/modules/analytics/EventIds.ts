import { createHash } from "node:crypto"

// bluechip's own namespace for analytics events' UUIDv5s (a random v4, fixed for good: changing it re-counts history).
const NAMESPACE = Buffer.from("6f1c2b0e8a7d4c3e9b5f1a2d3c4e5f60", "hex")

/**
 * The event's uuid: a UUIDv5 (RFC 9562) of the fact it tells and its name, so a fact sent twice (a workflow step
 * retried after a restart) is one event: PostHog keeps one event per uuid, distinct id, name and timestamp.
 */
export const eventUuid = (factId: string, event: string): string => {
  const hash = createHash("sha1").update(NAMESPACE).update(`${event}:${factId}`).digest()
  hash[6] = (hash[6]! & 0x0f) | 0x50
  hash[8] = (hash[8]! & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
