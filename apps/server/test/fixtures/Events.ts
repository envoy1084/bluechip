// Live events the tests write themselves.
import { LiveEvent } from "@bluechip/domain/Events"
import { Address, TransferId } from "@bluechip/domain/Ids"
import { Transfer } from "@bluechip/domain/portfolio/Transfer"
import * as DateTime from "effect/DateTime"
import { typeid } from "typeid-js"

/** $25 of USDC that arrived at `account` (a new deposit each call). */
export const depositArrived = (account: string) =>
  LiveEvent.cases.TransferUpdated.make({
    transfer: new Transfer({
      id: TransferId.make(typeid("transfer").toString()),
      kind: "deposit",
      asset: "USDC",
      amount: 25_000_000n,
      from: Address.make("0x0000000000000000000000000000000000000001"),
      to: Address.make(account),
      status: "confirmed",
      txHash: null,
      createdAt: DateTime.nowUnsafe()
    })
  })
