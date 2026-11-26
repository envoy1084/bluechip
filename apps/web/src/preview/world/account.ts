// The preview world's account slice: who you are, the passkeys that own the account and the one that may recover it,
// the devices and chats that reach you, your notifications and where they go, the audit log, and your deposits and
// withdrawals. The mock API and the panel change it in place.
import type { Device, Passkey, User } from "@bluechip/domain/Account"
import type { AuditEvent } from "@bluechip/domain/audit/Audit"
import type { ChannelLink } from "@bluechip/domain/channels/Channel"
import type { Address, PasskeyId, RecoveryRequestId } from "@bluechip/domain/Ids"
import type { Usdc } from "@bluechip/domain/market/Units"
import type { Channel, Notification, NotificationKind, QuietHours } from "@bluechip/domain/notifications/Notification"
import type { Transfer } from "@bluechip/domain/portfolio/Transfer"
import type { PushDevice } from "@bluechip/domain/push/Push"
import type { RecoveryKey, RecoveryRequest } from "@bluechip/domain/recovery/Recovery"
import { makeAudit, makeTransfers } from "./account/history.ts"
import { makeNotifications } from "./account/notifications.ts"
import { makeSecurity, PUSH_PUBLIC_KEY } from "./account/security.ts"
import type { Cast } from "./cast.ts"

/** A change prepared for a passkey to sign, kept until it is confirmed. */
export type Signing =
  | { readonly _tag: "AddPasskey"; readonly passkey: Passkey }
  | { readonly _tag: "RemovePasskey"; readonly passkeyId: PasskeyId }
  | { readonly _tag: "SetUpKey"; readonly key: RecoveryKey }
  | { readonly _tag: "RemoveKey" }
  | { readonly _tag: "AskRecovery"; readonly id: RecoveryRequestId; readonly newPasskey: string }
  | { readonly _tag: "MakeRecovery" }
  | { readonly _tag: "Withdraw"; readonly amount: Usdc; readonly to: Address }

export interface AccountSlice {
  user: User
  /** Whether the account is onchain yet: it is deployed with its first transaction. */
  deployed: boolean
  /** The owner passkeys, oldest first, with those on their way in or out. */
  passkeys: Array<Passkey>
  /** The browsers signed in, the current one first. */
  devices: Array<Device>
  recoveryKey: RecoveryKey | null
  /** The latest recovery, as both its owner and the person recovering see it. */
  recovery: RecoveryRequest | null
  /** The server's VAPID key: `null` when push isn't set up. */
  pushKey: string | null
  pushDevices: Array<PushDevice>
  links: Array<ChannelLink>
  /** The rules saved for a kind; the others follow the kind's defaults. */
  rules: Map<NotificationKind, { readonly channels: ReadonlyArray<Channel>; readonly digest: boolean }>
  quietHours: QuietHours | null
  /** Newest first. */
  notifications: Array<Notification>
  /** Newest first. */
  audit: Array<AuditEvent>
  /** Newest first. */
  transfers: Array<Transfer>
  /** Changes prepared for a passkey to sign, by their signing request's id. */
  signing: Map<string, Signing>
  /** The number of the next made-up id, for the records made while the tab is open. */
  nextId: number
}

export const makeAccount = (cast: Cast, now: Date): AccountSlice => {
  const security = makeSecurity(cast, now)

  return {
    user: security.user,
    deployed: cast.scenario !== "newPerson",
    passkeys: security.passkeys,
    devices: security.devices,
    recoveryKey: security.recoveryKey,
    recovery: security.recovery,
    pushKey: PUSH_PUBLIC_KEY,
    pushDevices: security.pushDevices,
    links: security.links,
    rules: new Map(
      cast.scenario === "heavy" ?
        [
          ["intentFilled", { channels: ["inApp", "push", "telegram"], digest: false }],
          ["automationFired", { channels: ["inApp"], digest: true }],
          ["sessionRenewed", { channels: ["inApp", "telegram"], digest: false }]
        ] :
        cast.scenario === "typical" ?
        [["intentFilled", { channels: ["inApp", "push"], digest: false }]] :
        []
    ),
    quietHours: cast.scenario === "heavy" ? { from: "22:00", to: "07:00" } : null,
    notifications: makeNotifications(cast, now),
    audit: makeAudit(cast, now, security),
    transfers: makeTransfers(cast, now),
    signing: new Map(),
    nextId: 10_000
  }
}
