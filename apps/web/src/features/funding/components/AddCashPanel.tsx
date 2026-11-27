import { usdcTransferRequest } from "@bluechip/chain/funding/PaymentRequest"
import { DepositArrivedCard } from "@bluechip/ui/bluechip/deposit-arrived-card"
import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { fetchedPortfolioAtom } from "../../../atoms/portfolio.ts"
import { TestMoney } from "../../../components/TestMoney.tsx"
import { usdcDollars } from "../../../lib/amounts.ts"
import { network } from "../../../lib/network.ts"

// While this dialog is open, balances are read this often: deposits aren't watched in the background, so the
// "cash arrived" moment only plays for someone who is looking.
const CHECK_EVERY_MS = 5000

/**
 * The Add cash dialog's body: the account's address and QR code. While it's open, cash is checked every few seconds
 * and an arrival plays the "cash arrived" moment. On paper money, test money from the faucet is a tap away (the local chain keeps it in Settings).
 */
export function AddCashPanel(
  { address, flat = false }: Readonly<{
    address: `0x${string}`
    /** Inside a dialog: no card of its own around it. */
    flat?: boolean
  }>
) {
  const surface = flat ? { className: "rounded-none bg-transparent p-0 shadow-none" } : {}
  const portfolio = useAtomValue(fetchedPortfolioAtom)
  const refresh = useAtomRefresh(fetchedPortfolioAtom)

  const cash = AsyncResult.isSuccess(portfolio) ? portfolio.value.cash : undefined
  // The cash when the dialog opened: anything above it arrived while the user was looking.
  const [startingCash, setStartingCash] = useState<bigint | undefined>(undefined)
  if (startingCash === undefined && cash !== undefined) setStartingCash(cash)

  const arrived = cash !== undefined && startingCash !== undefined && cash > startingCash
    ? cash - startingCash
    : undefined

  useEffect(() => {
    if (arrived !== undefined) return
    const timer = setInterval(refresh, CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [arrived, refresh])

  return (
    <div className="grid gap-3">
      {arrived === undefined ?
        (
          <DepositCard
            address={address}
            paymentRequest={usdcTransferRequest({ network, recipient: address })}
            {...surface}
          />
        ) :
        <DepositArrivedCard amount={usdcDollars(arrived)} celebrate {...surface} />}
      {network === "sepolia" && <TestMoney />}
    </div>
  )
}
