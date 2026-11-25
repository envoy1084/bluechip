import { KillSwitch } from "@bluechip/ui/bluechip/kill-switch"
import { describe, expect, it } from "@effect/vitest"
import { useState } from "react"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

function Running({ agentCount = 4 }: { readonly agentCount?: number }) {
  const [paused, setPaused] = useState(false)
  return (
    <KillSwitch
      paused={paused}
      agentCount={agentCount}
      onPause={() => setPaused(true)}
      onResume={() => Promise.resolve(setPaused(false))}
    />
  )
}

// Base UI's scroll lock keeps Playwright from clicking inside the open dialog in the test iframe, so its buttons are
// pressed from the keyboard, which is just as real.
const press = async (name: string) => {
  page.getByRole("button", { name }).element().focus()
  await userEvent.keyboard("{Enter}")
}

const pending = () => new Promise<void>(() => {})

describe("KillSwitch", () => {
  describe("running", () => {
    it("asks before pausing, naming how many agents stop", async () => {
      await render(<Running />)
      await userEvent.click(page.getByRole("button", { name: "Pause all" }))
      await expect.element(page.getByRole("alertdialog", { name: "Pause all 4 agents?" })).toBeVisible()
    })

    it("pauses once you confirm", async () => {
      await render(<Running />)
      await userEvent.click(page.getByRole("button", { name: "Pause all" }))
      await press("Pause all agents")
      await expect.element(page.getByText("All agents are paused")).toBeVisible()
    })

    it("keeps the agents running when you cancel", async () => {
      await render(<Running />)
      await userEvent.click(page.getByRole("button", { name: "Pause all" }))
      await press("Cancel")
      await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument()
      await expect.element(page.getByText("All agents are paused")).not.toBeInTheDocument()
    })

    it("names one agent in plain words", async () => {
      await render(<Running agentCount={1} />)
      await userEvent.click(page.getByRole("button", { name: "Pause all" }))
      await expect.element(page.getByRole("alertdialog", { name: "Pause your agent?" })).toBeVisible()
      await expect.element(page.getByRole("button", { name: "Pause agent" })).toBeVisible()
    })
  })

  describe("paused", () => {
    it("says nothing can trade until you resume", async () => {
      await render(<KillSwitch paused agentCount={4} onPause={() => {}} onResume={() => Promise.resolve()} />)
      await expect.element(page.getByText("None of them can trade. Your stocks and cash stay as they are."))
        .toBeVisible()
    })

    it("waits for Face ID while resuming", async () => {
      await render(<KillSwitch paused agentCount={4} onPause={() => {}} onResume={pending} />)
      await userEvent.click(page.getByRole("button", { name: "Resume with Face ID" }))
      await expect.element(page.getByRole("button", { name: "Waiting for Face ID…" })).toBeDisabled()
    })

    it("resumes once Face ID passes", async () => {
      await render(<Running />)
      await userEvent.click(page.getByRole("button", { name: "Pause all" }))
      await press("Pause all agents")
      await userEvent.click(page.getByRole("button", { name: "Resume with Face ID" }))
      await expect.element(page.getByRole("button", { name: "Pause all" })).toBeVisible()
    })

    it("stays paused and says so when Face ID fails", async () => {
      await render(
        <KillSwitch paused agentCount={4} onPause={() => {}} onResume={() => Promise.reject(new Error("cancelled"))} />
      )
      await userEvent.click(page.getByRole("button", { name: "Resume with Face ID" }))
      await expect.element(page.getByText("Face ID didn't work, so they're still paused. Try again.")).toBeVisible()
      await expect.element(page.getByRole("button", { name: "Resume with Face ID" })).toBeEnabled()
    })
  })
})
