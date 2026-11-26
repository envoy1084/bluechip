import type { NotificationAction } from "@bluechip/domain/notifications/Actions"
import { isOpen } from "@bluechip/domain/recovery/Recovery"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@bluechip/ui/components/popover"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useRef, useState } from "react"
import { approvalsAtom } from "../../../atoms/approvals.ts"
import { accountRecoveryAtom } from "../../../atoms/recovery.ts"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { usePauseAll } from "../../../hooks/usePauseAll.ts"
import {
  notificationKeys,
  notificationsAtom,
  readAllNotificationsAtom,
  readNotificationAtom,
  unreadCountAtom
} from "../atoms/notifications.ts"
import { notificationDays } from "../model/notificationText.ts"
import { NotificationRow } from "./NotificationRow.tsx"

/** The actions still worth offering: approvals waiting, an agent left to pause, a recovery going. */
function useLiveActions(): ReadonlySet<NotificationAction> {
  const approvals = useAtomValue(approvalsAtom)
  const recovery = useAtomValue(accountRecoveryAtom)
  const { shown, allPaused } = usePauseAll()
  const live = new Set<NotificationAction>()
  if (AsyncResult.isSuccess(approvals) && approvals.value.length > 0) live.add("review")
  if (shown && !allPaused) live.add("pauseAll")
  if (AsyncResult.isSuccess(recovery) && recovery.value.request !== null && isOpen(recovery.value.request)) {
    live.add("cancelRecovery")
  }
  return live
}

/**
 * The bell in every page's top bar, with how many you haven't read. Its panel lists the latest, today's then earlier,
 * unread ones marked; opening one reads it and goes to its page (an approval opens the approvals sheet, `onReview`,
 * where you are). Mark all read, and a link to notification settings.
 */
export function NotificationBell({ onReview }: Readonly<{ onReview: () => void }>) {
  const unread = useAtomValue(unreadCountAtom)
  const count = AsyncResult.isSuccess(unread) ? unread.value.count : 0
  const notifications = useAtomValue(notificationsAtom)
  const refresh = useAtomRefresh(notificationsAtom)
  const read = useAtomSet(readNotificationAtom, { mode: "promise" })
  const readAll = useAtomSet(readAllNotificationsAtom, { mode: "promise" })
  const live = useLiveActions()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  const now = DateTime.nowUnsafe()

  const review = () => {
    setOpen(false)
    onReview()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={count === 0 ? "Notifications" : `Notifications, ${count} unread`}
          />
        }
      >
        <Icon name="bell" size={16} />
        {count === 0 ?
          null :
          (
            <span
              data-testid="notification-badge"
              className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-blue px-[5px] text-caption-sm font-semibold text-white tabular-nums ring-2 ring-canvas"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
      </PopoverTrigger>
      <PopoverContent align="end" initialFocus={title} className="w-[400px] gap-0 overflow-hidden p-0">
        <div className="flex min-h-[52px] items-center justify-between gap-2 border-b border-g-100 py-2 pr-2 pl-4">
          <div className="grid">
            <PopoverTitle ref={title} tabIndex={-1} className="outline-none">Notifications</PopoverTitle>
            <span className="text-caption text-g-500">
              {count === 0 ? "You're all caught up" : `${count} unread`}
            </span>
          </div>
          {count === 0 ?
            null :
            (
              <Button variant="ghost" size="xs" onClick={() => readAll({ reactivityKeys: notificationKeys })}>
                <Icon name="check" size={12} />Mark all read
              </Button>
            )}
        </div>

        <div className="max-h-[min(480px,65vh)] overflow-y-auto p-1.5">
          {AsyncResult.isInitial(notifications) ?
            (
              <div aria-busy className="grid gap-1.5 p-1.5">
                <SkeletonBlock className="h-14 w-full" />
                <SkeletonBlock className="h-14 w-full" />
              </div>
            ) :
            !AsyncResult.isSuccess(notifications) ?
            <LoadProblem what="your notifications" onRetry={refresh} size="sm" /> :
            notifications.value.items.length === 0 ?
            (
              <IllustratedEmpty illustration="bell" size={88} variant="plain" compact title="Nothing yet">
                Trades, approvals, your agents' news and account safety show up here.
              </IllustratedEmpty>
            ) :
            notificationDays(notifications.value.items, now).map((day) => (
              <section key={day.title} aria-label={day.title} className="grid gap-0.5 pb-1">
                <h3 className="px-3 pt-2 pb-1 text-caption font-semibold text-g-500">{day.title}</h3>
                <ul className="grid gap-0.5">
                  {day.notifications.map((notification) => {
                    const markRead = () =>
                      notification.readAt === null ?
                        read({ params: { id: notification.id }, reactivityKeys: notificationKeys }) :
                        Promise.resolve()
                    const approval = notification.kind === "approvalNeeded" || notification.kind === "approvalExpiring"
                    return (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        now={now}
                        live={live}
                        onReview={() => {
                          review()
                          void markRead()
                        }}
                        onOpen={async () => {
                          setOpen(false)
                          await markRead()
                          // An approval still waiting opens where you are; one already handled shows its page.
                          if (approval && live.has("review")) return onReview()
                          if (notification.link !== null) {
                            await navigate({ href: notification.link })
                          }
                        }}
                      />
                    )
                  })}
                </ul>
              </section>
            ))}
        </div>

        <div className="border-t border-g-100 p-1.5">
          <ButtonLink
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            render={<Link to="/settings/notifications" onClick={() => setOpen(false)} />}
          >
            <Icon name="settings" size={14} />Notification settings
          </ButtonLink>
        </div>
      </PopoverContent>
    </Popover>
  )
}
