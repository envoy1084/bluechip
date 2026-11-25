import {
  Carousel,
  CarouselContent,
  CarouselControls,
  CarouselItem,
  carouselKeyDirection
} from "@bluechip/ui/components/carousel"
import { assert, describe, expect, it } from "@effect/vitest"
import type { ReactNode } from "react"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const AGENTS = ["Rebalancer", "Dip buyer", "Cash sweeper", "Your own"]

// Components are unstyled in tests: lay the track out inline, two slides in view, so four slides rest in three places.
const Templates = ({ children }: { readonly children?: ReactNode }) => (
  <div style={{ width: 600 }}>
    <Carousel aria-label="Agent templates">
      <CarouselContent style={{ display: "flex" }}>
        {AGENTS.map((name, i) => (
          <CarouselItem key={name} aria-label={`${i + 1} of ${AGENTS.length}`} style={{ flex: "0 0 50%" }}>
            {name}
            {i === 0 && children}
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselControls />
    </Carousel>
  </div>
)

const dot = (n: number) => page.getByRole("button", { name: `Go to slide ${n}` })

const focusRegion = async () => {
  const region = page.getByRole("region", { name: "Agent templates" })
  // Embla measures the slides after mount; wait for its dots before the first key.
  await expect.element(dot(1)).toBeInTheDocument()
  region.element().focus()
  await expect.element(region).toHaveFocus()
}

describe("carouselKeyDirection", () => {
  it("horizontal, ArrowRight: next", () => {
    assert.strictEqual(carouselKeyDirection("horizontal", "ArrowRight"), "next")
  })

  it("horizontal, ArrowLeft: previous", () => {
    assert.strictEqual(carouselKeyDirection("horizontal", "ArrowLeft"), "previous")
  })

  it("horizontal, ArrowDown: no paging", () => {
    assert.strictEqual(carouselKeyDirection("horizontal", "ArrowDown"), undefined)
  })

  it("vertical, ArrowDown: next", () => {
    assert.strictEqual(carouselKeyDirection("vertical", "ArrowDown"), "next")
  })

  it("vertical, ArrowUp: previous", () => {
    assert.strictEqual(carouselKeyDirection("vertical", "ArrowUp"), "previous")
  })

  it("vertical, ArrowRight: no paging", () => {
    assert.strictEqual(carouselKeyDirection("vertical", "ArrowRight"), undefined)
  })

  it("a key that isn't an arrow: no paging", () => {
    assert.strictEqual(carouselKeyDirection("horizontal", "Enter"), undefined)
  })
})

describe("Carousel", () => {
  it("shows one dot per resting position, not per slide", async () => {
    await render(<Templates />)
    await expect.element(dot(3)).toBeInTheDocument()
    await expect.element(dot(4)).not.toBeInTheDocument()
  })

  it("starts on the first position with Previous disabled", async () => {
    await render(<Templates />)
    await expect.element(dot(1)).toHaveAttribute("aria-current", "true")
    await expect.element(page.getByRole("button", { name: "Previous" })).toBeDisabled()
  })

  it("Next moves to the next position", async () => {
    await render(<Templates />)
    await userEvent.click(page.getByRole("button", { name: "Next" }))
    await expect.element(dot(2)).toHaveAttribute("aria-current", "true")
  })

  it("Previous moves back a position", async () => {
    await render(<Templates />)
    await userEvent.click(dot(3))
    await userEvent.click(page.getByRole("button", { name: "Previous" }))
    await expect.element(dot(2)).toHaveAttribute("aria-current", "true")
  })

  it("Next is disabled on the last position", async () => {
    await render(<Templates />)
    await userEvent.click(dot(3))
    await expect.element(page.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("a dot jumps to its position", async () => {
    await render(<Templates />)
    await userEvent.click(dot(3))
    await expect.element(dot(3)).toHaveAttribute("aria-current", "true")
  })

  it("ArrowRight on the focused carousel pages forward", async () => {
    await render(<Templates />)
    await focusRegion()
    await userEvent.keyboard("{ArrowRight}")
    await expect.element(dot(2)).toHaveAttribute("aria-current", "true")
  })

  it("ArrowLeft on the focused carousel pages back", async () => {
    await render(<Templates />)
    await userEvent.click(dot(3))
    await focusRegion()
    await userEvent.keyboard("{ArrowLeft}")
    await expect.element(dot(2)).toHaveAttribute("aria-current", "true")
  })

  it("arrow keys typed in a field inside a slide don't page", async () => {
    await render(
      <Templates>
        <input aria-label="Agent name" />
      </Templates>
    )
    await expect.element(dot(1)).toHaveAttribute("aria-current", "true")
    await userEvent.click(page.getByRole("textbox", { name: "Agent name" }))
    await userEvent.keyboard("{ArrowRight}")
    await expect.element(dot(1)).toHaveAttribute("aria-current", "true")
  })
})
