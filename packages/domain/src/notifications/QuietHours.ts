/**
 * Quiet hours: when push and Telegram wait, and until when.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import { isWithin, localClock, minutesOf } from "../automations/Time.ts"
import type { QuietHours, Severity } from "./Notification.ts"

/**
 * When a notification of `severity` may go out on push or Telegram: `undefined` for now, or the end of the quiet
 * hours `now` falls in. Security notifications never wait.
 *
 * **Example** (A trade at 23:30 UTC with quiet hours 22:00 to 07:00)
 *
 * ```ts import.meta.vitest
 * import { quietUntil } from "@bluechip/domain/notifications/QuietHours"
 * import * as DateTime from "effect/DateTime"
 *
 * const until = quietUntil(
 *   { from: "22:00", to: "07:00", zone: "UTC" },
 *   "info",
 *   DateTime.makeUnsafe("2026-11-26T23:30:00Z")
 * )
 * until === undefined ? undefined : DateTime.formatIso(until) // => "2026-11-27T07:00:00.000Z"
 * ```
 *
 * @stability unstable
 * @category rules
 * @since 0.0.0
 */
export const quietUntil = (
  quiet: QuietHours | null,
  severity: Severity,
  now: DateTime.Utc
): DateTime.Utc | undefined => {
  if (quiet === null || severity === "security") return undefined
  const { minutes } = localClock(now, quiet.zone)
  if (!isWithin(minutes, quiet.from, quiet.to)) return undefined
  const left = (minutesOf(quiet.to) - minutes + 24 * 60) % (24 * 60)
  return DateTime.startOf(DateTime.add(now, { minutes: left }), "minute")
}
