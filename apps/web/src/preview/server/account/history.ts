// The mock API's audit log and money in and out: the log filtered by kind, agent and dates (a page, or all of it),
// and the deposits and withdrawals, a withdrawal prepared, signed, then landing on Base a few seconds later.
import { BluechipApi } from "@bluechip/domain/Api"
import type { AuditFilter } from "@bluechip/domain/api/AuditApi"
import type { AuditEvent } from "@bluechip/domain/audit/Audit"
import { InsufficientCash, InvalidRequest, NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { SigningRequestId } from "@bluechip/domain/Ids"
import { SigningRequest, Transfer } from "@bluechip/domain/portfolio/Transfer"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Layer from "effect/Layer"
import type * as Schema from "effect/Schema"
import type { AccountSlice } from "../../world/account.ts"
import { nextNumber, portfolioChanged, settleWithdrawal } from "../../world/account/changes.ts"
import { transferOf } from "../../world/account/history.ts"
import { ACCOUNT_ADDRESS } from "../../world/cast.ts"
import { previewId } from "../../world/ids.ts"
import { Preview } from "../Preview.ts"
import { authenticationOptions, changeNow, expiresSoon, landLater } from "./ceremonies.ts"
import { pageOf } from "./pages.ts"

type Filter = Schema.Struct.Type<typeof AuditFilter>

// Actions are `subject.verb`, so a kind of thing is the actions starting with its name.
const matching = (events: ReadonlyArray<AuditEvent>, filter: Filter) =>
  events.filter((event) =>
    (filter.type === undefined || event.action.startsWith(`${filter.type}.`)) &&
    (filter.agentId === undefined || event.agentId === filter.agentId) &&
    (filter.from === undefined || DateTime.isGreaterThanOrEqualTo(event.at, filter.from)) &&
    (filter.to === undefined || DateTime.isLessThan(event.at, filter.to))
  )

const AuditHandlers = HttpApiBuilder.group(
  BluechipApi,
  "audit",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      list: ({ query }) =>
        Effect.sync(() =>
          pageOf(matching(preview.world.account.audit, query), {
            pageSize: query.pageSize ?? 25,
            pageToken: query.pageToken
          })
        ),
      export: ({ query }) => Effect.sync(() => matching(preview.world.account.audit, query).slice(0, 10_000))
    })
  })
)

// The cash a withdrawal may take: the scenario's cash, less the withdrawals still on their way.
const available = (account: AccountSlice, cash: number) =>
  BigInt(Math.round(cash * 1_000_000)) -
  account.transfers
    .filter((transfer) => transfer.kind === "withdrawal" && transfer.status === "pending")
    .reduce((sum, transfer) => sum + transfer.amount, BigInt(0))

const TransfersHandlers = HttpApiBuilder.group(
  BluechipApi,
  "transfers",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      list: ({ query }) =>
        Effect.sync(() =>
          pageOf(preview.world.account.transfers, { pageSize: query.pageSize ?? 20, pageToken: query.pageToken })
        ),

      prepareWithdrawal: Effect.fn(function*({ payload }) {
        const world = preview.world
        if (payload.amount === BigInt(0)) return yield* new InvalidRequest({ field: "amount", problem: "outOfRange" })
        if (payload.to.toLowerCase() === ACCOUNT_ADDRESS) {
          return yield* new InvalidRequest({ field: "to", problem: "notAllowed" })
        }
        const cash = available(world.account, world.cast.cash)
        if (payload.amount > cash) return yield* new InsufficientCash({ available: cash })

        const id = previewId("signing", nextNumber(world.account)) as SigningRequestId
        world.account.signing.set(id, { _tag: "Withdraw", amount: payload.amount, to: payload.to })
        return new SigningRequest({
          id,
          options: authenticationOptions(world),
          withdrawal: { amount: payload.amount, to: payload.to },
          deploysAccount: !world.account.deployed,
          expiresAt: expiresSoon()
        })
      }),

      confirmWithdrawal: Effect.fn(function*({ params }) {
        const signing = preview.world.account.signing.get(params.id)
        if (signing?._tag !== "Withdraw") return yield* new NotFound({ resource: "withdrawal", id: params.id })

        const sent = new Transfer({
          ...transferOf(nextNumber(preview.world.account), "withdrawal", 0, "pending", DateTime.nowUnsafe()),
          amount: signing.amount,
          to: signing.to
        })
        changeNow(preview, (world) => {
          world.account.signing.delete(params.id)
          world.account.transfers.unshift(sent)
          world.account.deployed = true
          return [LiveEvent.cases.TransferUpdated.make({ transfer: sent }), portfolioChanged()]
        })
        yield* landLater(preview, (world) => settleWithdrawal(world.account, sent.id, "confirmed"))
        return sent
      })
    })
  })
)

export const HistoryGroupsLive = Layer.mergeAll(AuditHandlers, TransfersHandlers)
