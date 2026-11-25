// Starts the suite's stack once per run; the function it returns stops it. With `BLUECHIP_E2E_STACK=running` the run
// uses a stack already started by `pnpm --filter @bluechip/e2e stack` (handy while writing tests) and leaves it up.
import { startStack, urls } from "./Stack.ts"

export default async () => {
  if (process.env["BLUECHIP_E2E_STACK"] === "running") {
    const health = await fetch(`${urls.server}/health`).catch(() => undefined)
    if (health?.ok !== true) throw new Error("e2e: BLUECHIP_E2E_STACK=running, but no stack answers; start one first")
    return
  }
  const stack = await startStack()
  return stack.stop
}
