import { assert, describe, it } from "@effect/vitest"

import { devProcesses, prefixLine } from "../commands/dev.ts"

describe("dev", () => {
  it("runs the server, the web app, the kit and the jobs, minus the ones switched off", () => {
    const names = (options: { uikit: boolean; jobs: boolean }) => devProcesses(options).map((process) => process.name)

    assert.deepStrictEqual(names({ uikit: true, jobs: true }), ["server", "web", "uikit", "jobs"])
    assert.deepStrictEqual(names({ uikit: false, jobs: false }), ["server", "web"])
  })

  it("prefixes each line with its process, aligned", () => {
    const [server] = devProcesses({ uikit: false, jobs: false })
    assert.strictEqual(prefixLine(server!, 6, "ready"), "\u001b[34mserver │\u001b[0m ready")
  })
})
