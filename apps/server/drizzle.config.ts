import { defineConfig } from "drizzle-kit"
import { existsSync } from "node:fs"

// drizzle-kit loads this file without the server's .env.local: load it the way `pnpm dev` does.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/platform/db/schema.ts",
  out: "./drizzle",
  // The durable engine's tables come from Effect's own migrations (`src/platform/engine/Engine.ts`).
  tablesFilter: ["!cluster_*"],
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://bluechip:bluechip@localhost:5432/bluechip" }
})
