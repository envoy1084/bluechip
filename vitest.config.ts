import { playwright } from "@vitest/browser-playwright"
import * as path from "node:path"
import { defineConfig, mergeConfig, type ViteUserConfig } from "vitest/config"

export const exclude = [
  "**/.*/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**",
  "**/test/fixtures/**",
  "**/*.d.ts",
  "**/*.config.*",
  "**/vitest.*"
]

const shared: ViteUserConfig = {
  server: { watch: { ignored: exclude } },
  resolve: { tsconfigPaths: true },
  test: {
    exclude,
    passWithNoTests: true,
    setupFiles: [path.join(import.meta.dirname, "vitest.setup.ts")],
    include: ["test/**/*.test.{ts,tsx}"]
  }
}

const project = (name: string, directory: string, config: ViteUserConfig = {}) =>
  mergeConfig(shared, mergeConfig({ root: directory, test: { name } }, config))

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      project("scripts", "scripts"),
      project("domain", "packages/domain"),
      // Chain tests run on the devnet: one Anvil and Alto per worker, from the captured state. Each worker is three busy
      // processes (Anvil, Alto and the tests), so these projects run as their own group, after the browser and pure
      // tests, with a few workers each: sharing the machine with Chromium, bundler round trips slowed past the timeout.
      ...[
        project("devnet", "packages/devnet", { test: { globalSetup: ["test/setup/devnet.ts"] } }),
        project("chain", "packages/chain", { test: { globalSetup: ["test/setup/devnet.ts"] } }),
        project("server", "apps/server", { test: { globalSetup: ["test/setup/devnet.ts", "test/setup/database.ts"] } })
      ].map((config) =>
        // A cold worker's first test starts a bundler and deploys an account: 15 s, not Vitest's default 5 (agreed with
        // the maintainer for the devnet-backed projects only).
        // oxlint-disable-next-line landmines-testing/no-flake-masking
        mergeConfig(config, { test: { maxWorkers: 4, testTimeout: 15_000, sequence: { groupOrder: 1 } } })
      ),
      // Real-chain facts on a fork of Base: only with `pnpm test:fork`.
      ...(process.env["BLUECHIP_FORK_TESTS"] === "1"
        ? [{
          ...project("fork", "packages/chain"),
          test: { ...project("fork", "packages/chain").test, include: ["test-fork/**/*.test.ts"] }
        }]
        : []),
      // Components run in real Chromium: real focus, keyboard and layout, no DOM fakes.
      project("ui", "packages/ui", {
        // Pre-bundle the UI libraries up front; discovering them mid-run reloads Vite and breaks React hooks.
        optimizeDeps: {
          include: [
            "react",
            "react-dom",
            "react/jsx-runtime",
            "@base-ui/react",
            "@number-flow/react",
            "torph/react",
            "skullet/react",
            "web-haptics",
            "glimm/react",
            "@tanstack/react-table",
            "embla-carousel-react",
            "react-resizable-panels",
            "@tanstack/charts",
            "@tanstack/charts/mark/decorative",
            "@tanstack/charts/polar",
            "@tanstack/charts/react",
            "@tanstack/charts/react/tooltip",
            "@tanstack/charts/scales/band",
            "@tanstack/charts/scales/linear",
            "@tanstack/charts/tooltip"
          ]
        },
        test: {
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] }
        }
      })
    ]
  }
})
