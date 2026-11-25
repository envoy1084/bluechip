import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@bluechip/ui/components/dialog"
import { useAtom, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { meAtom } from "../../../atoms/account.ts"
import { cashDialogAtom } from "../../../atoms/cashDialog.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { AddCashPanel } from "./AddCashPanel.tsx"
import { WithdrawDialog } from "./WithdrawDialog.tsx"

/** The Add cash and Withdraw dialogs, mounted once for every signed-in page; `cashDialogAtom` opens them. */
export function CashDialogs() {
  const [open, setOpen] = useAtom(cashDialogAtom)
  const me = useAtomValue(meAtom)
  const portfolio = useAtomValue(portfolioAtom)
  const cash = AsyncResult.isSuccess(portfolio) ? portfolio.value.cash : BigInt(0)

  return (
    <>
      <Dialog open={open === "add"} onOpenChange={(next) => setOpen(next ? "add" : null)}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add cash</DialogTitle>
            <DialogDescription>
              Send USDC on Base to your bluechip account. It shows up here as soon as it lands.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {AsyncResult.isSuccess(me) && <AddCashPanel address={me.value.account.address as `0x${string}`} />}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <WithdrawDialog
        cash={cash}
        open={open === "withdraw"}
        onOpenChange={(next) => setOpen(next ? "withdraw" : null)}
      />
    </>
  )
}
