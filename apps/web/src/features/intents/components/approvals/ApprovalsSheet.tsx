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
import { useRef } from "react"
import { track } from "../../../../lib/analytics.ts"
import { useApprovalCount } from "../../hooks/useApprovalCount.ts"
import { waitingText } from "../../model/intentText.ts"
import { ApprovalsList } from "./ApprovalsList.tsx"

/**
 * The top bar's approvals: a quiet icon while nothing waits, a blue count once trades wait for you; it opens them in a
 * sheet. The frame holds the sheet open (`open`, `onOpenChange`, from the address), so a link, a notification or a
 * push opens it on any page. The sheet opens on its title, never on Decline, and gives focus back to the button.
 */
export function ApprovalsBell(
  { open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>
) {
  const count = useApprovalCount()
  const trigger = useRef<HTMLButtonElement>(null)
  const title = useRef<HTMLHeadingElement>(null)

  return (
    <>
      <Button
        ref={trigger}
        variant="ghost"
        size="icon-sm"
        className="relative"
        aria-label={count === 0 ? "Approvals, nothing to approve" : `Approvals, ${count} to approve`}
        onClick={() => {
          track({ _tag: "approval_opened", entry: "bell" })
          onOpenChange(true)
        }}
      >
        <Icon name="approvals" size={16} />
        {count === 0 ?
          null :
          (
            <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-blue px-[5px] text-caption-sm font-semibold text-white tabular-nums ring-2 ring-canvas">
              {count > 99 ? "99+" : count}
            </span>
          )}
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent initialFocus={title} finalFocus={trigger} className="w-[min(760px,92vw)]">
          <SheetHeader>
            <SheetTitle ref={title} tabIndex={-1} className="outline-none">Approvals</SheetTitle>
            <SheetDescription>{waitingText(count)}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ApprovalsList />
          </SheetBody>
          <SheetFooter>
            <ButtonLink variant="ghost" render={<Link to="/approvals" />} onClick={() => onOpenChange(false)}>
              Open the approvals page
            </ButtonLink>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
