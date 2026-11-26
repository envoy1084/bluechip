import type { LinkCode } from "@bluechip/domain/channels/Channel"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { channelKeys, channelLinksAtom, linkCodeAtom, unlinkAtom } from "../../atoms/notifications.ts"
import { SettingsCard, SettingsRow } from "./SettingsCard.tsx"

const formatDay = (date: DateTime.Utc) =>
  DateTime.toDateUtc(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

/**
 * Telegram: the linked chats (unlink any), and linking one with a one-time code sent to the bot. Linking and
 * unlinking are security notifications on every channel.
 */
export function TelegramCard() {
  const links = useAtomValue(channelLinksAtom)
  const makeCode = useAtomSet(linkCodeAtom, { mode: "promise" })
  const unlink = useAtomSet(unlinkAtom, { mode: "promise" })
  const [made, setCode] = useState<LinkCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const linked = AsyncResult.isSuccess(links) ? links.value.filter((link) => link.platform === "telegram") : []

  // A chat linked with the code (the live event refetches the list) ends the code's panel.
  const count = linked.length
  const [countAtCode, setCountAtCode] = useState(0)
  const code = made !== null && count <= countAtCode ? made : null

  return (
    <SettingsCard
      title="Telegram"
      description="Talk to the same assistant in Telegram and get your notifications there. Nothing is signed there."
    >
      {linked.map((link) => (
        <SettingsRow
          key={link.id}
          title={link.name === null ? "A Telegram chat" : `Telegram (${link.name})`}
          description={`Linked on ${formatDay(link.linkedAt)}.`}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => unlink({ params: { id: link.id }, reactivityKeys: channelKeys })}
          >
            Unlink
          </Button>
        </SettingsRow>
      ))}
      {code === null ?
        (
          <SettingsRow
            title={linked.length === 0 ? "Link Telegram" : "Link another chat"}
            description={failed ?
              "We couldn't reach bluechip just now. Try again." :
              "You get a code to send to bluechip's bot in a private chat."}
          >
            <Button
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                setFailed(false)
                await makeCode({ params: { platform: "telegram" } }).then(
                  (made) => {
                    setCountAtCode(count)
                    setCode(made)
                  },
                  () => setFailed(true)
                ).finally(() => setBusy(false))
              }}
            >
              <Icon name="link" size={14} />Link Telegram
            </Button>
          </SettingsRow>
        ) :
        (
          <div className="grid gap-3 py-4" data-testid="link-code">
            <p className="text-[13.5px] text-g-600">
              {code.bot === null ?
                "Send this code to bluechip's bot in a private chat." :
                `Send this code to ${code.bot} in a private chat. It works once, for 10 minutes.`}
            </p>
            <span className="justify-self-start rounded-md bg-g-50 px-4 py-2.5 font-mono text-[22px] font-semibold tracking-[0.18em] shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]">
              {code.code}
            </span>
            <div className="flex flex-wrap gap-2">
              {code.deepLink === null ?
                null :
                (
                  <ButtonLink
                    size="sm"
                    render={<a href={code.deepLink} target="_blank" rel="noreferrer" aria-label="Open Telegram" />}
                  >
                    Open Telegram
                  </ButtonLink>
                )}
              <Button variant="ghost" size="sm" onClick={() => setCode(null)}>Done</Button>
            </div>
          </div>
        )}
    </SettingsCard>
  )
}
