import { StockRow } from "@bluechip/ui/bluechip/stock-row"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("StockRow", () => {
  it("a link, named by the stock, what's under it and its end", async () => {
    // The row fills the link with its text.
    // oxlint-disable-next-line jsx-a11y/control-has-associated-label, jsx-a11y/anchor-has-content
    const link = <a href="/stocks/AAPL" />
    const screen = await render(
      <StockRow symbol="AAPL" name="Apple" detail="$500.00 held" trailing="+1.20%" render={link} />
    )

    await expect.element(screen.getByRole("link", { name: /^AAPL ?Apple ?\$500\.00 held ?\+1\.20%$/ })).toHaveAttribute(
      "href",
      "/stocks/AAPL"
    )
  })
})
