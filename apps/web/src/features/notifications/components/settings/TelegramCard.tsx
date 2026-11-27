import type { LinkCode } from "@bluechip/domain/channels/Channel"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { CopyButton } from "../../../../components/CopyButton.tsx"
import { SettingsRow, SettingsSection } from "../../../../components/layout/SettingsSection.tsx"
import { channelKeys, channelLinksAtom, linkCodeAtom, unlinkAtom } from "../../atoms/notifications.ts"

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
    <SettingsSection
      title="Telegram"
      description="Talk to the same assistant in Telegram and get your notifications there. Nothing is signed there."
      illustration="plane"
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
              "Open bluechip's bot in Telegram and tap Start."}
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
            {code.deepLink === null ?
              <p className="text-[13.5px] text-g-600">Send this to bluechip's bot in a private chat.</p> :
              (
                <>
                  <p className="text-[13.5px] text-g-600">
                    Open bluechip's bot and tap Start: this chat links itself. The link works once, for 10 minutes.
                  </p>
                  <ButtonLink
                    size="sm"
                    className="justify-self-start"
                    render={<a href={code.deepLink} target="_blank" rel="noreferrer" aria-label="Open Telegram" />}
                  >
                    <Icon name="arrow-up-right" size={14} />Open Telegram
                  </ButtonLink>
                  <p className="text-[13px] text-g-500">
                    Telegram on another device? Send {code.bot ?? "the bot"} this message:
                  </p>
                </>
              )}
            <span className="flex items-center gap-2 justify-self-start">
              <span className="rounded-md bg-g-50 px-3 py-2 font-mono text-[15px] font-semibold tracking-[0.08em] shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]">
                /start {code.code}
              </span>
              <CopyButton text={`/start ${code.code}`} what="the message" size="md" />
            </span>
            <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setCode(null)}>
              Done
            </Button>
          </div>
        )}
    </SettingsSection>
  )
}
