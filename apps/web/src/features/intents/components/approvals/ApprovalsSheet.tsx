import { Button, ButtonLink } from "@bluechip/ui/components/button"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@bluechip/ui/components/sheet"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { useApprovalCount } from "../../hooks/useApprovalCount.ts"
import { waitingText } from "../../model/intentText.ts"
import { ApprovalsList } from "./ApprovalsList.tsx"

/**
 * The approvals button with how many trades wait for you; it opens them in a sheet. The route can hold the sheet open
 * (`open`, `onOpenChange`), so a link (a notification, a push) opens it.
 */
export function ApprovalsBell(
  { open: held, onOpenChange }: Readonly<{ open?: boolean; onOpenChange?: (open: boolean) => void }> = {}
) {
  const count = useApprovalCount()
  const [own, setOwn] = useState(false)
  const open = held ?? own
  const setOpen = onOpenChange ?? setOwn

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="relative"
        aria-label={`Approvals, ${waitingText(count).toLowerCase()}`}
        onClick={() => setOpen(true)}
      >
        <Icon name="approvals" size={16} />
        {count === 0 ?
          null :
          (
            <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-blue px-[5px] text-caption-sm font-semibold text-white tabular-nums">
              {count}
            </span>
          )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Approvals</SheetTitle>
            <SheetDescription>{waitingText(count)}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ApprovalsList />
          </SheetBody>
          <SheetFooter>
            <ButtonLink
              variant="ghost"
              render={<Link to="/approvals" />}
              onClick={() => setOpen(false)}
            >
              Open approvals
            </ButtonLink>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
