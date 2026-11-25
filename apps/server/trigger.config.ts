import { defineConfig } from "@trigger.dev/sdk"
import { existsSync } from "node:fs"

// drizzle-kit and the Trigger.dev CLI load this file without the server's .env.local: load it the way `pnpm dev` does.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

// `pnpm --filter @bluechip/server jobs:dev` runs these tasks on this machine against the local database and fork;
// Trigger.dev's cloud only schedules them. TRIGGER_PROJECT_REF is the project's ref (proj_…) from its dashboard.
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  dirs: ["./trigger"],
  maxDuration: 300,
  retries: { enabledInDev: false, default: { maxAttempts: 3, minTimeoutInMs: 1000, maxTimeoutInMs: 10_000, factor: 2 } }
})
