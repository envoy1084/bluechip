import { Carousel, CarouselContent, CarouselControls, CarouselItem } from "@bluechip/ui/components/carousel"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const AGENTS = ["Rebalancer", "Dip buyer", "Cash sweeper", "Your own"]

// Components are unstyled in tests: lay the track out inline, two slides in view.
const Templates = () => (
  <div style={{ width: 600 }}>
    <Carousel aria-label="Agent templates">
      <CarouselContent style={{ display: "flex" }}>
        {AGENTS.map((name, i) => (
          <CarouselItem key={name} aria-label={`${i + 1} of ${AGENTS.length}`} style={{ flex: "0 0 50%" }}>
            {name}
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselControls />
    </Carousel>
  </div>
)

const current = () =>
  page.getByRole("button", { name: /Go to slide/ }).elements().findIndex((dot) => dot.hasAttribute("aria-current"))

describe("Carousel", () => {
  it("pages with the arrows, one dot per resting position", async () => {
    await render(<Templates />)
    const previous = page.getByRole("button", { name: "Previous" })
    const next = page.getByRole("button", { name: "Next" })
    // Four slides, two in view: three places to rest.
    await expect.element(page.getByRole("button", { name: "Go to slide 3" })).toBeInTheDocument()
    await expect.element(page.getByRole("button", { name: "Go to slide 4" })).not.toBeInTheDocument()
    await expect.element(previous).toBeDisabled()

    await userEvent.click(next)
    await expect.element(page.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "true")
    await userEvent.click(next)
    await expect.element(next).toBeDisabled()
    await userEvent.click(previous)
    await expect.element(page.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "true")
    await userEvent.click(page.getByRole("button", { name: "Go to slide 1" }))
    await expect.element(previous).toBeDisabled()
    expect(current()).toBe(0)
  })

  it("pages with the arrow keys when the carousel has focus", async () => {
    await render(<Templates />)
    const region = page.getByRole("region", { name: "Agent templates" })
    await expect.element(page.getByRole("button", { name: "Go to slide 1" })).toHaveAttribute("aria-current", "true")
    region.element().focus()
    await expect.element(region).toHaveFocus()
    await userEvent.keyboard("{ArrowRight}")
    await expect.element(page.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "true")
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    await expect.element(page.getByRole("button", { name: "Go to slide 3" })).toHaveAttribute("aria-current", "true")
    await userEvent.keyboard("{ArrowLeft}")
    await expect.element(page.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "true")
  })
})
