import { Button } from "@bluechip/ui/components/button"
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
import { ApprovalsList, useApprovalCount } from "./ApprovalsList.tsx"

/** "2 trades waiting for you", or that nothing is. */
export const waitingText = (count: number) =>
  count === 0 ? "Nothing waiting for you" : count === 1 ? "1 trade waiting for you" : `${count} trades waiting for you`

/** The bell with how many trades wait for you; it opens the approvals in a sheet. */
export function ApprovalsBell() {
  const count = useApprovalCount()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="relative"
        aria-label={`Approvals, ${waitingText(count).toLowerCase()}`}
        onClick={() => setOpen(true)}
      >
        <Icon name="bell" size={16} />
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
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link to="/approvals" />}
              onClick={() => setOpen(false)}
            >
              Open approvals
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
