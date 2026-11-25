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
      // Chain tests run on the devnet: one Anvil and Alto per worker, from the captured state.
      project("devnet", "packages/devnet", { test: { globalSetup: ["test/setup/devnet.ts"] } }),
      project("chain", "packages/chain", { test: { globalSetup: ["test/setup/devnet.ts"] } }),
      project("server", "apps/server", { test: { globalSetup: ["test/setup/devnet.ts"] } }),
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
