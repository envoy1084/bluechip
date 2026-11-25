import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from "@bluechip/ui/components/combobox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@bluechip/ui/components/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@bluechip/ui/components/select"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { type Stock, STOCKS, usd } from "./data.ts"
import { Demo, Section, Ticker } from "./layout.tsx"

/* ---------- Pickers ---------- */

export function StockOption({ stock }: { readonly stock: Stock }) {
  return (
    <>
      <Ticker symbol={stock.value} />
      <span>{stock.name}</span>
      <span className="ml-auto pl-2 text-label-sm font-normal text-g-500 tabular-nums">{usd.format(stock.price)}</span>
    </>
  )
}

export function SelectSection() {
  const repeats = ["Every day", "Every week", "Every 2 weeks", "Every month"]
  return (
    <Section
      title="Select"
      purpose="Pick one value from a list that opens on click. Type a letter to jump."
      base="Select"
    >
      <Demo>
        <FieldGroup className="w-full">
          <Field>
            <Select<string>>
              <SelectLabel>Stock to buy</SelectLabel>
              <SelectTrigger>
                <SelectValue>
                  {(value: string | null) => {
                    const stock = STOCKS.find((s) => s.value === value)
                    return stock ?
                      (
                        <>
                          <Ticker symbol={stock.value} />
                          {stock.name}
                        </>
                      ) :
                      <span className="text-g-400">Choose a stock</span>
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectGroupLabel>Popular</SelectGroupLabel>
                  {STOCKS.slice(0, 5).map((stock) => (
                    <SelectItem key={stock.value} value={stock.value}>
                      <StockOption stock={stock} />
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectGroupLabel>More stocks</SelectGroupLabel>
                  {STOCKS.slice(5).map((stock) => (
                    <SelectItem key={stock.value} value={stock.value}>
                      <StockOption stock={stock} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Select<string> defaultValue="Every week">
              <SelectLabel>Repeat</SelectLabel>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {repeats.map((repeat) => <SelectItem key={repeat} value={repeat}>{repeat}</SelectItem>)}
                <SelectItem value="Every hour" disabled>Every hour (not allowed)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field invalid>
            <Select<string>>
              <SelectLabel className="text-loss">With an error</SelectLabel>
              <SelectTrigger>
                <SelectValue placeholder="Choose a stock" />
              </SelectTrigger>
              <SelectContent>
                {STOCKS.map((stock) => <SelectItem key={stock.value} value={stock.value}>{stock.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldError match>Choose the stock to buy.</FieldError>
          </Field>
          <Field disabled>
            <Select<string> items={STOCKS} defaultValue="NVDA" disabled>
              <SelectLabel className="text-g-400">Disabled</SelectLabel>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCKS.map((stock) => <SelectItem key={stock.value} value={stock.value}>{stock.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </Demo>
    </Section>
  )
}

export function ComboboxSection() {
  const [added, setAdded] = useState<Stock | null>(null)
  return (
    <Section
      title="Combobox"
      purpose="Search a long list as you type, then pick. Keyboard first: arrows, Enter, Esc."
      base="Combobox"
    >
      <Demo>
        <Field className="w-full max-w-[380px]">
          <Combobox items={STOCKS} onValueChange={(stock: Stock | null) => setAdded(stock)}>
            <FieldLabel>Add a stock to this agent</FieldLabel>
            <ComboboxInput placeholder="Search 13 stocks" />
            <ComboboxContent>
              <ComboboxEmpty>No stock matches that. bluechip has 13 stocks for now.</ComboboxEmpty>
              <ComboboxList>
                {(stock: Stock) => (
                  <ComboboxItem key={stock.value} value={stock}>
                    <StockOption stock={stock} />
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {added ?
            (
              <output className="flex items-center gap-1.5 text-label-sm text-gain">
                <Icon name="check-circle" size={14} />
                {added.name} added. The agent can now trade {added.value}.
              </output>
            ) :
            <FieldDescription>Try “ap”, “tesla” or something that isn't there.</FieldDescription>}
        </Field>
      </Demo>
    </Section>
  )
}
