/**
 * Keeps an Anvil on Base's hardfork at the real time. On that hardfork Anvil dates each block 200 ms after its parent
 * (Base's block time) rather than at the wall clock: an idle chain falls behind (about a second every ten with a block
 * every 2 s), a busy one runs ahead. Behind, an agent's operation is bounded to a UTC day the bundler has left, and a
 * recovery's 48 hours count from a time already past.
 *
 * @since 0.0.0
 */
import type { Rpc } from "./Controls.ts"

/**
 * How often the clock is checked: a chain is at most this far behind the real clock.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const CLOCK_INTERVAL_MS = 500

/**
 * Moves the next block's time up to the real clock (plus `secondsAhead`) when it is behind, and never back: a clock
 * already ahead (a busy chain, or one a test moved forward) is left as it is.
 *
 * @stability unstable
 * @category controls
 * @since 0.0.0
 */
export const alignClock = async (node: Rpc, secondsAhead = 0) => {
  // The pending block carries the time Anvil will give the next one, including a time a test has just set.
  const pending = await node("eth_getBlockByNumber", ["pending", false]) as { readonly timestamp: string }
  const target = Math.floor(Date.now() / 1000) + secondsAhead
  if (Number(pending.timestamp) < target) await node("anvil_setTime", [target])
}

/**
 * A running `keepClock`.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface ClockKeeper {
  /**
   * Keeps the chain `seconds` ahead of the real clock from now on, moving it there first. It goes through the
   * keeper's checks, one at a time, so a check already under way can't put the clock back behind it.
   */
  readonly moveAhead: (seconds: number) => Promise<void>
  readonly stop: () => void
}

/**
 * Aligns `node`'s clock every `CLOCK_INTERVAL_MS` until stopped.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const keepClock = (node: Rpc): ClockKeeper => {
  let secondsAhead = 0
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  // Every change to the clock, in order: a check reads the pending block, then sets the time, with nothing between.
  let changes: Promise<void> = Promise.resolve()
  const enqueue = (change: () => Promise<void>) => {
    const changed = changes.then(change)
    changes = changed.catch(() => undefined)
    return changed
  }

  const tick = async () => {
    // A check that fails (the node starting, restarting or stopping) is made again on the next tick.
    await enqueue(() => alignClock(node, secondsAhead)).catch(() => undefined)
    if (stopped) return
    timer = setTimeout(tick, CLOCK_INTERVAL_MS)
    timer.unref()
  }
  void tick()

  return {
    moveAhead: (seconds) =>
      enqueue(async () => {
        secondsAhead = seconds
        await alignClock(node, seconds)
      }),
    stop: () => {
      stopped = true
      clearTimeout(timer)
    }
  }
}
