import { ChainClient } from "@bluechip/chain/ChainClient"
import { localDeployment } from "@bluechip/chain/deployments/Base"
import { InsufficientCash, InvalidRequest, SignatureRejected } from "@bluechip/domain/Errors"
import { Address, RequestId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { erc20Abi } from "viem"
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("funding", (it) => {
  describe("POST /api/dev/fund", () => {
    it.effect("204: $1,000 of test money arrives as cash, live", () =>
      Effect.gen(function*() {
        const { api, events } = yield* (yield* TestUsers).funded
        yield* events.next("PortfolioChanged")

        const portfolio = yield* api.portfolio.portfolio()
        const history = yield* api.portfolio.history()

        assert.deepStrictEqual(
          { cash: portfolio.cash, value: portfolio.value, holdings: portfolio.holdings },
          { cash: BigInt(1_000_000_000), value: BigInt(1_000_000_000), holdings: [] }
        )
        assert.strictEqual(history.at(-1)?.value, BigInt(1_000_000_000))
      }))
  })

  describe("POST /api/withdrawals", () => {
    it.effect("200: part of the cash, as the account's first transaction", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).funded

        const prepared = yield* api.transfers.prepareWithdrawal({
          payload: {
            requestId: RequestId.make(randomUUID()),
            to: Address.make(privateKeyToAddress(generatePrivateKey())),
            amount: Usdc.make(BigInt(250_000_000))
          }
        })

        assert.isTrue(prepared.deploysAccount)
      }))

    it.effect("InsufficientCash: more than the account holds", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).funded

        const error = yield* Effect.flip(api.transfers.prepareWithdrawal({
          payload: {
            requestId: RequestId.make(randomUUID()),
            to: Address.make(privateKeyToAddress(generatePrivateKey())),
            amount: Usdc.make(BigInt(2_000_000_000))
          }
        }))

        assert.deepStrictEqual({ ...error }, { ...new InsufficientCash({ available: BigInt(1_000_000_000) }) })
      }))

    it.effect("InvalidRequest: to the account's own address", () =>
      Effect.gen(function*() {
        const { account, api } = yield* (yield* TestUsers).funded

        const error = yield* Effect.flip(api.transfers.prepareWithdrawal({
          payload: { requestId: RequestId.make(randomUUID()), to: account, amount: Usdc.make(BigInt(1)) }
        }))

        assert.deepStrictEqual({ ...error }, { ...new InvalidRequest({ field: "to", problem: "notAllowed" }) })
      }))
  })

  describe("POST /api/withdrawals/:id/confirm", () => {
    it.effect("a passkey-signed withdrawal deploys the account, pays out and leaves the rest as cash", () =>
      Effect.gen(function*() {
        const { api, authenticator, events } = yield* (yield* TestUsers).funded
        const recipient = Address.make(privateKeyToAddress(generatePrivateKey()))
        const prepared = yield* api.transfers.prepareWithdrawal({
          payload: { requestId: RequestId.make(randomUUID()), to: recipient, amount: Usdc.make(BigInt(250_000_000)) }
        })

        const sent = yield* api.transfers.confirmWithdrawal({
          params: { id: prepared.id },
          payload: { credential: authenticator.authenticate(prepared.options) }
        })
        const { transfer } = yield* events.next("TransferUpdated", ({ transfer }) => transfer.id === sent.id)
        const received = yield* (yield* ChainClient).use(
          "balanceOf",
          (client) =>
            client.readContract({
              address: localDeployment.usdc,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [recipient as `0x${string}`]
            })
        )
        const portfolio = yield* api.portfolio.portfolio()
        const me = yield* api.account.me()
        const transfers = yield* api.transfers.list({ query: {} })

        assert.deepStrictEqual([sent.status, transfer.status], ["pending", "confirmed"])
        assert.strictEqual(received, BigInt(250_000_000))
        assert.strictEqual(portfolio.cash, BigInt(750_000_000))
        assert.isTrue(me.account.deployed)
        assert.deepStrictEqual(transfers.items.map((transfer) => [transfer.kind, transfer.status]), [
          ["withdrawal", "confirmed"]
        ])
      }))

    it.effect("403: the same signature confirmed twice", () =>
      Effect.gen(function*() {
        const { api, authenticator } = yield* (yield* TestUsers).funded
        const prepared = yield* api.transfers.prepareWithdrawal({
          payload: {
            requestId: RequestId.make(randomUUID()),
            to: Address.make(privateKeyToAddress(generatePrivateKey())),
            amount: Usdc.make(BigInt(250_000_000))
          }
        })
        const confirm = api.transfers.confirmWithdrawal({
          params: { id: prepared.id },
          payload: { credential: authenticator.authenticate(prepared.options) }
        })
        yield* confirm

        const error = yield* Effect.flip(confirm)

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "challenge" }) })
      }))
  })
})
