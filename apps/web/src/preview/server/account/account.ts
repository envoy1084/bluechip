// The mock API's account, sign-in, test money and chain reads: your name and eligibility, the passkeys that own the
// account (each change signed, then landing a few seconds later), the devices signed in, passkey sign-up and sign-in
// as the made-up person, $1,000 of test money, and the few JSON-RPC reads a wallet makes.
import { Account, Me, Passkey, PasskeyChange, User } from "@bluechip/domain/Account"
import { BluechipApi } from "@bluechip/domain/Api"
import { Conflict, NotFound } from "@bluechip/domain/Errors"
import type { Address, PasskeyId, SigningRequestId } from "@bluechip/domain/Ids"
import { notificationOfTransfer } from "@bluechip/domain/notifications/Drafts"
import { notificationOfPasskey } from "@bluechip/domain/notifications/SecurityDrafts"
import { type JsonRpcRequest, type JsonRpcResponse, refusal } from "@bluechip/domain/rpc/JsonRpc"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Layer from "effect/Layer"
import type { AccountSlice } from "../../world/account.ts"
import { accountChanged, nextNumber, notify, portfolioChanged, record } from "../../world/account/changes.ts"
import { transferOf } from "../../world/account/history.ts"
import { stockName } from "../../world/account/notifications.ts"
import { ACCOUNT_ADDRESS } from "../../world/cast.ts"
import { previewId } from "../../world/ids.ts"
import type { World } from "../../world/World.ts"
import { Preview } from "../Preview.ts"
import {
  authenticationCeremony,
  authenticationOptions,
  changeNow,
  expiresSoon,
  landLater,
  registrationCeremony
} from "./ceremonies.ts"

/** You and your account, as `GET /api/account` and every sign-in answer. */
export const meOf = (world: World): Me =>
  new Me({
    user: world.account.user,
    account: new Account({ address: ACCOUNT_ADDRESS as Address, deployed: world.account.deployed })
  })

const replacePasskey = (account: AccountSlice, changed: Passkey) => {
  account.passkeys = account.passkeys.map((passkey) => passkey.id === changed.id ? changed : passkey)
}

const AccountHandlers = HttpApiBuilder.group(
  BluechipApi,
  "account",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    const setUser = (change: Partial<Pick<User, "displayName" | "timeZone" | "eligibility">>) =>
      Effect.sync(() => {
        preview.update((world) => {
          world.account.user = new User({ ...world.account.user, ...change })
        })
        return preview.world.account.user
      })

    return handlers.handleAll({
      me: () => Effect.sync(() => meOf(preview.world)),
      setDisplayName: ({ payload }) => setUser({ displayName: payload.displayName }),
      setTimeZone: ({ payload }) => setUser({ timeZone: payload.timeZone }),
      setEligibility: ({ payload }) => setUser({ eligibility: payload.answer }),
      passkeys: () =>
        Effect.sync(() => preview.world.account.passkeys.filter((passkey) => passkey.status !== "removed")),
      passkeyOptions: () => Effect.sync(() => registrationCeremony(preview.world)),

      addPasskey: ({ payload }) =>
        Effect.sync(() => {
          const world = preview.world
          const passkey = new Passkey({
            id: previewId("passkey", nextNumber(world.account)) as PasskeyId,
            role: "owner",
            status: "pending",
            label: payload.credential.authenticatorAttachment === "cross-platform" ?
              "Security key" :
              "Google Password Manager on Mac",
            synced: payload.credential.authenticatorAttachment !== "cross-platform",
            current: false,
            createdAt: DateTime.nowUnsafe(),
            lastUsedAt: null
          })
          const id = previewId("signing", nextNumber(world.account)) as SigningRequestId
          world.account.signing.set(id, { _tag: "AddPasskey", passkey })
          return new PasskeyChange({
            id,
            options: authenticationOptions(world),
            action: "add",
            passkey,
            deploysAccount: !world.account.deployed,
            expiresAt: expiresSoon()
          })
        }),

      removePasskey: Effect.fn(function*({ params }) {
        const world = preview.world
        const passkey = world.account.passkeys.find((candidate) => candidate.id === params.id)
        if (passkey === undefined) return yield* new NotFound({ resource: "passkey", id: params.id })
        if (passkey.status !== "active") return yield* new Conflict({ reason: "passkeyBusy" })
        const owners = world.account.passkeys.filter((candidate) => candidate.status === "active")
        if (owners.length <= 1) return yield* new Conflict({ reason: "lastPasskey" })

        const id = previewId("signing", nextNumber(world.account)) as SigningRequestId
        world.account.signing.set(id, { _tag: "RemovePasskey", passkeyId: passkey.id })
        return new PasskeyChange({
          id,
          options: authenticationOptions(world),
          action: "remove",
          passkey,
          deploysAccount: !world.account.deployed,
          expiresAt: expiresSoon()
        })
      }),

      confirmPasskeyChange: Effect.fn(function*({ params }) {
        const account = preview.world.account
        const signing = account.signing.get(params.id)
        if (signing?._tag !== "AddPasskey" && signing?._tag !== "RemovePasskey") {
          return yield* new NotFound({ resource: "passkeyChange", id: params.id })
        }

        if (signing._tag === "AddPasskey") {
          account.signing.delete(params.id)
          preview.update((world) => world.account.passkeys.push(signing.passkey))
          preview.emit(accountChanged())
          yield* landLater(preview, (world) => {
            // The panel may have replaced the passkeys meanwhile.
            if (!world.account.passkeys.some((candidate) => candidate.id === signing.passkey.id)) return []
            const added = new Passkey({ ...signing.passkey, status: "active" })
            replacePasskey(world.account, added)
            world.account.deployed = true
            record(world.account, {
              actor: "owner",
              action: "passkey.added",
              subjectType: "passkey",
              subjectId: added.id,
              data: { label: added.label }
            })
            return [accountChanged(), notify(world.account, notificationOfPasskey(added, true))]
          })
          return signing.passkey
        }

        const owners = account.passkeys.filter((candidate) => candidate.status === "active")
        const passkey = owners.find((candidate) => candidate.id === signing.passkeyId)
        if (passkey === undefined) return yield* new Conflict({ reason: "passkeyBusy" })
        if (owners.length <= 1) return yield* new Conflict({ reason: "lastPasskey" })

        account.signing.delete(params.id)
        const removing = new Passkey({ ...passkey, status: "removing" })
        preview.update((world) => replacePasskey(world.account, removing))
        preview.emit(accountChanged())
        yield* landLater(preview, (world) => {
          world.account.passkeys = world.account.passkeys.filter((candidate) => candidate.id !== passkey.id)
          world.account.devices = world.account.devices.filter((device) =>
            device.current || device.passkey !== passkey.label
          )
          world.account.deployed = true
          record(world.account, {
            actor: "owner",
            action: "passkey.removed",
            subjectType: "passkey",
            subjectId: passkey.id,
            data: { label: passkey.label }
          })
          return [accountChanged(), notify(world.account, notificationOfPasskey(passkey, false))]
        })
        return removing
      }),

      devices: () => Effect.sync(() => preview.world.account.devices),

      signOutDevice: Effect.fn(function*({ params }) {
        const device = preview.world.account.devices.find((candidate) => candidate.id === params.id)
        if (device === undefined) return yield* new NotFound({ resource: "session", id: params.id })
        preview.update((world) => {
          world.account.devices = world.account.devices.filter((candidate) => candidate.id !== device.id)
          record(world.account, {
            actor: "owner",
            action: "device.signedOut",
            subjectType: "session",
            subjectId: device.id,
            data: { device: device.device }
          })
        })
        preview.emit(accountChanged())
      }),

      signOutOthers: () =>
        Effect.sync(() => {
          preview.update((world) => {
            const current = world.account.devices.find((device) => device.current)
            world.account.devices = world.account.devices.filter((device) => device.current)
            record(world.account, {
              actor: "owner",
              action: "device.signedOut",
              subjectType: "session",
              subjectId: current?.id ?? previewId("session", 1),
              data: {}
            })
          })
          preview.emit(accountChanged())
        })
    })
  })
)

const AuthHandlers = HttpApiBuilder.group(
  BluechipApi,
  "auth",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    // Signing in or up ends the signed-out state the panel (or a sign-out) set, as a new session cookie would.
    const signIn = Effect.sync(() => {
      if (preview.settings.live === "signedOut") preview.setLive("connected")
      return meOf(preview.world)
    })

    return handlers.handleAll({
      registerOptions: () => Effect.sync(() => registrationCeremony(preview.world)),
      registerVerify: ({ payload }) =>
        Effect.andThen(
          Effect.sync(() => {
            const displayName = payload.displayName
            if (displayName === undefined) return
            preview.update((world) => {
              world.account.user = new User({ ...world.account.user, displayName })
            })
          }),
          signIn
        ),
      loginOptions: () => Effect.sync(() => authenticationCeremony(preview.world)),
      loginVerify: () => signIn,
      logout: () => Effect.sync(() => preview.setLive("signedOut"))
    })
  })
)

const DevHandlers = HttpApiBuilder.group(
  BluechipApi,
  "dev",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      // $1,000 arrives as any deposit would: in the transfers, told, and the portfolio refetched. The cash shown
      // comes from the money slice, which this doesn't change.
      fund: () =>
        Effect.sync(() =>
          changeNow(preview, (world) => {
            const deposit = transferOf(nextNumber(world.account), "deposit", 1_000, "confirmed", DateTime.nowUnsafe())
            world.account.transfers.unshift(deposit)
            return [portfolioChanged(), notify(world.account, notificationOfTransfer(deposit, stockName)!)]
          })
        )
    })
  })
)

// Base's genesis, for a block number that moves as the chain does (a block every 2 seconds).
const BASE_GENESIS_SECONDS = 1_686_789_347

const answer = (request: JsonRpcRequest): JsonRpcResponse => {
  const refused = refusal(request)
  if (refused !== undefined) return refused

  switch (request.method) {
    case "eth_chainId":
      return { jsonrpc: "2.0", id: request.id, result: "0x2105" }
    case "eth_blockNumber":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: `0x${Math.floor((Date.now() / 1000 - BASE_GENESIS_SECONDS) / 2).toString(16)}`
      }
    case "eth_getBalance":
      return { jsonrpc: "2.0", id: request.id, result: "0x0" }
    default:
      return { jsonrpc: "2.0", id: request.id, result: `0x${"0".repeat(64)}` }
  }
}

const RpcHandlers = HttpApiBuilder.group(
  BluechipApi,
  "rpc",
  Effect.fn(function*(handlers) {
    return handlers.handleAll({
      call: ({ payload }) => Effect.sync(() => "method" in payload ? answer(payload) : payload.map(answer))
    })
  })
)

export const AccountAuthGroupsLive = Layer.mergeAll(AccountHandlers, AuthHandlers, DevHandlers, RpcHandlers)
