import { ChainClient } from "@bluechip/chain/ChainClient"
import { DevChain } from "@bluechip/chain/DevChain"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"

// Real time: what's checked is the chain's clock against the wall clock as seconds pass. On a devnet of its own, since
// the worker's shared chain runs ahead while other files mine block after block.
layer(DevnetTest.layerIsolated, { excludeTestServices: true })("keepClock", (it) => {
  describe("on a chain idle between blocks", () => {
    it.effect("each block of a 5-second run is within 2 s of the real time", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const dev = yield* DevChain

        // On its own clock Anvil dates each block 200 ms after the last: 5 s on, a block would be about 4 s behind.
        const drifts = yield* Effect.forEach([1, 2, 3, 4, 5], () =>
          Effect.gen(function*() {
            yield* Effect.sleep("1 second")
            yield* Effect.orDie(dev.mine(1))
            const block = yield* Effect.orDie(chain.use("block", (client) => client.getBlock()))
            return Math.abs(Number(block.timestamp) - Math.floor(Date.now() / 1000)) <= 2
          }))

        assert.deepStrictEqual(drifts, [true, true, true, true, true])
      }))
  })
})
