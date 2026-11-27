import { ChainClient } from "@bluechip/chain/ChainClient"
import { localDeployment } from "@bluechip/chain/deployments/Base"
import { DevChain } from "@bluechip/chain/DevChain"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { erc20Abi } from "viem"

const { usdc } = localDeployment

layer(DevnetTest.layer)("DevChain", (it) => {
  describe("setUsdcBalance", () => {
    it.effect("an account holds exactly the USDC set", () =>
      Effect.gen(function*() {
        const account = "0x00000000000000000000000000000000b1c4f00d"
        yield* (yield* DevChain).setUsdcBalance(account, BigInt(1_234_000_000))

        const balance = yield* (yield* ChainClient).use(
          "balanceOf",
          (client) => client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] })
        )
        assert.strictEqual(balance, BigInt(1_234_000_000))
      }))
  })

  describe("sendUsdc", () => {
    it.effect("an account receives USDC in a real transfer, on top of what it held", () =>
      Effect.gen(function*() {
        const dev = yield* DevChain
        const account = "0x00000000000000000000000000000000b1c4f00e"
        yield* dev.setUsdcBalance(account, BigInt(1_000_000))
        yield* dev.sendUsdc(account, BigInt(2_500_000))

        const balance = yield* (yield* ChainClient).use(
          "balanceOf",
          (client) => client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] })
        )
        assert.strictEqual(balance, BigInt(3_500_000))
      }))

    it.effect("four accounts sent USDC at once each receive it", () =>
      Effect.gen(function*() {
        const dev = yield* DevChain
        const chain = yield* ChainClient
        const accounts = [
          "0x00000000000000000000000000000000b1c4f010",
          "0x00000000000000000000000000000000b1c4f011",
          "0x00000000000000000000000000000000b1c4f012",
          "0x00000000000000000000000000000000b1c4f013"
        ] as const
        yield* Effect.forEach(accounts, (account) => dev.sendUsdc(account, BigInt(2_000_000)), {
          concurrency: "unbounded"
        })

        const balances = yield* Effect.forEach(accounts, (account) =>
          chain.use(
            "balanceOf",
            (client) =>
              client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] })
          ))
        assert.deepStrictEqual(balances, [BigInt(2_000_000), BigInt(2_000_000), BigInt(2_000_000), BigInt(2_000_000)])
      }))
  })

  describe("setEthBalance", () => {
    it.effect("an account holds exactly the ETH set", () =>
      Effect.gen(function*() {
        const account = "0x00000000000000000000000000000000b1c4f00f"
        yield* (yield* DevChain).setEthBalance(account, BigInt(10) ** BigInt(17))

        const balance = yield* (yield* ChainClient).use(
          "getBalance",
          (client) => client.getBalance({ address: account })
        )
        assert.strictEqual(balance, BigInt(10) ** BigInt(17))
      }))
  })
})
