import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { connectionAtom } from "../../lib/api/events.ts"

/**
 * A small floating note when live updates are down, and when this version of the app must reload; nothing while
 * connected. The live stream dropping isn't the device going offline (prices still load), so it says which. It floats
 * over the page rather than push it down.
 */
export function ConnectionBanner() {
  const connection = useAtomValue(connectionAtom)
  if (connection !== "reconnecting" && connection !== "outdated") return null

  const outdated = connection === "outdated"
  const offline = typeof navigator !== "undefined" && !navigator.onLine
  return (
    <output className="flex max-w-[min(560px,calc(100vw-32px))] items-center gap-2.5 rounded-full bg-ink py-1.5 pr-1.5 pl-3.5 text-label text-white shadow-e3">
      <Icon name={outdated ? "refresh" : "bolt-off"} size={14} className="shrink-0 text-white/70" />
      <span className="min-w-0">
        {outdated ?
          "A new version of bluechip is ready. Reload to keep going." :
          offline ?
          "You're offline. Your agents keep trading inside their limits, and we reconnect when you're back." :
          "Live updates paused, reconnecting…"}
      </span>
      {outdated ?
        <Button size="xs" variant="secondary" onClick={() => window.location.reload()}>Reload</Button> :
        <span aria-hidden className="w-1.5" />}
    </output>
  )
}
