import type { NotificationAction } from "@bluechip/domain/notifications/Actions"
import { type KindGroup, kindOf } from "@bluechip/domain/notifications/Kinds"
import type { Notification } from "@bluechip/domain/notifications/Notification"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import * as DateTime from "effect/DateTime"
import { notificationTime } from "../model/notificationText.ts"
import { NotificationActions } from "./NotificationActions.tsx"

const ICONS: Readonly<Record<KindGroup, IconName>> = {
  trades: "receipt",
  agents: "agents",
  automations: "zap",
  money: "wallet",
  security: "shield",
  digest: "sun"
}

const isApproval = (notification: Notification) =>
  notification.kind === "approvalNeeded" || notification.kind === "approvalExpiring"

/**
 * One notification in the bell's panel: an icon for what it is about, its title, sentence and time in your zone,
 * unread ones tinted with a dot, and what it still lets you do right here.
 */
export function NotificationRow(
  { notification, now, live, onOpen, onReview }: Readonly<{
    notification: Notification
    now: DateTime.Utc
    live: ReadonlySet<NotificationAction>
    onOpen: () => void
    onReview: () => void
  }>
) {
  const unread = notification.readAt === null
  const security = notification.severity === "security"
  return (
    <li className={cn("relative rounded-md transition-colors duration-fast", unread && "bg-blue-50/60")}>
      <button
        type="button"
        data-testid="notification"
        onClick={onOpen}
        className="flex w-full items-start gap-3 rounded-md px-3 pt-2.5 pb-2.5 text-left transition-colors duration-fast hover:bg-g-50 focus-visible:bg-g-50 focus-visible:outline-none"
      >
        <span
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
            security ? "bg-loss-wash text-loss" : "bg-white text-blue shadow-e1"
          )}
        >
          <Icon name={isApproval(notification) ? "approvals" : ICONS[kindOf(notification.kind).group]} size={15} />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-baseline justify-between gap-3">
            <b className={cn("text-label leading-snug", unread ? "font-semibold" : "font-medium text-g-700")}>
              {notification.title}
            </b>
            <time
              dateTime={DateTime.formatIso(notification.createdAt)}
              className="shrink-0 text-caption-sm whitespace-nowrap text-g-400 tabular-nums"
            >
              {notificationTime(notification.createdAt, now)}
            </time>
          </span>
          <span className="text-label-sm leading-snug text-g-500">{notification.body}</span>
        </span>
        {unread ? <i aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-blue" /> : null}
      </button>
      <div className="pr-3 pb-2.5 pl-[56px] empty:hidden">
        <NotificationActions kind={notification.kind} live={live} onReview={onReview} />
      </div>
    </li>
  )
}
