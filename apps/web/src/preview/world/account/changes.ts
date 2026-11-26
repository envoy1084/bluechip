// Changes to the account slice that the mock API and the panel both make: a notification told, an entry in the audit
// log, and the live events that tell the app.
import { LiveEvent } from "@bluechip/domain/Events"
import { notificationOfTransfer } from "@bluechip/domain/notifications/Drafts"
import type { NotificationDraft } from "@bluechip/domain/notifications/Notification"
import { notificationOfRecovery } from "@bluechip/domain/notifications/SecurityDrafts"
import { Transfer } from "@bluechip/domain/portfolio/Transfer"
import { type CancelledFrom, RecoveryRequest } from "@bluechip/domain/recovery/Recovery"
import * as DateTime from "effect/DateTime"
import type { AccountSlice } from "../account.ts"
import { type AuditEntry, auditOf, txHashOf } from "./history.ts"
import { notificationOf, stockName } from "./notifications.ts"

/** The next number for a made-up id. */
export const nextNumber = (account: AccountSlice): number => account.nextId++

/** Tells you `draft` now: stores it first in the center and returns the live event the server would send. */
export const notify = (account: AccountSlice, draft: NotificationDraft, read = false): LiveEvent => {
  const now = DateTime.nowUnsafe()
  const notification = notificationOf(draft, nextNumber(account), now, read ? now : null)
  account.notifications.unshift(notification)
  return LiveEvent.cases.NotificationAdded.make({ notification })
}

/** Writes `entry` to the audit log, now. */
export const record = (account: AccountSlice, entry: Omit<AuditEntry, "at" | "actorId" | "agentId">) => {
  account.audit.unshift(
    auditOf({ actorId: null, agentId: null, ...entry, at: DateTime.nowUnsafe() }, nextNumber(account))
  )
}

/** The passkeys, devices or recovery changed. */
export const accountChanged = (): LiveEvent => LiveEvent.cases.AccountChanged.make({})

/** The balances changed. */
export const portfolioChanged = (): LiveEvent => LiveEvent.cases.PortfolioChanged.make({})

/** Cancels the open recovery, from a signed-in device or Telegram: logged, told, and the account refetched. */
export const cancelRecovery = (account: AccountSlice, from: CancelledFrom): ReadonlyArray<LiveEvent> => {
  const request = new RecoveryRequest({
    ...account.recovery!,
    status: "cancelled",
    cancelledAt: DateTime.nowUnsafe(),
    cancelledFrom: from
  })
  account.recovery = request
  record(account, {
    actor: "owner",
    action: "recovery.cancelled",
    subjectType: "recovery",
    subjectId: request.id,
    data: { from }
  })
  return [accountChanged(), notify(account, notificationOfRecovery(request, { _tag: "Cancelled", from }))]
}

/** A withdrawal on its way reaching the end Base gives it: its status, told, and the portfolio refetched. */
export const settleWithdrawal = (
  account: AccountSlice,
  id: Transfer["id"],
  status: "confirmed" | "failed"
): ReadonlyArray<LiveEvent> => {
  const pending = account.transfers.find((transfer) => transfer.id === id)
  if (pending?.status !== "pending") return []

  const settled = new Transfer({
    ...pending,
    status,
    txHash: status === "confirmed" ? txHashOf(nextNumber(account)) : null
  })
  account.transfers = account.transfers.map((transfer) => transfer.id === id ? settled : transfer)
  return [
    LiveEvent.cases.TransferUpdated.make({ transfer: settled }),
    portfolioChanged(),
    notify(account, notificationOfTransfer(settled, stockName)!)
  ]
}
