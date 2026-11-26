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
