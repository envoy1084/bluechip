// The mock API's own parts: the contract and sign-in middleware (always signed in, unless the panel signs you out or
// marks this build outdated), the live event stream, and the server's version.
import { BluechipApi } from "@bluechip/domain/Api"
import { RpcBodyLimit } from "@bluechip/domain/api/RpcApi"
import { ServerVersion } from "@bluechip/domain/api/SystemApi"
import { Authentication, CurrentUser, RecoveringUser, RecoveryAuthentication } from "@bluechip/domain/Auth"
import { ContractCheck, ContractVersion, DefectReporting, MalformedIds } from "@bluechip/domain/Contract"
import { ClientOutdated, Unauthenticated } from "@bluechip/domain/Errors"
import { heartbeatInterval, LiveEvent } from "@bluechip/domain/Events"
import type { Address, PasskeyId, SessionId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import { network } from "../../lib/network.ts"
import { ACCOUNT_ADDRESS, USER_ID } from "../world/cast.ts"
import { previewId } from "../world/ids.ts"
import { Preview } from "./Preview.ts"

const signedIn = {
  id: USER_ID,
  account: ACCOUNT_ADDRESS as Address,
  passkey: previewId("passkey", 1) as PasskeyId,
  session: previewId("session", 1) as SessionId
}

export const MiddlewareLive = Layer.mergeAll(
  Layer.effect(
    ContractCheck,
    Effect.gen(function*() {
      const preview = yield* Preview
      return ContractCheck.of((httpEffect) =>
        preview.settings.live === "outdated" ?
          Effect.fail(new ClientOutdated({ serverVersion: ContractVersion + 1 })) :
          httpEffect
      )
    })
  ),
  Layer.succeed(DefectReporting, (httpEffect) => httpEffect),
  Layer.succeed(MalformedIds, (httpEffect) => httpEffect),
  Layer.succeed(RpcBodyLimit, (httpEffect) => httpEffect),
  Layer.effect(
    Authentication,
    Effect.gen(function*() {
      const preview = yield* Preview
      return Authentication.of({
        session: (httpEffect) =>
          preview.settings.live === "signedOut" ?
            Effect.fail(new Unauthenticated()) :
            Effect.provideService(httpEffect, CurrentUser, signedIn)
      })
    })
  ),
  Layer.succeed(
    RecoveryAuthentication,
    RecoveryAuthentication.of({ recovery: (httpEffect) => Effect.provideService(httpEffect, RecoveringUser, signedIn) })
  )
)

export const SystemHandlers = HttpApiBuilder.group(
  BluechipApi,
  "system",
  Effect.fn(function*(handlers) {
    return handlers.handleAll({
      version: () =>
        Effect.map(
          DateTime.now,
          (serverTime) => new ServerVersion({ version: "preview", contract: ContractVersion, network, serverTime })
        )
    })
  })
)

export const EventsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "events",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      // The store's events and a heartbeat, until the panel bounces the stream (the app reconnects and refetches) or
      // drops it for good.
      watch: () =>
        Effect.sync(() => {
          const events = Stream.callback<LiveEvent>((queue) =>
            Effect.acquireRelease(
              Effect.sync(() => {
                if (preview.settings.live === "dropped") {
                  Queue.endUnsafe(queue)
                  return undefined
                }
                return preview.onLive((event) => {
                  if (event === "bounce") Queue.endUnsafe(queue)
                  else Queue.offerUnsafe(queue, event)
                })
              }),
              (unsubscribe) => Effect.sync(() => unsubscribe?.())
            )
          )
          const heartbeats = Stream.tick(heartbeatInterval).pipe(
            Stream.zipWithIndex,
            Stream.mapEffect(([, sequence]) =>
              Effect.map(DateTime.now, (at): LiveEvent => LiveEvent.cases.Heartbeat.make({ at, sequence }))
            )
          )
          return Stream.merge(events, heartbeats, { haltStrategy: "left" })
        })
    })
  })
)
