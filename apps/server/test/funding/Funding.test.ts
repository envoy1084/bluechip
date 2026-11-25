import { ChainClient } from "@bluechip/chain/ChainClient"
import { usdc } from "@bluechip/chain/Contracts"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { erc20Abi } from "viem"
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts"
import { call, openEvents, origin, signUp } from "../support/api.ts"
import { softwareAuthenticator } from "../support/authenticator.ts"
import { chainAvailable } from "../support/fork.ts"

const thousand = String(1_000_000_000)

/** A new user with 1,000 test USDC, and their live events. */
const fundedUser = Effect.fnUntraced(function*() {
  const authenticator = softwareAuthenticator({ rpId: "localhost", origin })
  const created = yield* signUp(authenticator)
  const cookie = `bluechip_session=${created.session}`
  const events = yield* openEvents(cookie)
  assert.strictEqual((yield* call("POST", "/api/dev/fund", { cookie })).status, 204)
  return { authenticator, cookie, events, address: created.json.account.address as string }
})

describe.skipIf(!chainAvailable)("funding", () => {
  it.effect("test money shows up as cash, live", () =>
    Effect.gen(function*() {
      const { cookie, events } = yield* fundedUser()
      yield* events.next((event) => event._tag === "PortfolioChanged")

      const portfolio = yield* call("GET", "/api/portfolio", { cookie })
      assert.strictEqual(portfolio.json.cash, thousand)
      assert.strictEqual(portfolio.json.value, thousand)
      assert.deepStrictEqual(portfolio.json.holdings, [])

      const history = yield* call("GET", "/api/portfolio/history", { cookie })
      assert.strictEqual(history.json.at(-1).value, thousand)
      yield* events.close
    }))

  it.effect("a passkey-signed withdrawal deploys the account, pays out once and leaves the rest as cash", () =>
    Effect.gen(function*() {
      const { address, authenticator, cookie, events } = yield* fundedUser()
      const recipient = privateKeyToAddress(generatePrivateKey())
      const withdraw = (to: string, amount: number) =>
        call("POST", "/api/withdrawals", { cookie, body: { requestId: randomUUID(), to, amount: String(amount) } })
      assert.strictEqual((yield* withdraw(recipient, 2_000_000_000)).json._tag, "InsufficientCash")
      assert.strictEqual((yield* withdraw(address, 1)).json._tag, "InvalidRequest")

      const prepared = yield* withdraw(recipient, 250_000_000)
      assert.isTrue(prepared.json.deploysAccount)
      const credential = authenticator.authenticate(prepared.json.options.challenge)
      const sent = yield* call("POST", `/api/withdrawals/${prepared.json.id}/confirm`, { cookie, body: { credential } })
      assert.strictEqual(sent.json.status, "pending")
      const landed = yield* events.next((event) =>
        event._tag === "TransferUpdated" && event.transfer.id === sent.json.id
      )
      assert.strictEqual(landed.transfer.status, "confirmed")
      const replay = yield* call("POST", `/api/withdrawals/${prepared.json.id}/confirm`, {
        cookie,
        body: { credential }
      })
      assert.strictEqual(replay.json.reason, "challenge")

      const received = yield* ChainClient.make("local", "http://localhost:8545").use(
        "read recipient",
        (client) => client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [recipient] })
      )
      assert.strictEqual(received, BigInt(250_000_000))
      assert.strictEqual((yield* call("GET", "/api/portfolio", { cookie })).json.cash, String(750_000_000))
      assert.isTrue((yield* call("GET", "/api/account", { cookie })).json.account.deployed)
      const transfers = yield* call("GET", "/api/transfers", { cookie })
      assert.deepStrictEqual(
        transfers.json.items.map((transfer: { kind: string; status: string }) => [transfer.kind, transfer.status]),
        [["withdrawal", "confirmed"]]
      )
      yield* events.close
    }))
})
