import type { Notification } from "@bluechip/domain/notifications/Notification"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type * as DateTime from "effect/DateTime"
import { timeAgo } from "../model/notificationText.ts"

const ICONS: Readonly<Record<Notification["severity"], IconName>> = {
  info: "bell",
  important: "approvals",
  security: "shield"
}

/** One notification in the bell's list: its title, sentence and time, unread ones marked with a dot. */
export function NotificationRow(
  { notification, now, onOpen }: Readonly<{ notification: Notification; now: DateTime.Utc; onOpen: () => void }>
) {
  const unread = notification.readAt === null
  return (
    <button
      type="button"
      data-testid="notification"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors duration-fast hover:bg-g-50 focus-visible:bg-g-50 focus-visible:outline-none"
    >
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          notification.severity === "security" ? "bg-loss-wash text-loss" : "bg-blue-50 text-blue"
        )}
      >
        <Icon name={ICONS[notification.severity]} size={15} />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <b className={cn("text-[13.5px] leading-snug", unread ? "font-semibold" : "font-medium text-g-700")}>
          {notification.title}
        </b>
        <span className="text-[12.5px] leading-snug text-g-500">{notification.body}</span>
        <span className="text-caption-sm text-g-400">{timeAgo(notification.createdAt, now)}</span>
      </span>
      {unread ? <i aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-blue" /> : null}
    </button>
  )
}
