// The panel's Security tab: you, passkeys and devices, recovery, chats and push, notifications, and money in and out,
// each switched live into any state their screens show.
import { KINDS } from "@bluechip/domain/notifications/Kinds"
import type { NotificationKind } from "@bluechip/domain/notifications/Notification"
import { useState } from "react"
import {
  addNotification,
  clearNotifications,
  deposit,
  markAllRead,
  newDeviceSignsIn,
  type PasskeysState,
  passkeysState,
  type PushState,
  pushState,
  type RecoveryState,
  recoveryState,
  setDeployed,
  setDevices,
  setDisplayName,
  setEligibility,
  setPasskeys,
  setPush,
  setQuietHours,
  setRecovery,
  setTelegram,
  withdrawal
} from "../actions/account.ts"
import { Act, Group, Pick, Row, Segmented, usePreview } from "../controls.tsx"

const RECOVERY_OPTIONS: ReadonlyArray<{ readonly value: RecoveryState; readonly label: string }> = [
  { value: "none", label: "No recovery key" },
  { value: "locking", label: "Recovery key being locked" },
  { value: "key", label: "Recovery key ready" },
  { value: "waiting", label: "Recovery asked for, 34 hours left" },
  { value: "due", label: "Recovery due (can be made now)" },
  { value: "cancelled", label: "Recovery cancelled from Telegram" },
  { value: "completed", label: "Recovery made (recover page)" }
]

const KIND_OPTIONS = KINDS.map((info) => ({
  value: info.kind,
  label: `${info.group.charAt(0).toUpperCase()}${info.group.slice(1)}: ${info.label}`
}))

export function AccountSection() {
  const store = usePreview()
  const account = store.world.account
  const [kind, setKind] = useState<NotificationKind>("approvalNeeded")
  const unread = account.notifications.filter((notification) => notification.readAt === null).length
  const pending = account.transfers.some((transfer) => transfer.kind === "withdrawal" && transfer.status === "pending")

  return (
    <>
      <Group title="You">
        <Row label="Display name">
          <Segmented<"set" | "unset">
            value={account.user.displayName === null ? "unset" : "set"}
            options={[{ value: "set", label: "Set" }, { value: "unset", label: "Not set" }]}
            onChange={(value) =>
              store.act(setDisplayName(value === "set" ? (store.cast.displayName ?? "Robin") : null))}
          />
        </Row>
        <Row label="Where you live (stocks are for non-US persons)">
          <Segmented
            value={account.user.eligibility}
            options={[
              { value: "outsideUs", label: "Outside the US" },
              { value: "us", label: "In the US" },
              { value: "unknown", label: "Not answered" }
            ]}
            onChange={(value) => store.act(setEligibility(value))}
          />
        </Row>
        <Row label="Account on Base">
          <Segmented<"yes" | "no">
            value={account.deployed ? "yes" : "no"}
            options={[{ value: "yes", label: "Deployed" }, { value: "no", label: "First signature deploys it" }]}
            onChange={(value) => store.act(setDeployed(value === "yes"))}
          />
        </Row>
      </Group>

      <Group title="Passkeys and devices" hint="Changes you sign in the app land on Base 3 s later.">
        <Row label="Passkeys">
          <Segmented<PasskeysState>
            value={passkeysState(account)}
            options={[
              { value: "one", label: "Only this one" },
              { value: "several", label: "Four" },
              { value: "adding", label: "One being added" },
              { value: "removing", label: "One being removed" }
            ]}
            onChange={(value) => store.act(setPasskeys(value))}
          />
        </Row>
        <Row label={`Devices signed in (${account.devices.length})`}>
          <Segmented<"one" | "several">
            value={account.devices.length <= 1 ? "one" : "several"}
            options={[{ value: "one", label: "This one" }, { value: "several", label: "Five" }]}
            onChange={(value) => store.act(setDevices(value))}
          />
          <div className="flex flex-wrap gap-2">
            <Act onClick={() => store.act(newDeviceSignsIn())}>A new device signs in</Act>
          </div>
        </Row>
      </Group>

      <Group title="Recovery" hint="What Settings > Security and the recover page show.">
        <Pick<RecoveryState>
          label="Recovery"
          value={recoveryState(account)}
          options={RECOVERY_OPTIONS}
          onChange={(value) => store.act(setRecovery(value))}
        />
      </Group>

      <Group title="Chats and push" hint="Push and quiet hours show on the next visit to Notifications settings.">
        <Row label="Telegram">
          <Segmented<"linked" | "unlinked">
            value={account.links.length > 0 ? "linked" : "unlinked"}
            options={[{ value: "linked", label: "Linked" }, { value: "unlinked", label: "Not linked" }]}
            onChange={(value) => store.act(setTelegram(value === "linked"))}
          />
        </Row>
        <Row label="Push">
          <Segmented<PushState>
            value={pushState(account)}
            options={[
              { value: "unavailable", label: "Not set up" },
              { value: "none", label: "No others" },
              { value: "one", label: "1 other" },
              { value: "two", label: "2 others" }
            ]}
            onChange={(value) => store.act(setPush(value))}
          />
        </Row>
        <Row label="Quiet hours">
          <Segmented<"on" | "off">
            value={account.quietHours === null ? "off" : "on"}
            options={[{ value: "on", label: "22:00 to 07:00" }, { value: "off", label: "Off" }]}
            onChange={(value) => store.act(setQuietHours(value === "on"))}
          />
        </Row>
      </Group>

      <Group title="Notifications" hint={`${account.notifications.length} in the center, ${unread} unread.`}>
        <Pick<NotificationKind> label="Kind" value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <div className="flex flex-wrap gap-2">
          <Act onClick={() => store.act(addNotification(kind, false))}>Add unread</Act>
          <Act onClick={() => store.act(addNotification(kind, true))}>Add read</Act>
          <Act onClick={() => store.act(markAllRead())}>Mark all read</Act>
          <Act tone="danger" onClick={() => store.act(clearNotifications())}>Clear all</Act>
        </div>
      </Group>

      <Group
        title="Money in and out"
        hint={pending ? "A withdrawal is on its way." : "No withdrawal on its way."}
      >
        <Row label="Withdrawal">
          <div className="flex flex-wrap gap-2">
            <Act onClick={() => store.act(withdrawal("pending"))}>Send $250</Act>
            <Act onClick={() => store.act(withdrawal("confirmed"))}>It lands</Act>
            <Act tone="danger" onClick={() => store.act(withdrawal("failed"))}>It fails</Act>
          </div>
        </Row>
        <Row label="Deposit">
          <div className="flex flex-wrap gap-2">
            <Act onClick={() => store.act(deposit(500))}>$500 arrives</Act>
            <Act onClick={() => store.act(deposit(5_000))}>$5,000 arrives</Act>
          </div>
        </Row>
      </Group>
    </>
  )
}
