// The clocks of a test server on a devnet of its own, moved together: the chain's, the bundler's and the server's.
import { DevnetClock } from "@bluechip/devnet/Devnet"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export class TestClocks extends Context.Service<TestClocks, {
  /**
   * Moves the chain, the bundler and the server `seconds` ahead of the real clock, as if that time had passed: a
   * recovery asked for now is due 48 hours on everywhere at once.
   */
  readonly moveAhead: (seconds: number) => Effect.Effect<void>
}>()("@bluechip/server/test/TestClocks") {
  /** The server's `Clock`, the real one until moved ahead, and the service moving it with the devnet's. */
  static readonly layer = Layer.unwrap(Effect.gen(function*() {
    const real = yield* Clock.Clock
    const devnet = yield* DevnetClock
    let aheadMillis = 0

    const clock: Clock.Clock = {
      currentTimeMillisUnsafe: () => real.currentTimeMillisUnsafe() + aheadMillis,
      currentTimeMillis: Effect.sync(() => real.currentTimeMillisUnsafe() + aheadMillis),
      currentTimeNanosUnsafe: () => real.currentTimeNanosUnsafe() + BigInt(aheadMillis) * 1_000_000n,
      currentTimeNanos: Effect.sync(() => real.currentTimeNanosUnsafe() + BigInt(aheadMillis) * 1_000_000n),
      monotonicTimeNanosUnsafe: () => real.monotonicTimeNanosUnsafe(),
      monotonicTimeNanos: real.monotonicTimeNanos,
      sleep: (duration) => real.sleep(duration)
    }
    const moveAhead = (seconds: number) =>
      Effect.andThen(devnet.moveAhead(seconds), Effect.sync(() => (aheadMillis = seconds * 1000)))

    return Layer.merge(Layer.succeed(Clock.Clock, clock), Layer.succeed(TestClocks, { moveAhead }))
  }))
}
