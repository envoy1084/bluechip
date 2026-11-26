// The mock API's account groups: account, sign-in and test money (`account/account.ts`), recovery from both sides
// (`account/recovery.ts`), notifications, push and chats (`account/notifications.ts`), and the audit log and
// transfers (`account/history.ts`), every endpoint answering from the preview world.
import * as Layer from "effect/Layer"
import { AccountAuthGroupsLive } from "./account/account.ts"
import { HistoryGroupsLive } from "./account/history.ts"
import { NotificationGroupsLive } from "./account/notifications.ts"
import { RecoveryGroupsLive } from "./account/recovery.ts"

export const AccountGroupsLive = Layer.mergeAll(
  AccountAuthGroupsLive,
  RecoveryGroupsLive,
  NotificationGroupsLive,
  HistoryGroupsLive
)
