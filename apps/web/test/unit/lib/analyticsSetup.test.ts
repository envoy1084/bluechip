import { assert, describe, it } from "@effect/vitest"
import { commonProperties } from "../../../src/lib/analytics.ts"
import { analyticsSetup, posthogConfig, templateCapture } from "../../../src/lib/analyticsSetup.ts"

const switches = {
  dev: false,
  preview: false,
  network: "sepolia",
  projectKey: "phc_test",
  deploymentEnvironment: undefined,
  appVersion: "1.2.3"
} as const

const paper = { environment: "paper", network: "sepolia", projectKey: "phc_test", appVersion: "1.2.3" } as const
const origin = "https://paper.bluechip.markets"

describe("analyticsSetup", () => {
  it.each(
    [
      { name: "a paper build with the key", switches, expected: paper },
      {
        name: "a production build",
        switches: { ...switches, network: "base" },
        expected: { ...paper, environment: "production", network: "base" }
      },
      {
        name: "a deployment named by the build",
        switches: { ...switches, deploymentEnvironment: "production" },
        expected: { ...paper, environment: "production" }
      },
      {
        name: "a deployment name that isn't one is ignored",
        switches: { ...switches, deploymentEnvironment: "staging" },
        expected: paper
      },
      { name: "the development server", switches: { ...switches, dev: true }, expected: null },
      { name: "preview mode", switches: { ...switches, preview: true }, expected: null },
      { name: "the local chain", switches: { ...switches, network: "local" }, expected: null },
      { name: "no project key", switches: { ...switches, projectKey: undefined }, expected: null },
      { name: "an empty project key", switches: { ...switches, projectKey: " " }, expected: null }
    ] as const
  )("$name", ({ switches, expected }) => {
    assert.deepStrictEqual(analyticsSetup(switches), expected)
  })
})

describe("commonProperties", () => {
  it("says the network, deployment and release", () => {
    assert.deepStrictEqual(commonProperties(paper), { network: "sepolia", environment: "paper", app_version: "1.2.3" })
  })
})

describe("templateCapture", () => {
  it("templates this site's addresses and paths, keeping another site's referrer", () => {
    const capture = {
      uuid: "0190c1f0-0000-7000-8000-000000000000",
      event: "$pageview",
      properties: {
        $current_url: `${origin}/agents/agent_01jdxk4m2v8y9q5t3n7r6w0zab?draft=agent_01jdxk4m2v8y9q5t3n7r6w0zab`,
        $pathname: "/agents/agent_01jdxk4m2v8y9q5t3n7r6w0zab",
        $referrer: "https://news.example.com/story/42",
        symbol: "NVDA"
      },
      $set_once: { $initial_current_url: `${origin}/stocks/NVDA` }
    }

    assert.deepStrictEqual(templateCapture(capture, origin), {
      uuid: "0190c1f0-0000-7000-8000-000000000000",
      event: "$pageview",
      properties: {
        $current_url: `${origin}/agents/:id`,
        $pathname: "/agents/:id",
        $referrer: "https://news.example.com/story/42",
        symbol: "NVDA"
      },
      $set_once: { $initial_current_url: `${origin}/stocks/:symbol` }
    })
  })
})

describe("posthogConfig", () => {
  it.each(
    [
      { name: "paper masks inputs and what is marked", setup: paper, expected: "[data-ph-mask]" },
      { name: "production masks all text", setup: { ...paper, environment: "production" }, expected: "*" }
    ] as const
  )("$name", ({ setup, expected }) => {
    const { session_recording } = posthogConfig(setup, { origin, optedOut: false })

    assert.deepStrictEqual(session_recording, {
      maskAllInputs: true,
      maskTextSelector: expected,
      recordHeaders: false,
      recordBody: false,
      captureJsonLd: false
    })
  })

  it("sends through this site's /ingest, with typed events only", () => {
    const { before_send: _, session_recording: __, ...config } = posthogConfig(paper, { origin, optedOut: false })

    assert.deepStrictEqual(config, {
      api_host: `${origin}/ingest`,
      ui_host: "https://us.posthog.com",
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      autocapture: false,
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_exceptions: true,
      capture_performance: { web_vitals: true, network_timing: true },
      capture_dead_clicks: true,
      enable_heatmaps: true,
      respect_dnt: true,
      opt_out_capturing_by_default: false
    })
  })

  it("starts opted out when you turned analytics off", () => {
    assert.strictEqual(posthogConfig(paper, { origin, optedOut: true }).opt_out_capturing_by_default, true)
  })
})
