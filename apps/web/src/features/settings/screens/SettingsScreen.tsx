import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ReactNode, useState } from "react"
import { meAtom } from "../../../atoms/account.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { usePauseAll } from "../../../hooks/usePauseAll.ts"
import { accountReactivityKey } from "../../../lib/api/client.ts"
import { passkeysAtom, setDisplayNameAtom, signOutAtom } from "../atoms/settings.ts"

const formatDate = (date: DateTime.Utc) =>
  DateTime.toDateUtc(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

function Section(
  { title, description, children }: Readonly<{ title: string; description: string; children: ReactNode }>
) {
  return (
    <section className="rounded-lg bg-white px-[22px] pt-0.5 pb-1 shadow-e2">
      <div className="grid gap-1 border-b border-g-100 pt-[18px] pb-3.5">
        <h3 className="text-base font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="text-[13.5px] text-g-600">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Row(
  { title, description, icon, children }: Readonly<
    { title: ReactNode; description: ReactNode; icon?: IconName; children?: ReactNode }
  >
) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-g-100 py-3.5 last:border-b-0">
      <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3">
        {icon === undefined ?
          null :
          (
            <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(180deg,#fff,#f1f3f6)] text-g-600 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08)]">
              <Icon name={icon} size={18} />
            </span>
          )}
        <div className="grid min-w-0 gap-0.5">
          <b className="inline-flex items-center gap-2 text-sm font-semibold">{title}</b>
          <span className="text-[13px] text-g-500">{description}</span>
        </div>
      </div>
      {children}
    </div>
  )
}

export function SettingsScreen() {
  const me = useAtomValue(meAtom)
  const passkeys = useAtomValue(passkeysAtom)
  const signOut = useAtomSet(signOutAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  if (!AsyncResult.isSuccess(me)) return null
  const { account } = me.value
  return (
    <AppPage title="Settings">
      <Section title="Account" description="Your bluechip account lives on Base. Only your Face ID can move money out.">
        <NameRow saved={me.value.user.displayName} />
        <Row title="Address" description="Send USDC on Base here to add cash.">
          <AddressChip address={account.address} />
        </Row>
        <Row title="Eligibility" description="You confirmed you live outside the United States.">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gain-wash py-[3px] pr-[9px] pl-[7px] text-[12.5px] font-medium text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]">
            <i className="size-1.5 rounded-full bg-current" />Confirmed
          </span>
        </Row>
        <Row
          title="Sign out"
          description="Signs this browser out. Your agents keep working inside their limits."
        >
          <Button
            variant="secondary"
            size="sm"
            loading={signingOut}
            onClick={async () => {
              setSigningOut(true)
              await signOut({ reactivityKeys: [accountReactivityKey] }).finally(() => setSigningOut(false))
              await navigate({ to: "/signin" })
            }}
          >
            <Icon name="logout" size={14} />Sign out
          </Button>
        </Row>
      </Section>
      <Section
        title="Passkeys and devices"
        description="Each device signs in with its own Face ID or fingerprint. Remove a device you lost."
      >
        {AsyncResult.isSuccess(passkeys) ?
          passkeys.value.map((passkey) => (
            <Row
              key={passkey.id}
              icon="face-id"
              title={
                <>
                  {passkey.label ?? "Passkey"}
                  {passkey.current ?
                    (
                      <span className="rounded-full bg-g-100 px-2 py-0.5 text-[11.5px] font-semibold text-g-600">
                        This device
                      </span>
                    ) :
                    null}
                </>
              }
              description={[
                passkey.synced ? "Synced to your other devices" : "On this device only",
                `added ${formatDate(passkey.createdAt)}`,
                passkey.lastUsedAt === null ? null : `last used ${formatDate(passkey.lastUsedAt)}`
              ].filter((part) => part !== null).join(", ")}
            />
          )) :
          null}
      </Section>
      <Section title="Notifications" description="What bluechip tells you, in the app, as push and in Telegram.">
        <Row
          title="Notifications"
          description="Each kind and where it goes, quiet hours, push and Telegram."
          icon="bell"
        >
          <ButtonLink variant="secondary" size="sm" render={<Link to="/settings/notifications" />}>
            Notification settings
          </ButtonLink>
        </Row>
      </Section>
      <Section title="Assistant" description="What the assistant knows about you is yours to see and delete.">
        <Row title="Memory" description="Preferences, rules, goals and facts it uses to answer you." icon="book">
          <ButtonLink variant="secondary" size="sm" render={<Link to="/memory" />}>
            See memories
          </ButtonLink>
        </Row>
      </Section>
      <AgentsSection />
    </AppPage>
  )
}

/** The kill switch over every agent, once there is one to pause. */
function AgentsSection() {
  const { shown, allPaused, busy, failed, toggle } = usePauseAll()
  if (!shown) return null

  return (
    <Section title="Danger zone" description="These act on every agent at once.">
      <Row
        title="Pause all agents"
        description={failed ?
          "We couldn't reach bluechip just now. Try again." :
          allPaused ?
          "Every agent is paused. None of them can trade until you resume them." :
          "They stop right away. Nothing is sold. Resume them any time."}
      >
        <Button variant={allPaused ? "secondary" : "danger"} size="sm" loading={busy} onClick={() => void toggle()}>
          <Icon name={allPaused ? "play" : "pause"} size={14} />
          {allPaused ? "Resume all" : "Pause all"}
        </Button>
      </Row>
    </Section>
  )
}

/** The optional name bluechip greets you by; saved when it changes. */
function NameRow({ saved }: Readonly<{ saved: string | null }>) {
  const setDisplayName = useAtomSet(setDisplayNameAtom, { mode: "promise" })
  const [name, setName] = useState(saved ?? "")
  const [saving, setSaving] = useState(false)
  const changed = name.trim() !== (saved ?? "")
  const save = async () => {
    setSaving(true)
    await setDisplayName({
      payload: { displayName: name.trim() === "" ? null : name.trim() },
      reactivityKeys: [accountReactivityKey]
    })
      .finally(() => setSaving(false))
  }
  return (
    <Row title="Your name" description="Optional. bluechip greets you by it.">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (changed) void save()
        }}
      >
        <Input
          aria-label="Your name"
          value={name}
          maxLength={64}
          placeholder="Add your name"
          onChange={(event) => setName(event.target.value)}
          className="w-48"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={!changed} loading={saving}>Save</Button>
      </form>
    </Row>
  )
}
