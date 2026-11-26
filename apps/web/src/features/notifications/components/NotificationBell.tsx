import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@bluechip/ui/components/popover"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import {
  notificationKeys,
  notificationsAtom,
  readAllNotificationsAtom,
  readNotificationAtom,
  unreadCountAtom
} from "../atoms/notifications.ts"
import { NotificationRow } from "./NotificationRow.tsx"

/**
 * The bell in every page's top bar: how many notifications you haven't read, and the latest in a popover. Opening one
 * reads it and goes to its page.
 */
export function NotificationBell() {
  const unread = useAtomValue(unreadCountAtom)
  const count = AsyncResult.isSuccess(unread) ? unread.value.count : 0
  const notifications = useAtomValue(notificationsAtom)
  const read = useAtomSet(readNotificationAtom, { mode: "promise" })
  const readAll = useAtomSet(readAllNotificationsAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const items = AsyncResult.isSuccess(notifications) ? notifications.value.items : []
  const now = DateTime.nowUnsafe()

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
              className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-blue px-[5px] text-caption-sm font-semibold text-white tabular-nums"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] gap-1 p-2">
        <div className="flex items-center justify-between gap-2 px-2.5 pt-1.5 pb-1">
          <PopoverTitle>Notifications</PopoverTitle>
          {count === 0 ?
            null :
            (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => readAll({ reactivityKeys: notificationKeys })}
              >
                Mark all read
              </Button>
            )}
        </div>
        {items.length === 0 ?
          (
            <Empty size="sm" className="py-6">
              <EmptyMedia>
                <Icon name="bell" size={18} />
              </EmptyMedia>
              <EmptyTitle>Nothing new</EmptyTitle>
              <EmptyDescription>Trades, approvals and your agents' news show up here.</EmptyDescription>
            </Empty>
          ) :
          (
            <div className="grid max-h-[min(440px,60vh)] gap-0.5 overflow-y-auto">
              {items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  now={now}
                  onOpen={async () => {
                    setOpen(false)
                    if (notification.readAt === null) {
                      await read({ params: { id: notification.id }, reactivityKeys: notificationKeys })
                    }
                    if (notification.link !== null) await navigate({ href: notification.link })
                  }}
                />
              ))}
            </div>
          )}
        <div className="border-t border-g-100 px-1 pt-1.5">
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
