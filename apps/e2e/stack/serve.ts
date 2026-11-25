// `pnpm --filter @bluechip/e2e stack`: starts the suite's stack and keeps it up until Ctrl+C, so test runs with
// `BLUECHIP_E2E_STACK=running` skip starting it.
import { startStack, urls } from "./Stack.ts"

const stack = await startStack()
process.stdout.write(`e2e stack running: web ${urls.web}, server ${urls.server}; Ctrl+C stops it\n`)

const stop = async () => {
  await stack.stop()
  process.exit(0)
}
process.once("SIGINT", stop)
process.once("SIGTERM", stop)
