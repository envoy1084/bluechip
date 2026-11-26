import type { Automation } from "@bluechip/domain/automations/Automation"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { settingChips, type SettingKind } from "../../model/settingChips.ts"

const ICON: Readonly<Record<SettingKind, IconName>> = {
  cooldown: "timer",
  maxFires: "refresh",
  expires: "calendar-check",
  quietHours: "moon",
  marketHours: "sun",
  news: "news"
}

/** Its settings as chips, each with its icon: the wait between runs, how often and until when, quiet and market hours. */
export function SettingsChips({ automation }: Readonly<{ automation: Pick<Automation, "trigger" | "settings"> }>) {
  const chips = settingChips(automation)
  if (chips.length === 0) return null

  return (
    <ul aria-label="Settings" className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <li
          key={chip.text}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-label-sm text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
        >
          <Icon name={ICON[chip.kind]} size={13} className="text-blue" />
          {chip.text}
        </li>
      ))}
    </ul>
  )
}
