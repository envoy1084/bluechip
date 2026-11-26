import type { KindInfo } from "@bluechip/domain/notifications/Kinds"
import type { Channel, NotificationRule } from "@bluechip/domain/notifications/Notification"
import { Switch } from "@bluechip/ui/components/switch"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { notificationKeys, setRuleAtom } from "../../atoms/notifications.ts"
import { CHANNEL_LABELS, isChangeable, settingsSections, withChannel } from "../../model/notificationText.ts"
import { SettingsCard, SettingsRow } from "./SettingsCard.tsx"

const COLUMNS: ReadonlyArray<Channel> = ["inApp", "push", "telegram"]

/** Every kind of notification, section by section, with a switch per channel and, for news, the digest. */
export function KindRules({ rules }: Readonly<{ rules: ReadonlyArray<NotificationRule> }>) {
  return (
    <>
      {settingsSections(rules).map((section) => (
        <SettingsCard
          key={section.group}
          title={section.title}
          description={section.description}
          illustration={section.illustration}
          aside={
            <div aria-hidden className="hidden gap-4 text-caption-sm font-medium text-g-500 sm:flex">
              {COLUMNS.map((channel) => (
                <span key={channel} className="w-[52px] text-center">{CHANNEL_LABELS[channel]}</span>
              ))}
            </div>
          }
        >
          {section.kinds.map(({ info, rule }) => <KindRow key={info.kind} info={info} rule={rule} />)}
        </SettingsCard>
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
      .finally(() => setSaving(false))
  }

  return (
    <SettingsRow
      title={info.label}
      description={info.digestable ?
        (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {info.description}
            <span className="inline-flex items-center gap-1.5 text-g-600">
              <Switch
                size="sm"
                checked={rule.digest}
                disabled={saving}
                aria-label={`${info.label}: hold for the daily digest`}
                onCheckedChange={(digest) => save({ channels: rule.channels, digest })}
              />
              Hold for the digest
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
              size="sm"
              checked={rule.channels.includes(channel)}
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
