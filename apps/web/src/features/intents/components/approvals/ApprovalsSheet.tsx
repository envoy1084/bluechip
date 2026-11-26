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
import { cn } from "@bluechip/ui/lib/cn"
import { Link } from "@tanstack/react-router"
import { useRef } from "react"
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
        size={count === 0 ? "icon-sm" : "sm"}
        className={cn(count === 0 ? null : "gap-1.5 bg-blue-50 px-2.5 text-blue hover:bg-blue-100")}
        aria-label={count === 0 ? "Approvals, nothing to approve" : `Approvals, ${count} to approve`}
        onClick={() => onOpenChange(true)}
      >
        <Icon name="approvals" size={16} />
        {count === 0 ? null : (
          <span className="font-semibold tabular-nums">
            {count}
            <span className="max-sm:hidden">to approve</span>
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent initialFocus={title} finalFocus={trigger}>
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
