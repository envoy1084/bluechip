import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { TICKERS } from "@bluechip/ui/lib/tickers"

/** Every stock bluechip trades, drifting past under the hero. Hovering holds it; reduced motion keeps it still. */
export function TickerBand() {
  return (
    <section aria-label="The stocks you can trade" className="border-y border-g-100 bg-white py-4">
      <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] motion-reduce:overflow-x-auto">
        <div className="flex w-max animate-[landing-marquee_60s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {[false, true].map((copy) => (
            <ul key={String(copy)} aria-hidden={copy || undefined} className="flex shrink-0 gap-3 pr-3">
              {TICKERS.map((ticker) => (
                <li
                  key={ticker.symbol}
                  className="inline-flex items-center gap-2.5 rounded-md bg-g-50 py-1.5 pr-4 pl-1.5 shadow-[inset_0_0_0_1px_var(--color-g-100)]"
                >
                  <TickerChip symbol={ticker.symbol} />
                  <span className="text-label font-medium whitespace-nowrap text-g-700">{ticker.name}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  )
}
