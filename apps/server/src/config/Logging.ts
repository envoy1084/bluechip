import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as References from "effect/References"

/** JSON logs in production (one object per line), readable logs everywhere else; level from `LOG_LEVEL`. */
export const LoggingLive = Layer.unwrap(
  Effect.gen(function*() {
    const production = (yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"))) === "production"
    const level = yield* Config.LogLevel("LOG_LEVEL").pipe(Config.withDefault("Info"))
    return Layer.mergeAll(
      Logger.layer([production ? Logger.consoleJson : Logger.consolePretty()]),
      Layer.succeed(References.MinimumLogLevel, level)
    )
  })
)
