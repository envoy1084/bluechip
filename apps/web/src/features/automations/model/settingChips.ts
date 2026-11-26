// An automation's settings as chips, each in the domain's own words with what kind of setting it is, so a page can
// give each its icon.
import { type Automation, triggerOf } from "@bluechip/domain/automations/Automation"
import { describeSettings, type Settings } from "@bluechip/domain/automations/Settings"

export type SettingKind = "cooldown" | "maxFires" | "expires" | "quietHours" | "marketHours" | "news"

export interface SettingChip {
  readonly kind: SettingKind
  readonly text: string
}

const NONE: Settings = {
  cooldownMinutes: 0,
  maxFires: null,
  expiresAt: null,
  quietHours: null,
  marketHoursOnly: false,
  actDirectly: false
}

const QUIET = { marketHours: false, asks: false }

/**
 * Each setting that changes when it runs, in the order the domain describes them: its wait between runs, how many
 * times it may run, until when, its quiet hours, market hours, and whether news trades ask you first. A setting left
 * at "no limit" has no chip; a run with no wait says so.
 */
export const settingChips = (automation: Pick<Automation, "trigger" | "settings">): Array<SettingChip> => {
  const { settings } = automation
  const trigger = triggerOf(automation.trigger)
  const one = (kind: SettingKind, only: Partial<Settings>, asks = QUIET): Array<SettingChip> =>
    describeSettings({ ...NONE, ...only }, asks).map((text) => ({ kind, text }))

  return [
    ...(settings.cooldownMinutes === 0 ?
      [{ kind: "cooldown" as const, text: "No wait between runs" }] :
      one("cooldown", { cooldownMinutes: settings.cooldownMinutes })),
    ...one("maxFires", { maxFires: settings.maxFires }),
    ...one("expires", { expiresAt: settings.expiresAt }),
    ...one("quietHours", { quietHours: settings.quietHours }),
    ...((settings.marketHoursOnly ?? trigger.marketHours) ? one("marketHours", { marketHoursOnly: true }) : []),
    ...(trigger.asks ? one("news", { actDirectly: settings.actDirectly }, { marketHours: false, asks: true }) : [])
  ]
}
