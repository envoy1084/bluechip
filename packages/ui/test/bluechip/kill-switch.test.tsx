import { KillSwitch } from "@bluechip/ui/bluechip/kill-switch"
import { describe, expect, it } from "@effect/vitest"
import { useState } from "react"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

function Harness({ onResume }: { readonly onResume: () => Promise<void> }) {
  const [paused, setPaused] = useState(false)
  return (
    <KillSwitch
      paused={paused}
      agentCount={4}
      onPause={() => setPaused(true)}
      onResume={() => onResume().then(() => setPaused(false))}
    />
  )
}

// Base UI's scroll lock keeps Playwright from clicking inside the open dialog in the test iframe, so its buttons are
// pressed from the keyboard, which is just as real.
const press = async (name: string) => {
  page.getByRole("button", { name }).element().focus()
  await userEvent.keyboard("{Enter}")
}

describe("KillSwitch", () => {
  it("pauses only after you confirm", async () => {
    await render(<Harness onResume={() => Promise.resolve()} />)
    await userEvent.click(page.getByRole("button", { name: "Pause all" }))
    await expect.element(page.getByRole("alertdialog", { name: "Pause all 4 agents?" })).toBeVisible()
    await press("Cancel")
    await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument()
    await expect.element(page.getByText("All agents are paused")).not.toBeInTheDocument()

    await userEvent.click(page.getByRole("button", { name: "Pause all" }))
    await press("Pause all agents")
    await expect.element(page.getByText("All agents are paused")).toBeVisible()
  })

  it("resumes through the Face ID callback", async () => {
    let asked = 0
    await render(
      <Harness
        onResume={() => {
          asked++
          return Promise.resolve()
        }}
      />
    )
    await userEvent.click(page.getByRole("button", { name: "Pause all" }))
    await press("Pause all agents")
    await userEvent.click(page.getByRole("button", { name: "Resume with Face ID" }))
    await expect.element(page.getByRole("button", { name: "Pause all" })).toBeVisible()
    expect(asked).toBe(1)
  })

  it("stays paused when Face ID fails", async () => {
    await render(<Harness onResume={() => Promise.reject(new Error("cancelled"))} />)
    await userEvent.click(page.getByRole("button", { name: "Pause all" }))
    await press("Pause all agents")
    await userEvent.click(page.getByRole("button", { name: "Resume with Face ID" }))
    await expect.element(page.getByText("Face ID didn't work, so they're still paused. Try again.")).toBeVisible()
  })
})
