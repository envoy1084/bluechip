import { defineConfig, devices } from "@playwright/test"
import { urls } from "./stack/Stack.ts"

// Chain round trips (a user operation through Alto, a receipt) take seconds, and the first visit to each page compiles
// it in Vite: tests get two minutes, and each wait on the page 30 s. Agreed with the maintainer for this suite only.
export default defineConfig({
  testDir: "specs",
  globalSetup: "./stack/globalSetup.ts",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  workers: 4,
  forbidOnly: process.env["CI"] !== undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: ".data/report" }]],
  outputDir: ".data/results",
  use: {
    baseURL: urls.web,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"]
  },
  projects: [
    { name: "app", grepInvert: /@chain/ },
    // Tests tagged `@chain` change what every account shares (the chain's clock, its base fee): they run one at a time,
    // after the rest.
    { name: "chain", grep: /@chain/, dependencies: ["app"], workers: 1 }
  ]
})
