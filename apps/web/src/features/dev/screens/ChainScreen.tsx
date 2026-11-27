import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { Badge } from "@bluechip/ui/components/badge"
import { Button } from "@bluechip/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bluechip/ui/components/card"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { erc20Abi, formatUnits } from "viem"
import { useAccount, useBlockNumber, useChainId, useConnect, useDisconnect, useReadContract } from "wagmi"
import { deployment } from "../../../lib/network.ts"

export function ChainScreen() {
  const chainId = useChainId()
  const { data: blockNumber } = useBlockNumber({ watch: true })
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <div className="grid gap-2">
        <h1 className="text-display-3 font-semibold">Chain</h1>
        <p className="text-body text-g-600">Base (or the local fork) as the browser sees it, through wagmi.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Network</CardTitle>
          <CardDescription>Chain {chainId}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1">
          <span className="text-caption text-g-500">Latest block</span>
          {blockNumber === undefined ?
            <span className="text-g-500">Connecting…</span> :
            (
              <NumberRoll
                className="text-display-3 font-semibold"
                value={Number(blockNumber)}
                format={{ useGrouping: false }}
              />
            )}
        </CardContent>
      </Card>
      <Wallet />
    </div>
  )
}

function Wallet() {
  const { address, connector, status } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useReadContract({
    address: deployment.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address === undefined ? undefined : [address],
    query: { enabled: address !== undefined }
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet</CardTitle>
        <CardDescription>A wallet you already have, for deposits</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {address === undefined ?
          (
            <div className="flex flex-wrap gap-2">
              {connectors.map((option) => (
                <Button
                  key={option.uid}
                  variant="secondary"
                  loading={isPending}
                  onClick={() => connect({ connector: option })}
                >
                  {option.name}
                </Button>
              ))}
            </div>
          ) :
          (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AddressChip address={address} />
                <Badge variant="success">{connector?.name ?? status}</Badge>
              </div>
              <span className="text-body tabular-nums">
                {balance === undefined ? "…" : `${formatUnits(balance, 6)} USDC`}
              </span>
              <Button variant="ghost" onClick={() => disconnect()}>Disconnect</Button>
            </div>
          )}
      </CardContent>
    </Card>
  )
}
