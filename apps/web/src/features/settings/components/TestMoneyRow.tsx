import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { SettingsRow as Row } from "../../../components/layout/SettingsSection.tsx"
import { portfolioReactivityKey } from "../../../lib/api/client.ts"
import { network } from "../../../lib/wallet.ts"
import { testMoneyAtom } from "../atoms/settings.ts"

// The networks whose money is pretend: the local devnet, and `sepolia`, the paper network a later phase adds (not a
// `Network` yet, hence the plain strings).
const PLAY_MONEY_NETWORKS: ReadonlyArray<string> = ["local", "sepolia"]

/** $1,000 of test USDC, only where money is pretend. */
export function TestMoneyRow() {
  const addTestMoney = useAtomSet(testMoneyAtom, { mode: "promise" })
  const [state, setState] = useState<"idle" | "adding" | "added" | "failed">("idle")
  if (!PLAY_MONEY_NETWORKS.includes(network)) return null

  const add = () => {
    setState("adding")
    addTestMoney({ reactivityKeys: [portfolioReactivityKey] }).then(
      () => setState("added"),
      () => setState("failed")
    )
  }

  return (
    <Row
      title="Test money"
      description={state === "added" ?
        "$1,000 of test USDC is in your account." :
        state === "failed" ?
        "The test money didn't arrive. Try again." :
        "Adds $1,000 of test USDC to your account. It only exists on this test network."}
    >
      <Button variant="secondary" size="sm" loading={state === "adding"} onClick={add}>
        <Icon name="play" size={14} />Get $1,000 test money
      </Button>
    </Row>
  )
}
