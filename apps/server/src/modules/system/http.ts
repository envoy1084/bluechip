import { BluechipApi } from "@bluechip/domain/Api"
import { ServerVersion } from "@bluechip/domain/api/SystemApi"
import { ContractVersion } from "@bluechip/domain/Contract"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { release } from "../../config/Release.ts"

export const SystemHandlers = HttpApiBuilder.group(
  BluechipApi,
  "system",
  Effect.fn(function*(handlers) {
    return handlers.handleAll({
      version: () =>
        Effect.map(
          DateTime.now,
          (serverTime) => new ServerVersion({ version: release, contract: ContractVersion, serverTime })
        )
    })
  })
)
