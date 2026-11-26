import { StatusPill, type StatusTone } from "@bluechip/ui/bluechip/status-pill"
import type { Standing } from "../../../model/usage.ts"

const PILL: Readonly<Record<Exclude<Standing, "open">, { readonly label: string; readonly tone: StatusTone }>> = {
  room: { label: "Plenty left", tone: "positive" },
  nearly: { label: "Nearly used", tone: "attention" },
  used: { label: "Used up", tone: "negative" }
}

/** How a limit stands, as a pill; a limit without a cap shows `open` instead, or nothing. */
export function StandingPill({ standing, open }: Readonly<{ standing: Standing; open?: string }>) {
  const pill = standing === "open" ?
    open === undefined ? null : { label: open, tone: "neutral" as const } :
    PILL[standing]
  if (pill === null) return null

  return <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
}
