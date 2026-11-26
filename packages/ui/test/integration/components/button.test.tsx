import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { HAPTIC_EVENT } from "@bluechip/ui/lib/haptics"
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("Button", () => {
  let played: Array<unknown> = []
  const listen = (event: Event) => played.push((event as CustomEvent).detail)
  beforeEach(() => {
    played = []
    window.addEventListener(HAPTIC_EVENT, listen)
  })
  afterEach(() => window.removeEventListener(HAPTIC_EVENT, listen))

  describe("without a haptic", () => {
    it("a press calls onClick", async () => {
      let presses = 0
      const screen = await render(<Button onClick={() => presses++}>Create agent</Button>)
      await userEvent.click(screen.getByRole("button", { name: "Create agent" }))
      expect(presses).toBe(1)
    })

    it("a press plays nothing", async () => {
      const screen = await render(<Button>Create agent</Button>)
      await userEvent.click(screen.getByRole("button", { name: "Create agent" }))
      expect(played).toEqual([])
    })
  })

  describe("with a haptic", () => {
    it("a press plays it", async () => {
      const screen = await render(<Button haptic="success">Approve</Button>)
      await userEvent.click(screen.getByRole("button", { name: "Approve" }))
      expect(played).toEqual(["success"])
    })

    it("a press still calls onClick", async () => {
      let presses = 0
      const screen = await render(<Button haptic="success" onClick={() => presses++}>Approve</Button>)
      await userEvent.click(screen.getByRole("button", { name: "Approve" }))
      expect(presses).toBe(1)
    })
  })

  describe("loading", () => {
    it("is disabled", async () => {
      const screen = await render(<Button loading>Approve</Button>)
      await expect.element(screen.getByRole("button", { name: "Approve" })).toBeDisabled()
    })

    it("reports busy", async () => {
      const screen = await render(<Button loading>Approve</Button>)
      await expect.element(screen.getByRole("button", { name: "Approve" })).toHaveAttribute("aria-busy", "true")
    })
  })

  it("disabled but not loading isn't busy", async () => {
    const screen = await render(<Button disabled>Approve</Button>)
    await expect.element(screen.getByRole("button", { name: "Approve" })).not.toHaveAttribute("aria-busy")
  })
})

describe("ButtonLink", () => {
  it("is a link to where it leads", async () => {
    const screen = await render(<ButtonLink href="/stocks">See all stocks</ButtonLink>)
    await expect.element(screen.getByRole("link", { name: "See all stocks" })).toHaveAttribute("href", "/stocks")
  })

  it("isn't a button", async () => {
    const screen = await render(<ButtonLink href="/stocks">See all stocks</ButtonLink>)
    await expect.element(screen.getByRole("button", { name: "See all stocks" })).not.toBeInTheDocument()
  })
})
