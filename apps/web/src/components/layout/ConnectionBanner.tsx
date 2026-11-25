import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { connectionAtom } from "../../lib/api/events.ts"

/** Says when live updates are down, and when this version of the app must reload. Hidden while connected. */
export function ConnectionBanner() {
  const connection = useAtomValue(connectionAtom)
  if (connection !== "reconnecting" && connection !== "outdated") return null
  const outdated = connection === "outdated"
  return (
    <output className="flex items-start gap-3 rounded-lg bg-white px-4 py-3.5 shadow-e1">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-g-100 text-g-600">
        <Icon name={outdated ? "refresh" : "bolt-off"} size={16} />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <b className="text-sm font-semibold">{outdated ? "A new version of bluechip is ready" : "You're offline"}</b>
        <span className="text-[13px] text-g-500">
          {outdated ?
            "Reload to keep using the app." :
            "Prices and balances may be out of date. Your agents keep trading inside their limits. We'll reconnect on our own."}
        </span>
      </div>
      {outdated ? <Button size="sm" onClick={() => window.location.reload()}>Reload</Button> : null}
    </output>
  )
}
