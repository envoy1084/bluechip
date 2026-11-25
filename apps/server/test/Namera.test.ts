import { ChainClient } from "@bluechip/chain/ChainClient"
import { usdc } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { assert, describe, layer } from "@effect/vitest"
import * as SmartAccount from "@namera-ai/sdk/effect/accounts/SmartAccount"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { encodeFunctionData, erc20Abi, parseEther } from "viem"
import { Namera } from "../src/Namera.ts"
import { chainAvailable, ForkLayer } from "./fork.ts"
import { softwarePasskey } from "./passkey.ts"

const recipient = "0x000000000000000000000000000000000000dEaD"

describe.skipIf(!chainAvailable)("Namera on the local fork", () => {
  layer(Layer.provideMerge(Namera.layer, ForkLayer))((it) => {
    it.effect("a passkey always owns the same, not yet deployed, Kernel account", () =>
      Effect.gen(function*() {
        const namera = yield* Namera
        const chain = yield* ChainClient
        const passkey = softwarePasskey("0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba")
        const first = yield* namera.kernelAccount(passkey)
        const again = yield* namera.kernelAccount(passkey)
        assert.strictEqual(first.address, again.address)
        const detected = yield* SmartAccount.detect(chain.client, { address: first.address })
        assert.strictEqual(detected.type, "undeployed")
      }))

    it.effect("a passkey-signed user operation deploys the account and moves USDC", () =>
      Effect.gen(function*() {
        const namera = yield* Namera
        const chain = yield* ChainClient
        const dev = yield* DevChain
        const account = yield* namera.kernelAccount(softwarePasskey())
        yield* dev.setEthBalance(account.address, parseEther("0.1"))
        yield* dev.setUsdcBalance(account.address, 10_000_000n)
        const bundler = namera.bundlerClient(account)
        const receipt = yield* Effect.promise(async () => {
          const hash = await bundler.sendUserOperation({
            calls: [{
              to: usdc,
              data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient, 4_000_000n] })
            }]
          })
          return bundler.waitForUserOperationReceipt({ hash })
        })
        assert.isTrue(receipt.success)
        const left = yield* chain.use("read USDC", (client) =>
          client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }))
        assert.strictEqual(left, 6_000_000n)
        const detected = yield* SmartAccount.detect(chain.client, { address: account.address })
        assert.strictEqual(detected.type, "kernel")
      }))
  })
})
