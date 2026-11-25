import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@bluechip/ui/components/alert-dialog"
import { Badge } from "@bluechip/ui/components/badge"
import { Button } from "@bluechip/ui/components/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@bluechip/ui/components/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "@bluechip/ui/components/drawer"
import { Input } from "@bluechip/ui/components/input"
import { Label } from "@bluechip/ui/components/label"
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@bluechip/ui/components/sheet"
import { toast } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { AgentTile, Limits, Section, Ticker } from "./layout.tsx"

export function ModalSections({ open }: { readonly open: string | undefined }) {
  return (
    <>
      <Section
        id="dialog"
        title="Dialog"
        base="Dialog"
        purpose="A focused task on top of the page. Traps focus, closes on Esc or outside click, gives focus back."
      >
        <Dialog defaultOpen={open === "dialog"}>
          <DialogTrigger render={<Button variant="secondary" />}>
            <Icon name="edit" size={16} />Rename agent
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename agent</DialogTitle>
              <DialogDescription>Only you see this name. Its limits stay the same.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid gap-1.5">
                <Label htmlFor="agent-name">Name</Label>
                <Input id="agent-name" defaultValue="Rebalancer" />
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
              <DialogClose render={<Button />} onClick={() => toast.success("Agent renamed")}>Save name</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog defaultOpen={open === "dialog-scroll"}>
          <DialogTrigger render={<Button variant="outline" />}>
            <Icon name="shield" size={16} />Review limits
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rebalancer's limits</DialogTitle>
              <DialogDescription>Locked with Face ID on Nov 2. Your agent can never go past these.</DialogDescription>
            </DialogHeader>
            <DialogBody scrollable>
              <Limits />
              <p className="text-label text-g-500">
                Limits are checked onchain before every trade. If a trade would break one, it doesn't happen and you get
                a note in Activity.
              </p>
              <p className="text-label text-g-500">
                To change a limit, edit it and confirm with Face ID. The agent pauses until you do.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button variant="secondary" />}>Close</DialogClose>
              <DialogClose render={<Button />} onClick={() => toast("Opening limits editor")}>
                <Icon name="face-id" size={16} />Edit limits
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section
        id="alert-dialog"
        title="Alert dialog"
        base="AlertDialog"
        purpose="Confirms something that can't be undone. Outside clicks don't close it; focus starts on the safe choice."
      >
        <AlertDialog defaultOpen={open === "alert-dialog"}>
          <AlertDialogTrigger render={<Button variant="danger" />}>
            <Icon name="trash" size={16} />Remove agent
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogIcon name="trash" />
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Rebalancer?</AlertDialogTitle>
              <AlertDialogDescription>
                It stops right away and can't trade again. Your stocks and cash stay in your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep agent</AlertDialogCancel>
              <AlertDialogAction onClick={() => toast.success("Rebalancer removed")}>Remove agent</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      <Section
        id="sheet"
        title="Sheet"
        base="Sheet (Dialog)"
        purpose="A panel that slides in from an edge for details you can read without leaving the page."
      >
        <Sheet defaultOpen={open === "sheet"}>
          <SheetTrigger render={<Button variant="secondary" />}>
            Agent details<Icon name="arrow-right" size={16} />
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <div className="flex items-center gap-3">
                <AgentTile icon="scales" />
                <div className="grid gap-0.5">
                  <SheetTitle>Rebalancer</SheetTitle>
                  <Badge variant="success">Running</Badge>
                </div>
              </div>
            </SheetHeader>
            <SheetBody>
              <SheetDescription>Keeps your mix on target. Only rebalances, never adds cash.</SheetDescription>
              <div className="grid gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-semibold text-g-400">Limits</span>
                  <span className="inline-flex items-center gap-1 text-caption font-[550] text-gain">
                    <Icon name="lock" size={12} />Locked with Face ID
                  </span>
                </div>
                <Limits />
              </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose render={<Button variant="danger" />} onClick={() => toast("Rebalancer removed")}>
                <Icon name="trash" size={16} />Remove agent
              </SheetClose>
              <SheetClose render={<Button variant="secondary" />} onClick={() => toast("Opening limits editor")}>
                Edit limits
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <Sheet defaultOpen={open === "sheet-left"}>
          <SheetTrigger render={<Button variant="outline" />}>
            <Icon name="sidebar" size={16} />Open menu
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>bluechip</SheetTitle>
            </SheetHeader>
            <nav aria-label="Main" className="grid gap-0.5 p-3">
              {(["home", "portfolio", "agents", "activity", "approvals", "settings"] as const).map((name, i) => (
                <SheetClose
                  key={name}
                  aria-current={i === 0 ? "page" : undefined}
                  className="flex h-[38px] cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-body-sm font-medium text-g-600 capitalize hover:bg-g-100 hover:text-ink aria-[current=page]:bg-white aria-[current=page]:text-ink aria-[current=page]:shadow-e1 aria-[current=page]:[&>svg]:text-blue"
                >
                  <Icon name={name} size={18} className="text-g-400" />
                  {name}
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        {(["top", "bottom"] as const).map((side) => (
          <Sheet key={side} defaultOpen={open === `sheet-${side}`}>
            <SheetTrigger render={<Button variant="ghost" />}>From the {side}</SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Prices are a few seconds old</SheetTitle>
                <SheetDescription>
                  Your agents always use a fresh price and the fair price check before they trade.
                </SheetDescription>
              </SheetHeader>
              <SheetFooter className="justify-end">
                <SheetClose render={<Button variant="secondary" />}>Got it</SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ))}
      </Section>

      <Section
        id="drawer"
        title="Drawer"
        base="Drawer"
        purpose="A bottom sheet for phones. Swipe it down, tap outside or press Esc to dismiss."
      >
        <Drawer defaultOpen={open === "drawer"}>
          <DrawerTrigger render={<Button />}>
            <Icon name="approvals" size={16} />Review pending trade
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <span className="mb-1">
                <AgentTile icon="target" size="lg" />
              </span>
              <DrawerTitle>Approve this trade?</DrawerTitle>
              <DrawerDescription>
                Stock picker wants to buy 2 <Ticker symbol="NVDA" /> for <b className="tabular-nums">$362.84</b>.
              </DrawerDescription>
            </DrawerHeader>
            <ul className="grid gap-2 rounded-md bg-g-50 px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]">
              {[
                "Inside spend per day ($250 left after this: $87)",
                "Fair price check passed (0.2% from market)",
                "Above $300, so it needs you"
              ].map((line, i) => (
                <li key={line} className="flex items-start gap-[9px] text-label text-g-700">
                  <Icon
                    name={i === 2 ? "hand" : "check-circle"}
                    size={16}
                    className={i === 2 ? "mt-px text-blue" : "mt-px text-gain"}
                  />
                  {line}
                </li>
              ))}
            </ul>
            <DrawerFooter>
              <DrawerClose render={<Button size="lg" />} onClick={() => toast.success("Trade approved")}>
                <Icon name="face-id" size={18} />Approve with Face ID
              </DrawerClose>
              <DrawerClose
                render={<Button variant="ghost" />}
                onClick={() => toast("Trade declined. Stock picker will look again tomorrow.")}
              >
                Decline
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </Section>
    </>
  )
}
