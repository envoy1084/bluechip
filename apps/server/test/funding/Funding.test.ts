import { ChainClient } from "@bluechip/chain/ChainClient"
import { usdc } from "@bluechip/chain/Contracts"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { erc20Abi } from "viem"
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts"
import { call, fundedUser } from "../support/api.ts"

const THOUSAND = String(1_000_000_000)

const withdraw = (cookie: string, to: string, amount: number) =>
  call("POST", "/api/withdrawals", { cookie, body: { requestId: randomUUID(), to, amount: String(amount) } })

/** A withdrawal of $250 prepared, signed with the user's passkey and confirmed. */
const confirmedWithdrawal = Effect.fnUntraced(function*(recipient: string) {
  const user = yield* fundedUser()
  const prepared = yield* withdraw(user.cookie, recipient, 250_000_000)
  const credential = user.authenticator.authenticate(prepared.json.options.challenge)
  const sent = yield* call("POST", `/api/withdrawals/${prepared.json.id}/confirm`, {
    cookie: user.cookie,
    body: { credential }
  })
  return { ...user, prepared, credential, sent }
})

describe("POST /api/dev/fund", () => {
  it.effect("204: $1,000 of test money arrives as cash, live", () =>
    Effect.gen(function*() {
      const { cookie, events } = yield* fundedUser()
      yield* events.next((event) => event._tag === "PortfolioChanged")

      const portfolio = yield* call("GET", "/api/portfolio", { cookie })

      assert.deepStrictEqual(
        { cash: portfolio.json.cash, value: portfolio.json.value, holdings: portfolio.json.holdings },
        { cash: THOUSAND, value: THOUSAND, holdings: [] }
      )
      assert.strictEqual((yield* call("GET", "/api/portfolio/history", { cookie })).json.at(-1).value, THOUSAND)
      yield* events.close
    }))
})

describe("POST /api/withdrawals", () => {
  it.effect("200: part of the cash, as the account's first transaction", () =>
    Effect.gen(function*() {
      const { cookie, events } = yield* fundedUser()

      const prepared = yield* withdraw(cookie, privateKeyToAddress(generatePrivateKey()), 250_000_000)

      assert.strictEqual(prepared.status, 200)
      assert.isTrue(prepared.json.deploysAccount)
      yield* events.close
    }))

  it.effect("InsufficientCash: more than the account holds", () =>
    Effect.gen(function*() {
      const { cookie, events } = yield* fundedUser()

      const prepared = yield* withdraw(cookie, privateKeyToAddress(generatePrivateKey()), 2_000_000_000)

      assert.strictEqual(prepared.json._tag, "InsufficientCash")
      yield* events.close
    }))

  it.effect("InvalidRequest: to the account's own address", () =>
    Effect.gen(function*() {
      const { address, cookie, events } = yield* fundedUser()

      const prepared = yield* withdraw(cookie, address, 1)

      assert.strictEqual(prepared.json._tag, "InvalidRequest")
      yield* events.close
    }))
})

describe("POST /api/withdrawals/:id/confirm", () => {
  it.effect("a passkey-signed withdrawal deploys the account, pays out and leaves the rest as cash", () =>
    Effect.gen(function*() {
      const recipient = privateKeyToAddress(generatePrivateKey())
      const { cookie, events, sent } = yield* confirmedWithdrawal(recipient)

      assert.strictEqual(sent.json.status, "pending")
      const landed = yield* events.next((event) =>
        event._tag === "TransferUpdated" && event.transfer.id === sent.json.id
      )
      assert.strictEqual(landed.transfer.status, "confirmed")

      const received = yield* ChainClient.make("local", DevnetTest.urls().rpcUrl).use(
        "balanceOf",
        (client) => client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [recipient] })
      )
      assert.strictEqual(received, BigInt(250_000_000))
      assert.strictEqual((yield* call("GET", "/api/portfolio", { cookie })).json.cash, String(750_000_000))
      assert.isTrue((yield* call("GET", "/api/account", { cookie })).json.account.deployed)
      assert.deepStrictEqual(
        (yield* call("GET", "/api/transfers", { cookie })).json.items.map((
          transfer: { kind: string; status: string }
        ) => [transfer.kind, transfer.status]),
        [["withdrawal", "confirmed"]]
      )
      yield* events.close
    }))

  it.effect("403: the same signature confirmed twice", () =>
    Effect.gen(function*() {
      const { cookie, credential, events, prepared } = yield* confirmedWithdrawal(
        privateKeyToAddress(generatePrivateKey())
      )

      const replay = yield* call("POST", `/api/withdrawals/${prepared.json.id}/confirm`, {
        cookie,
        body: { credential }
      })

      assert.strictEqual(replay.status, 403)
      assert.strictEqual(replay.json.reason, "challenge")
      yield* events.close
    }))
})
