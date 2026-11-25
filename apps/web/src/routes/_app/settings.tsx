import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { Button } from "@bluechip/ui/components/button"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ReactNode, useState } from "react"
import { accountReactivityKey, meAtom, passkeysAtom, signOutAtom } from "../../atoms/account.ts"
import { AppPage } from "../../shell/AppPage.tsx"

export const Route = createFileRoute("/_app/settings")({ component: Settings })

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

function Settings() {
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
              title={passkey.label ?? "Passkey"}
              description={`Added ${formatDate(passkey.createdAt)}${
                passkey.lastUsedAt === null ? "" : ` · last used ${formatDate(passkey.lastUsedAt)}`
              }`}
            />
          )) :
          null}
      </Section>
    </AppPage>
  )
}
