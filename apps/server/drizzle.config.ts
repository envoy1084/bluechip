import { defineConfig } from "drizzle-kit"
import { existsSync } from "node:fs"

// drizzle-kit and the Trigger.dev CLI load this file without the server's .env.local: load it the way `pnpm dev` does.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/tables.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://bluechip:bluechip@localhost:5432/bluechip" }
})
