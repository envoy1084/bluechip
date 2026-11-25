import { Skeleton } from "@bluechip/ui/components/skeleton"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("Skeleton", () => {
  it("without children, draws a block hidden from screen readers", async () => {
    const screen = await render(<Skeleton className="h-9 w-48" />)
    expect(screen.container.innerHTML).toMatch(
      /^<span data-slot="skeleton-block" aria-hidden="true" class="[^"]*h-9 w-48"><\/span>$/
    )
  })

  it("with children while loading, hides them", async () => {
    const screen = await render(
      <Skeleton loading>
        <button type="button">Add cash</button>
      </Skeleton>
    )
    await expect.element(screen.getByRole("button", { name: "Add cash" })).not.toBeInTheDocument()
  })

  it("with children once loaded, shows them", async () => {
    const screen = await render(
      <Skeleton loading={false}>
        <button type="button">Add cash</button>
      </Skeleton>
    )
    await expect.element(screen.getByRole("button", { name: "Add cash" })).toBeVisible()
  })
})
