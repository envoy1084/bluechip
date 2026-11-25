import { AllocationBar, capState } from "@bluechip/ui/bluechip/allocation-bar"
import { type MarketState, MarketStatus } from "@bluechip/ui/bluechip/market-status"
import { MoneyInput } from "@bluechip/ui/bluechip/money-input"
import { Price, PriceChange } from "@bluechip/ui/bluechip/price-change"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { StockRow } from "@bluechip/ui/bluechip/stock-row"
import { CASH_SYMBOL, TickerChip, TickerToggle } from "@bluechip/ui/bluechip/ticker-chip"
import { Button } from "@bluechip/ui/components/button"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney } from "@bluechip/ui/lib/format"
import { TICKERS } from "@bluechip/ui/lib/tickers"
import { type ReactNode, useState } from "react"
import { card, Section } from "./layout.tsx"
import { CAP, changeOf, CLOSES, FRIDAY_CLOSE, history, OPENS, type Quote, RESERVE, START, walk } from "./market.ts"

/* ---------- Market & money ---------- */

export function TickerSection({ prices }: { readonly prices: Readonly<Record<string, Quote>> }) {
  const [picked, setPicked] = useState<ReadonlyArray<string>>(["NVDA", "AAPL", "MSFT"])
  const tesla = prices["TSLA"] ?? START["TSLA"] as Quote
  return (
    <Section
      id="ticker-chip"
      title="Ticker chip"
      purpose="The stock's symbol in Doto, on its company's brand colors. The colors are fixed per stock everywhere in the app, so people learn them. Cash is the one neutral chip, with the USDC coin."
      notes={["Doto 800, 13 px, +5% tracking", "Sizes: 11 / 13 / 16 px", "Selectable chips are toggle buttons"]}
      states={[
        [
          "Sizes",
          <>
            <TickerChip symbol="NVDA" size="sm" />
            <TickerChip symbol="NVDA" />
            <TickerChip symbol="NVDA" size="lg" />
          </>
        ],
        ["With price", <TickerChip key="p" symbol="TSLA" price={tesla.price} change={changeOf(tesla)} />],
        ["Not on bluechip", <TickerChip key="n" symbol="AMD" unavailable />],
        ["Disabled", <TickerToggle key="d" symbol="SPCX" name="SpaceX" disabled />]
      ]}
    >
      <div className="grid w-full gap-[22px]">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
          {[...TICKERS, { symbol: CASH_SYMBOL, name: "Cash" }].map(({ symbol, name }) => (
            <div key={symbol} className="grid justify-items-start gap-1.5 rounded-md bg-white p-3 shadow-e1">
              <TickerChip symbol={symbol} size="lg" />
              <span className="text-label-sm text-g-600">{name}</span>
            </div>
          ))}
        </div>
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 text-[11.5px] font-semibold text-g-500">Stocks this agent can trade</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(START).map(([symbol, q]) => (
              <TickerToggle
                key={symbol}
                symbol={symbol}
                name={q.name}
                pressed={picked.includes(symbol)}
                onPressedChange={(on) => setPicked(on ? [...picked, symbol] : picked.filter((s) => s !== symbol))}
              />
            ))}
          </div>
          <p className={cn("text-label text-g-500", picked.length === 0 && "text-loss")}>
            {picked.length === 0 ?
              "Pick at least one stock." :
              `It can trade ${picked.length} stock${picked.length > 1 ? "s" : ""}: ${
                picked.map((s) => START[s]?.name).join(", ")
              }.`}
          </p>
        </fieldset>
      </div>
    </Section>
  )
}

export function PriceSection(
  { quote, onTick }: { readonly quote: Quote; readonly onTick: (direction: 1 | -1) => void }
) {
  const msft = START["MSFT"] as Quote, amzn = START["AMZN"] as Quote, googl = START["GOOGL"] as Quote
  return (
    <Section
      id="price"
      title="Price and change"
      purpose="Price in tabular figures, change in green or red with an arrow and a sign, never color alone. A new price flashes in the direction it moved."
      notes={["Change vs. last close", "Flat shows a dash and 0.00%", "Flash: gain or loss wash, fades over 900 ms"]}
      states={[
        ["Up", <Price key="u" price={msft.price} change={changeOf(msft)} />],
        ["Down", <Price key="d" price={amzn.price} change={changeOf(amzn)} />],
        ["Flat", <Price key="f" price={googl.price} change={changeOf(googl)} />],
        ["Small · stacked in a row", <Price key="s" price={612.3} change={1.19} size="sm" layout="stacked" />],
        ["Large · with amount", <Price key="l" price={12269.4} change={1.83} changeAmount={220.4} size="lg" />],
        ["Change alone", <PriceChange key="c" value={-0.6} size="lg" />]
      ]}
    >
      <div className="grid justify-items-center gap-[22px]">
        <div className="flex items-center gap-4 text-left">
          <TickerChip symbol="NVDA" size="lg" />
          <div className="grid gap-1">
            <span className="flex items-center gap-1.5 text-label-sm text-g-500">
              Nvidia
            </span>
            <Price price={quote.price} change={changeOf(quote)} size="xl" />
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onTick(1)}>
            <Icon name="arrow-up" size={14} />Tick up
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onTick(-1)}>
            <Icon name="arrow-down" size={14} />Tick down
          </Button>
        </div>
      </div>
    </Section>
  )
}

export function MoneySection({ cash, nvidia }: { readonly cash: number; readonly nvidia: number }) {
  return (
    <Section
      id="money-input"
      title="Money input"
      purpose="How much cash (USDC) to use. Formats as you type, shows what it buys, and explains every error in plain words. Max fills what you can spend."
      notes={["Large 32 px figures, tabular", "Max fills all your cash", "Errors say what to do next"]}
      states={[
        ["Empty", <MoneyInput key="e" size="md" label="Amount" showMax={false} available={cash} />],
        [
          "Over your cash",
          <MoneyInput key="c" size="md" label="Amount" showMax={false} available={cash} defaultValue={2000} />
        ],
        [
          "Over the agent's ask-me amount",
          <MoneyInput
            key="w"
            size="md"
            label="Amount"
            showMax={false}
            available={cash}
            approvalAbove={500}
            defaultValue={600}
          />
        ],
        ["USDC", <MoneyInput key="u" size="md" label="Send" currency="usdc" available={cash} defaultValue={250} />],
        [
          "Disabled · market closed",
          <MoneyInput
            key="d"
            size="md"
            label="Amount"
            showMax={false}
            defaultValue={250}
            disabled
            disabledReason="Buying opens Monday at 09:30 New York time."
          />
        ]
      ]}
    >
      <div className={cn(card, "max-w-[440px] rounded-xl p-5")}>
        <MoneyInput
          label="Buy Nvidia with"
          description={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Cash (USDC) · {formatMoney(cash)} available
            </span>
          }
          available={cash}
          approvalAbove={500}
          defaultValue={250}
          quickAmounts={[50, 100, 250, 500]}
          hint={(amount) =>
            `About ${(amount / nvidia).toFixed(3)} shares at ${
              formatMoney(nvidia)
            }. Price checked: within 1% of the market price.`}
        />
      </div>
    </Section>
  )
}

export function SparklineSection({ prices }: { readonly prices: Readonly<Record<string, Quote>> }) {
  const q = (symbol: string) => prices[symbol] ?? START[symbol] as Quote
  return (
    <Section
      id="sparkline"
      title="Sparkline"
      purpose="A day's shape in a glance. Green when up, red when down, grey when flat, with a dot on the latest price. A dashed tail means the market is closed and the price is the last close."
      notes={["1.6 px stroke, round joins", "Endpoint dot 2.6 px with white ring", "Optional area fill at 16%"]}
      states={[
        ["64 × 20", <Sparkline key="a" values={history("MSFT", q("MSFT"))} width={64} height={20} />],
        ["96 × 28 · area", <Sparkline key="b" values={history("META", q("META"))} area />],
        ["Market closed", <Sparkline key="c" values={history("TSLA", q("TSLA"))} closedFrom={24} />],
        [
          "Brand · no tone",
          <Sparkline key="d" values={walk("brand", 32, 10, 14, 0.25)} width={120} height={32} tone="brand" area />
        ]
      ]}
    >
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {["NVDA", "AMZN", "GOOGL"].map((symbol) => (
          <div key={symbol} className="grid justify-items-start gap-2.5 rounded-lg bg-white p-3.5 shadow-e2">
            <TickerChip symbol={symbol} />
            <Sparkline
              values={history(symbol, q(symbol))}
              width={160}
              height={44}
              className="h-11 w-full"
              preserveAspectRatio="none"
            />
            <Price price={q(symbol).price} change={changeOf(q(symbol))} size="sm" />
          </div>
        ))}
      </div>
    </Section>
  )
}

export function AllocationBarSection() {
  const [nvidia, setNvidia] = useState(24)
  const state = capState(nvidia, CAP)
  return (
    <Section
      id="allocation-bar"
      title="Allocation bar with cap"
      purpose="How much of your money is in one stock, against your max. The black tick is your limit. Prices can push a stock over it; agents then stop buying it, but nothing is sold for you."
      notes={[
        "Under: blue · At (within 1%): amber · Over: red past the tick",
        "Scale is 0 to 100% of your money",
        "Label always states both numbers"
      ]}
      states={[
        ["Under", <Stacked key="u" bar={<AllocationBar weight={22} cap={CAP} size="md" />} text="22% · max 30%" />],
        [
          "At your max",
          <Stacked
            key="a"
            bar={<AllocationBar weight={29.6} cap={CAP} size="md" />}
            text="29.6% · at your max"
            tone="text-warn"
          />
        ],
        [
          "Over · prices moved",
          <Stacked
            key="o"
            bar={<AllocationBar weight={36} cap={CAP} size="md" />}
            text="36% · 6% over your max"
            tone="text-loss"
          />
        ],
        [
          "Cash reserve",
          <Stacked
            key="c"
            bar={<AllocationBar weight={12.2} cap={RESERVE} cash size="md" />}
            text="12.2% · keep at least 10%"
          />
        ]
      ]}
    >
      <div className={cn(card, "grid max-w-[520px] gap-3.5 p-5")}>
        <div className="flex items-center gap-3">
          <TickerChip symbol="NVDA" />
          <div className="grid min-w-0 flex-1 gap-1">
            <b className="text-[15px]">Nvidia</b>
            <span className="text-label-sm text-g-500">
              {state === "under" ?
                `Room for ${formatMoney(((CAP - nvidia) / 100) * 12269)} more before your max` :
                state === "at" ?
                "At your max. Agents won't buy more Nvidia." :
                `${
                  (nvidia - CAP).toFixed(1)
                }% over your max because the price rose. Agents won't buy more; nothing is sold for you.`}
            </span>
          </div>
          <span
            className={cn(
              "text-[24px] font-semibold tracking-[-0.03em] tabular-nums",
              state === "under" ? "text-blue" : state === "at" ? "text-[#b88400]" : "text-loss"
            )}
          >
            {nvidia.toFixed(1)}%
          </span>
        </div>
        <AllocationBar weight={nvidia} cap={CAP} size="lg" label="Nvidia" />
        <div className="relative flex h-[18px] justify-between text-[11.5px] text-g-500 tabular-nums">
          <span>0%</span>
          <span className="absolute left-[30%] -translate-x-1/2 font-semibold whitespace-nowrap text-ink">
            Your max 30%
          </span>
          <span>100%</span>
        </div>
        <label className="grid gap-1.5">
          <span className="text-label-sm text-g-600">Try a weight</span>
          <input
            type="range"
            min={0}
            max={50}
            step={0.5}
            value={nvidia}
            onChange={(event) => setNvidia(Number(event.currentTarget.value))}
            className="w-full accent-blue"
          />
        </label>
      </div>
    </Section>
  )
}

function Stacked({ bar, text, tone }: { readonly bar: ReactNode; readonly text: string; readonly tone?: string }) {
  return (
    <div className="grid w-full gap-1.5">
      {bar}
      <span className={cn("text-label-sm text-g-500", tone)}>{text}</span>
    </div>
  )
}

export function StockList(
  { prices, market }: { readonly prices: Readonly<Record<string, Quote>>; readonly market: "open" | "closed" }
) {
  const [selected, setSelected] = useState("NVDA")
  return (
    <div className={cn(card, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-g-100 px-4 py-[13px]">
        <b className="text-body-sm font-semibold">Stocks on bluechip</b>
        <MarketStatus state={market} closesAt={CLOSES} opensAt={OPENS} />
      </div>
      {["NVDA", "AAPL", "TSLA", "MSFT", "MSTR", "SPCX"].map((symbol) => {
        const q = prices[symbol] ?? START[symbol] as Quote
        return (
          <StockRow
            key={symbol}
            symbol={symbol}
            name={q.name}
            price={q.price}
            change={changeOf(q)}
            history={history(symbol, q)}
            market={symbol === "SPCX" ? "halted" : market}
            closedFrom={26}
            selected={selected === symbol}
            onClick={() => setSelected(symbol)}
          />
        )
      })}
    </div>
  )
}

const MARKET_COPY: Readonly<Record<MarketState, string>> = {
  open: "Prices are live. Your agents trade within their limits until 16:00 New York time.",
  closed: "Prices pause at today's close. Your agents start buying again at 09:30 New York time.",
  weekend: "Prices show Friday's close. Your agents start buying again Monday at 09:30 New York time.",
  halted: "The exchange paused SpaceX. bluechip shows the last price and no one can trade it until trading resumes."
}

export function MarketSection({ live }: { readonly live: "open" | "closed" }) {
  const [state, setState] = useState<MarketState>("open")
  const pill = (s: MarketState) => (
    <MarketStatus state={s} closesAt={CLOSES} opensAt={OPENS} lastClose={FRIDAY_CLOSE} symbol="SPCX" />
  )
  return (
    <Section
      id="market-status"
      title="Market status pill"
      purpose="Whether US stocks are trading right now, and what that means for your agents. Shown on home, on every stock and in chat when it matters."
      notes={[
        "Open pulses gently (2.4 s)",
        "Closed and weekend say when it opens or last closed",
        "Halted is per stock, amber"
      ]}
      states={[
        ["Open", pill("open")],
        ["Closed", pill("closed")],
        ["Weekend", pill("weekend"), true],
        ["Halted", pill("halted")],
        ["Live · demo controls", pill(live)]
      ]}
    >
      <div className="grid justify-items-center gap-[22px]">
        <ToggleGroup
          aria-label="Market state"
          size="sm"
          value={[state]}
          onValueChange={(next) => next[0] !== undefined && setState(next[0] as MarketState)}
        >
          <ToggleGroupItem value="open">Open</ToggleGroupItem>
          <ToggleGroupItem value="closed">Closed</ToggleGroupItem>
          <ToggleGroupItem value="weekend">Weekend</ToggleGroupItem>
          <ToggleGroupItem value="halted">Halted</ToggleGroupItem>
        </ToggleGroup>
        <div className={cn(card, "grid max-w-[440px] justify-items-center gap-3 p-5 text-center")}>
          {pill(state)}
          <p className="text-body-sm">{MARKET_COPY[state]}</p>
        </div>
      </div>
    </Section>
  )
}
