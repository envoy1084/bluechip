import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { STANDING, type Standing } from "../lib/automationWords.ts"

/** Where an automation stands, as a pill; a running one's dot breathes while it watches. */
export function StandingPill({ standing }: Readonly<{ standing: Standing }>) {
  const { label, tone } = STANDING[standing]
  return <StatusPill tone={tone} dot={standing === "active" ? "live" : false}>{label}</StatusPill>
}
