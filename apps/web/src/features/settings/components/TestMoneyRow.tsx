import { SettingsRow as Row } from "../../../components/layout/SettingsSection.tsx"
import { hasTestMoney, TestMoney } from "../../../components/TestMoney.tsx"

/** Test USDC from the faucet, only where money is pretend. */
export function TestMoneyRow() {
  if (!hasTestMoney) return null

  return (
    <Row title="Test money" description="Adds test USDC to your account. It only exists on this test network.">
      <TestMoney className="text-right" />
    </Row>
  )
}
