# @bluechip/devnet

A local Base for tests. Each Vitest worker gets its own Anvil (Base's `base:Denim` hardfork, chain id 8453) and Alto
(safe mode, so ERC-7562 is enforced), started from `state/devnet.state.gz`, which holds:

- EntryPoint 0.7, Kernel 3.3 (with ZeroDev's staked FactoryStaker), Namera's contracts and Multicall3, at their real
  addresses;
- USDC (Circle's code and the storage it reads);
- the 13 Coinbase stocks as real B20 tokens at their real addresses, with Base's multipliers, minted by the devnet
  admin;
- Aerodrome Slipstream (factory, router, quoter) with each stock's USDC pool at its pinned address, seeded with about
  $50,000 a side at the feed's price;
- Chainlink feeds replaced by mocks the test sets (`contracts/src/MockFeed.sol`).

## Use

```ts
// vitest.config.ts: test: { globalSetup: ["test/setup/devnet.ts"] }
// test/setup/devnet.ts
import { globalSetup } from "@bluechip/devnet/globalSetup"
export default globalSetup()

// a test file
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
layer(DevnetTest.layer)("…", (it) => {/* Devnet, ChainClient and DevChain */})
```

`Devnet` sets prices (`setPrice(symbol, price, { ageSeconds })`) and mints shares (`mintShares`); `DevChain` gives
ETH and USDC.

## Rebuilding the state

`pnpm devnet:capture` forks Base at `BASE_FORK_BLOCK` through `BASE_FORK_RPC_URL` (root `.env.local`), records what
bluechip's calls read with a `prestateTracer`, builds the bare chain and writes the state. Rebuild it when bluechip
starts using a new contract; `pnpm test:fork` checks that the facts it copies still hold on Base.
