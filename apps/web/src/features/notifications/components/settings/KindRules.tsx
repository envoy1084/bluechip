import type { KindInfo } from "@bluechip/domain/notifications/Kinds"
import type { Channel, NotificationRule } from "@bluechip/domain/notifications/Notification"
import { Switch } from "@bluechip/ui/components/switch"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { SettingsRow, SettingsSection } from "../../../../components/layout/SettingsSection.tsx"
import { track } from "../../../../lib/analytics.ts"
import { notificationKeys, setRuleAtom } from "../../atoms/notifications.ts"
import { CHANNEL_LABELS, isChangeable, settingsSections, withChannel } from "../../model/notificationText.ts"

const COLUMNS: ReadonlyArray<Channel> = ["inApp", "push", "telegram"]

// Each switch takes a 44 px tap around it, so the columns are easy to hit on a phone.
const HIT_AREA = "after:absolute after:-inset-x-[3px] after:-inset-y-[11px] after:content-['']"

/** Every kind of notification, section by section, with a switch per channel and, for news, the digest. */
export function KindRules({ rules }: Readonly<{ rules: ReadonlyArray<NotificationRule> }>) {
  return (
    <>
      {settingsSections(rules).map((section) => (
        <SettingsSection
          key={section.group}
          title={section.title}
          description={section.description}
          illustration={section.illustration}
          action={
            <div aria-hidden className="hidden gap-4 text-caption-sm font-medium text-g-500 sm:flex">
              {COLUMNS.map((channel) => (
                <span key={channel} className="w-[52px] text-center">{CHANNEL_LABELS[channel]}</span>
              ))}
            </div>
          }
        >
          {section.kinds.map(({ info, rule }) => <KindRow key={info.kind} info={info} rule={rule} />)}
        </SettingsSection>
      ))}
    </>
  )
}

function KindRow({ info, rule }: Readonly<{ info: KindInfo; rule: NotificationRule }>) {
  const setRule = useAtomSet(setRuleAtom, { mode: "promise" })
  const [saving, setSaving] = useState(false)
  const save = async (next: { readonly channels: ReadonlyArray<Channel>; readonly digest: boolean }) => {
    setSaving(true)
    await setRule({ params: { kind: info.kind }, payload: next, reactivityKeys: notificationKeys })
      .then(() => track({ _tag: "settings_changed", setting: "notification_rule" }))
      .finally(() => setSaving(false))
  }

  return (
    <SettingsRow
      title={info.label}
      description={info.locked ? undefined : info.digestable ?
        (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {info.description}
            <span className="inline-flex items-center gap-1.5 text-g-600">
              <Switch
                checked={rule.digest}
                className={HIT_AREA}
                disabled={saving}
                aria-label={`${info.label}: only in the morning digest`}
                onCheckedChange={(digest) => save({ channels: rule.channels, digest })}
              />
              Only in the morning digest
            </span>
          </span>
        ) :
        info.description}
    >
      <div className="flex gap-4">
        {COLUMNS.map((channel) => (
          <span key={channel} className="grid w-[52px] justify-items-center gap-1">
            <span className="text-caption-sm text-g-500 sm:hidden">{CHANNEL_LABELS[channel]}</span>
            <Switch
              checked={rule.channels.includes(channel)}
              className={HIT_AREA}
              disabled={saving || !isChangeable(info, channel)}
              aria-label={`${info.label}: ${CHANNEL_LABELS[channel]}`}
              onCheckedChange={(on) => save(withChannel(rule, channel, on))}
            />
          </span>
        ))}
      </div>
    </SettingsRow>
  )
}
