import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { swapCallGas, swapCalls } from "@bluechip/chain/market/Swaps"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { createTestClient, createWalletClient, http, parseEther } from "viem"
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts"
import { base } from "viem/chains"
import { call, fundedUser, origin, signUp } from "../support/api.ts"
import { softwareAuthenticator } from "../support/authenticator.ts"
import { chainAvailable, ForkLayer } from "../support/fork.ts"

const forkUrl = "http://localhost:8545"
const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

/**
 * NVDA shares for `account` without going through bluechip: a helper wallet buys them with the account as recipient,
 * so the account's own address stays untouched (and deployable).
 */
const giveShares = Effect.fnUntraced(
  function*(account: `0x${string}`, dollars: number) {
    const chain = yield* ChainClient
    const dev = yield* DevChain
    const helper = privateKeyToAddress(generatePrivateKey())
    const amountIn = BigInt(dollars * 1e6)
    yield* dev.setEthBalance(helper, parseEther("1"))
    yield* dev.setUsdcBalance(helper, amountIn)

    yield* chain.use("buy for the account", async (client) => {
      const anvil = createTestClient({ chain: base, mode: "anvil", transport: http(forkUrl) })
      const wallet = createWalletClient({ chain: base, account: helper, transport: http(forkUrl) })
      await anvil.impersonateAccount({ address: helper })
      const swap = {
        stock: nvda,
        side: "buy",
        amountIn,
        minimumOut: BigInt(0),
        recipient: account,
        deadline: BigInt(2) ** BigInt(64)
      } as const
      for (const { data, to } of swapCalls(swap)) {
        await client.waitForTransactionReceipt({ hash: await wallet.sendTransaction({ to, data, gas: swapCallGas }) })
      }
    })
  },
  Effect.provide(ForkLayer)
)

const prepareTrade = (cookie: string, side: "buy" | "sell", amount: object) =>
  call("POST", "/api/trades", { cookie, body: { requestId: randomUUID(), symbol: "NVDA", side, amount } })

describe.skipIf(!chainAvailable)("trades", () => {
  it.effect("refuses to spend more cash, or sell more shares, than the account holds", () =>
    Effect.gen(function*() {
      const created = yield* signUp(softwareAuthenticator({ rpId: "localhost", origin }))
      const cookie = `bluechip_session=${created.session}`

      assert.strictEqual((yield* prepareTrade(cookie, "buy", { usdc: "1000000" })).json._tag, "InsufficientCash")
      assert.strictEqual((yield* prepareTrade(cookie, "sell", { shares: "1" })).json._tag, "InsufficientShares")
    }))

  it.effect("a passkey-signed buy deploys the account and fills at least the quoted minimum", () =>
    Effect.gen(function*() {
      const { authenticator, cookie, events } = yield* fundedUser()

      const prepared = yield* prepareTrade(cookie, "buy", { usdc: String(100_000_000) })
      assert.isTrue(prepared.json.deploysAccount)
      const credential = authenticator.authenticate(prepared.json.options.challenge)
      const sent = yield* call("POST", `/api/trades/${prepared.json.id}/confirm`, { cookie, body: { credential } })
      assert.strictEqual(sent.json.status, "confirming")

      const settled = yield* events.next((event) => event._tag === "TradeUpdated" && event.trade.id === sent.json.id)
      assert.strictEqual(settled.trade.status, "filled")
      assert.strictEqual(settled.trade.usdc, String(100_000_000))
      assert.isTrue(BigInt(settled.trade.shares) >= BigInt(prepared.json.quote.minimumOut))

      const replay = yield* call("POST", `/api/trades/${prepared.json.id}/confirm`, { cookie, body: { credential } })
      assert.strictEqual(replay.json.reason, "challenge")
      yield* events.close
    }))

  it.effect("a sell turns shares back into cash and shows up in activity", () =>
    Effect.gen(function*() {
      const { address, authenticator, cookie, events } = yield* fundedUser()
      yield* giveShares(address, 200)
      const shares = BigInt((yield* call("GET", "/api/portfolio", { cookie })).json.holdings[0].shares)

      const prepared = yield* prepareTrade(cookie, "sell", { shares: String(shares / BigInt(2)) })
      const credential = authenticator.authenticate(prepared.json.options.challenge)
      const sent = yield* call("POST", `/api/trades/${prepared.json.id}/confirm`, { cookie, body: { credential } })
      const settled = yield* events.next((event) => event._tag === "TradeUpdated" && event.trade.id === sent.json.id)
      assert.strictEqual(settled.trade.status, "filled")

      const cash = BigInt((yield* call("GET", "/api/portfolio", { cookie })).json.cash)
      assert.strictEqual(cash, BigInt(1_000_000_000) + BigInt(settled.trade.usdc))

      const activity = yield* call("GET", "/api/activity?kind=trades", { cookie })
      assert.deepStrictEqual(
        activity.json.items.map((item: { _tag: string; trade: { side: string } }) => [item._tag, item.trade.side]),
        [["Trade", "sell"]]
      )
      yield* events.close
    }))
})
