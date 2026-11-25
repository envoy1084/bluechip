import { MoneyInput } from "@bluechip/ui/bluechip/money-input"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { erc20Abi, parseUnits } from "viem"
import { useAccount, useConnect, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { base } from "wagmi/chains"

const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

/** Sends USDC on Base from a wallet the user already has (a browser wallet or Base Account) to their bluechip account. */
export function SendFromWallet({ to }: Readonly<{ to: `0x${string}` }>) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: connecting } = useConnect()
  const { data: hash, error, isPending: sending, writeContract } = useWriteContract()
  const { isLoading: confirming, isSuccess: sent } = useWaitForTransactionReceipt({ hash })
  const [amount, setAmount] = useState<number | null>(null)

  if (!isConnected) {
    return (
      <div className="flex flex-wrap gap-2">
        {connectors.map((connector) => (
          <Button
            key={connector.uid}
            variant="secondary"
            loading={connecting}
            onClick={() => connect({ connector, chainId: base.id })}
          >
            <Icon name="wallet" size={16} />
            Send from {connector.name}
          </Button>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <MoneyInput
        label={`Send from ${address === undefined ? "your wallet" : `${address.slice(0, 6)}…${address.slice(-4)}`}`}
        currency="usdc"
        size="md"
        showMax={false}
        quickAmounts={[50, 100, 500]}
        emptyHint="How much USDC to send. It arrives in your bluechip account in seconds."
        onValueChange={setAmount}
      />

      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>Your wallet didn't send it. Nothing moved; try again when you're ready.</AlertDescription>
        </Alert>
      )}

      <Button
        disabled={amount === null || sent}
        loading={sending || confirming}
        onClick={() =>
          amount !== null && writeContract({
            address: usdc,
            abi: erc20Abi,
            functionName: "transfer",
            args: [to, parseUnits(String(amount), 6)],
            chainId: base.id
          })}
      >
        {sent ? "Sent" : "Send USDC"}
      </Button>
    </div>
  )
}
