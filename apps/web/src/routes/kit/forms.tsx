import { Button } from "@bluechip/ui/components/button"
import { ButtonGroup, ButtonGroupText } from "@bluechip/ui/components/button-group"
import { Checkbox } from "@bluechip/ui/components/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from "@bluechip/ui/components/combobox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Form
} from "@bluechip/ui/components/field"
import { Input } from "@bluechip/ui/components/input"
import { InputGroup, InputGroupInput, InputGroupText, InputGroupToken } from "@bluechip/ui/components/input-group"
import { InputOTP, InputOTPSeparator, InputOTPSlot } from "@bluechip/ui/components/input-otp"
import { Kbd } from "@bluechip/ui/components/kbd"
import { Label } from "@bluechip/ui/components/label"
import {
  RadioCard,
  RadioCardContent,
  RadioCardIcon,
  RadioGroup,
  RadioGroupItem
} from "@bluechip/ui/components/radio-group"
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
import { Slider } from "@bluechip/ui/components/slider"
import { Switch } from "@bluechip/ui/components/switch"
import { Textarea } from "@bluechip/ui/components/textarea"
import { Toggle } from "@bluechip/ui/components/toggle"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactNode, useId, useState } from "react"

export const Route = createFileRoute("/kit/forms")({ component: KitForms })

/* ---------- Example data from bluechip's world ---------- */

interface Stock {
  readonly value: string
  readonly label: string
  readonly name: string
  readonly price: number
}

const STOCKS: ReadonlyArray<Stock> = [
  ["NVDA", "Nvidia", 181.42],
  ["AAPL", "Apple", 241.18],
  ["MSFT", "Microsoft", 455.6],
  ["META", "Meta", 612.3],
  ["TSLA", "Tesla", 352.75],
  ["GOOGL", "Alphabet", 178.9],
  ["AMZN", "Amazon", 214.36],
  ["MSTR", "Strategy", 318.2],
  ["SNDK", "Sandisk", 64.85],
  ["SPCX", "SpaceX", 98.4]
].map(([value, name, price]) => ({
  value: String(value),
  name: String(name),
  label: `${value} · ${name}`,
  price: Number(price)
}))

const TEMPLATES: ReadonlyArray<
  { readonly id: string; readonly name: string; readonly icon: IconName; readonly say: string }
> = [
  {
    id: "rebalancer",
    name: "Rebalancer",
    icon: "scales",
    say: "Keeps your mix on target. Only rebalances, never adds cash."
  },
  {
    id: "stock-picker",
    name: "Stock picker",
    icon: "target",
    say: "Buys from a short list you choose, inside your limits."
  },
  {
    id: "weekly-buyer",
    name: "Weekly buyer",
    icon: "calendar",
    say: "Buys the same amount every week, on the day you pick."
  },
  {
    id: "stop-loss",
    name: "Stop-loss guard",
    icon: "shield",
    say: "Sells a stock when it falls past the line you set."
  }
]

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const USD_WHOLE = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const
const PERCENT = { style: "unit", unit: "percent" } as const

/* ---------- Page scaffolding (mirrors the brand kit's section layout) ---------- */

const TICKER_TONE: Readonly<Record<string, string>> = {
  NVDA: "bg-[linear-gradient(180deg,#7ad61a,#66c800)] text-[#0c2a00]",
  AAPL: "bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white",
  MSFT: "bg-[linear-gradient(180deg,#62a2ff,#3c8aff)] text-[#00163d]",
  TSLA: "bg-[linear-gradient(180deg,#ffbdd9,#fea8cd)] text-[#4a0f2a]",
  GOOGL: "bg-[linear-gradient(180deg,#ffdc5c,#ffd12f)] text-[#3a2c00]",
  AMZN: "bg-[linear-gradient(180deg,#cbb995,#b8a581)] text-[#2a2111]",
  MSTR: "bg-[linear-gradient(180deg,#dcaefe,#cd99fd)] text-[#2c0a4d]",
  SPCX: "bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white"
}

function Ticker({ symbol }: { readonly symbol: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] px-1.5 pt-[3px] pb-0.5 font-pixel text-caption-sm font-extrabold tracking-[.05em] shadow-[inset_0_1px_0_rgba(255,255,255,.3)]",
        TICKER_TONE[symbol] ?? "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] text-white"
      )}
    >
      {symbol}
    </span>
  )
}

function Group({ n, title, children }: { readonly n: string; readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="pt-10">
      <div className="flex items-baseline gap-3.5 pb-2">
        <span className="text-label font-semibold text-blue">{n}</span>
        <h2 className="text-[clamp(24px,3vw,30px)] font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Section(
  { title, purpose, base, children }: {
    readonly title: string
    readonly purpose: string
    readonly base: string
    readonly children: ReactNode
  }
) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-ink/7 pt-9 pb-10">
      <header className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-4">
        <div>
          <h3 id={id} className="text-[19px] leading-tight font-semibold tracking-[-0.02em]">{title}</h3>
          <p className="mt-1 max-w-[64ch] text-body-sm text-g-600">{purpose}</p>
        </div>
        <span className="shrink-0 rounded-full bg-g-50 px-[9px] py-[3px] text-[11.5px] font-[550] whitespace-nowrap text-g-500 shadow-[inset_0_0_0_1px_var(--color-g-200)]">
          {base}
        </span>
      </header>
      {children}
    </section>
  )
}

function Demo(
  { label, className, children }: { readonly label?: string; readonly className?: string; readonly children: ReactNode }
) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-wrap items-center gap-3.5 rounded-lg bg-white p-5 shadow-e1 sm:p-7",
        label && "pt-[42px] sm:pt-12",
        className
      )}
    >
      {label && <span className="absolute top-3.5 left-4 text-[11.5px] font-[550] text-g-500">{label}</span>}
      {children}
    </div>
  )
}

function States({ items }: { readonly items: ReadonlyArray<readonly [string, ReactNode]> }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(118px,1fr))]">
      {items.map(([label, node]) => (
        <li
          key={label}
          className="grid min-w-0 justify-items-center gap-2 rounded-md bg-g-50 px-2.5 pt-4 pb-2.5 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]"
        >
          <div className="grid min-h-10 w-full place-items-center">{node}</div>
          <span className="text-[11.5px] font-[550] text-g-500">{label}</span>
        </li>
      ))}
    </ul>
  )
}

// Static state samples are pictures of a state, so they stay out of the tab order.
const sample = { tabIndex: -1 } as const
const hoverRing = "[--field-ring:rgba(10,11,13,.2)]"
const focusRing = "shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42, 91, 255,.12)]"
const focusOutline = "outline-2 outline-offset-2 outline-blue"

/* ---------- Page ---------- */

function KitForms() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">Interface</span>
        <h1 className="text-display-3 font-semibold">Inputs & forms</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          Every control for entering and choosing: text, codes, amounts, choices and ranges, with each state they can be
          in. Labels are always visible; errors say what to do next.
        </p>
      </div>
      <Group n="01" title="Actions">
        <ButtonGroupSection />
        <ToggleSection />
        <ToggleGroupSection />
      </Group>
      <Group n="02" title="Inputs & forms">
        <InputSection />
        <InputGroupSection />
        <InputOTPSection />
        <TextareaSection />
        <LabelSection />
        <FieldSection />
        <CheckboxSection />
        <RadioGroupSection />
        <SwitchSection />
        <SliderSection />
        <SelectSection />
        <ComboboxSection />
      </Group>
    </div>
  )
}

/* ---------- Actions ---------- */

function ButtonGroupSection() {
  const [maxPerTrade, setMaxPerTrade] = useState(250)
  const step = (by: number) => setMaxPerTrade((v) => Math.min(1000, Math.max(25, v + by)))
  return (
    <Section
      title="Button group"
      purpose="Joins related buttons into one control so they read as a set."
      base="ButtonGroup"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <ButtonGroup aria-label="Agent actions" className="rounded-sm">
          <Button variant="secondary" size="sm">
            <Icon name="edit" size={16} />Edit
          </Button>
          <Button variant="secondary" size="sm">
            <Icon name="pause" size={16} />Pause
          </Button>
          <Button variant="secondary" size="sm">
            <Icon name="share" size={16} />Share
          </Button>
        </ButtonGroup>
        <ButtonGroup aria-label="Deposit">
          <Button>
            <Icon name="plus" size={16} />Deposit cash
          </Button>
          <Button size="icon" aria-label="More ways to add cash">
            <Icon name="chevron-down" size={16} />
          </Button>
        </ButtonGroup>
        <ButtonGroup aria-label="Max per trade">
          <Button variant="secondary" size="icon" aria-label="Lower by $25" onClick={() => step(-25)}>
            <Icon name="minus" size={18} />
          </Button>
          <ButtonGroupText aria-live="polite">{usd.format(maxPerTrade).replace(".00", "")}</ButtonGroupText>
          <Button variant="secondary" size="icon" aria-label="Raise by $25" onClick={() => step(25)}>
            <Icon name="plus" size={18} />
          </Button>
        </ButtonGroup>
        <ButtonGroup orientation="vertical" aria-label="Sort holdings" className="rounded-sm">
          <Button variant="secondary" size="sm">By value</Button>
          <Button variant="secondary" size="sm">By change</Button>
          <Button variant="secondary" size="sm">A to Z</Button>
        </ButtonGroup>
      </Demo>
    </Section>
  )
}

function ToggleSection() {
  return (
    <Section title="Toggle" purpose="A two-state button for a view preference, like hiding balances." base="Toggle">
      <Demo>
        <Toggle>
          <Icon name="eye-off" size={16} />Hide balances
        </Toggle>
        <Toggle defaultPressed>
          <Icon name="chart-line" size={16} />Show in %
        </Toggle>
        <Toggle variant="outline" aria-label="Star NVDA">
          <Icon name="star" size={16} />
        </Toggle>
        <Toggle variant="outline" size="sm" defaultPressed aria-label="Notifications on">
          <Icon name="bell" size={16} />
        </Toggle>
      </Demo>
      <States
        items={[
          [
            "Off",
            <Toggle key="off" {...sample}>
              <Icon name="eye-off" size={16} />Off
            </Toggle>
          ],
          [
            "On",
            <Toggle key="on" pressed {...sample}>
              <Icon name="eye" size={16} />On
            </Toggle>
          ],
          [
            "Hover",
            <Toggle key="hover" className="bg-g-100 text-ink" {...sample}>
              <Icon name="eye-off" size={16} />Hover
            </Toggle>
          ],
          [
            "Focus",
            <Toggle key="focus" className={focusOutline} {...sample}>
              <Icon name="eye-off" size={16} />Focus
            </Toggle>
          ],
          [
            "Disabled",
            <Toggle key="disabled" disabled>
              <Icon name="eye-off" size={16} />Disabled
            </Toggle>
          ]
        ]}
      />
    </Section>
  )
}

function ToggleGroupSection() {
  return (
    <Section
      title="Toggle group"
      purpose="Pick one or several options from a short set. Arrow keys move between them."
      base="ToggleGroup"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <div className="grid min-w-0 gap-2">
          <span className="text-[13.5px] font-[550]">Time range</span>
          <ToggleGroup aria-label="Time range" size="sm" defaultValue={["1M"]}>
            {["1D", "1W", "1M", "3M", "1Y", "All"].map((range) => (
              <ToggleGroupItem key={range} value={range}>{range}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid min-w-0 gap-2">
          <span className="text-[13.5px] font-[550]">Weekly buyer runs on</span>
          <ToggleGroup
            aria-label="Days"
            multiple
            variant="outline"
            size="sm"
            defaultValue={["Mon", "Thu"]}
            className="flex-wrap"
          >
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <ToggleGroupItem key={day} value={day}>{day}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid min-w-0 gap-2">
          <span className="text-[13.5px] font-[550]">Disabled</span>
          <ToggleGroup aria-label="Chart type" size="sm" defaultValue={["Area"]} disabled>
            {["Area", "Line", "Bars"].map((kind) => <ToggleGroupItem key={kind} value={kind}>{kind}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </Demo>
    </Section>
  )
}

/* ---------- Inputs ---------- */

function InputSection() {
  return (
    <Section title="Input" purpose="Single-line text entry. Pair it with a label, always." base="Input">
      <Demo>
        <FieldGroup className="w-full">
          <Field>
            <FieldLabel>Agent name</FieldLabel>
            <Input placeholder="e.g. Rebalancer" />
          </Field>
          <Field invalid>
            <FieldLabel>Email for receipts</FieldLabel>
            <Input type="email" defaultValue="alex@" />
            <FieldError match>Add the part after the @, like alex@mail.com.</FieldError>
          </Field>
          <Field>
            <FieldLabel>Search</FieldLabel>
            <InputGroup>
              <Icon name="search" size={16} />
              <InputGroupInput type="search" placeholder="Stocks, agents, activity" />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel>Statement (PDF)</FieldLabel>
            <Input type="file" accept="application/pdf" />
          </Field>
        </FieldGroup>
      </Demo>
      <States
        items={[
          ["Default", <Input key="default" placeholder="Placeholder" aria-label="Default" {...sample} />],
          [
            "Hover",
            <Input key="hover" placeholder="Placeholder" aria-label="Hover" className={hoverRing} {...sample} />
          ],
          [
            "Focus",
            <Input key="focus" defaultValue="Rebalancer" aria-label="Focus" className={focusRing} {...sample} />
          ],
          ["Error", <Input key="error" defaultValue="-40" aria-label="Error" aria-invalid {...sample} />],
          ["Disabled", <Input key="disabled" defaultValue="Weekly buyer" aria-label="Disabled" disabled />],
          ["Read-only", <Input key="readonly" defaultValue="0x4f…a91c" aria-label="Read-only" readOnly {...sample} />]
        ]}
      />
      <Demo label="Sizes">
        <div className="grid w-full max-w-[280px] gap-3">
          <Input size="sm" placeholder="Small · 32px" aria-label="Small input" />
          <Input placeholder="Medium · 38px" aria-label="Medium input" />
          <Input size="lg" placeholder="Large · 46px" aria-label="Large input" />
        </div>
      </Demo>
    </Section>
  )
}

const WALLET = 1240.5

function InputGroupSection() {
  const [amount, setAmount] = useState("")
  const [copied, setCopied] = useState(false)
  const parsed = Number(amount.replace(/,/g, ""))
  const tooMuch = amount !== "" && (Number.isNaN(parsed) || parsed > WALLET)
  return (
    <Section
      title="Input group"
      purpose="An input with addons: icons, units, a token, a button. The whole group takes the focus ring."
      base="InputGroup"
    >
      <Demo>
        <FieldGroup className="w-full">
          <Field>
            <FieldLabel>Search</FieldLabel>
            <InputGroup>
              <Icon name="search" size={16} />
              <InputGroupInput placeholder="Search stocks" />
              <Kbd className="mr-1">⌘K</Kbd>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel>Spend per day</FieldLabel>
            <InputGroup>
              <InputGroupText>$</InputGroupText>
              <InputGroupInput inputMode="decimal" defaultValue="250.00" className="tabular-nums" />
              <InputGroupText>per day</InputGroupText>
            </InputGroup>
            <FieldDescription>Your agent can't spend more than this in a day.</FieldDescription>
          </Field>
          <Field invalid={tooMuch} className="col-span-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FieldLabel>Amount to deposit</FieldLabel>
              <span className="text-label-sm text-g-500">
                Wallet balance <b className="font-semibold text-g-700 tabular-nums">1,240.50 USDC</b>
              </span>
            </div>
            <InputGroup size="lg">
              <InputGroupInput
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onValueChange={setAmount}
                className="tabular-nums"
              />
              <Button variant="secondary" size="xs" onClick={() => setAmount("1,240.50")}>Max</Button>
              <InputGroupToken>USDC</InputGroupToken>
            </InputGroup>
            {tooMuch ?
              <FieldError match>That's more than your wallet has. The most you can add is 1,240.50.</FieldError> :
              <FieldDescription>Cash (USDC) is always worth about $1.</FieldDescription>}
          </Field>
          <Field className="col-span-full">
            <FieldLabel>Invite link</FieldLabel>
            <InputGroup>
              <InputGroupText>bluechip.app/i/</InputGroupText>
              <InputGroupInput defaultValue="alex-7k2" readOnly />
              <Button
                variant="secondary"
                size="xs"
                onBlur={() => setCopied(false)}
                onClick={() => {
                  void navigator.clipboard?.writeText("https://bluechip.app/i/alex-7k2")
                  setCopied(true)
                }}
              >
                <Icon name={copied ? "check" : "copy"} size={14} />
                {copied ? "Copied" : "Copy"}
              </Button>
            </InputGroup>
          </Field>
        </FieldGroup>
      </Demo>
    </Section>
  )
}

function InputOTPSection() {
  const [code, setCode] = useState("")
  const wrong = code === "000000"
  const message = code.length < 6 ?
    (
      <FieldDescription>
        {6 - code.length} digit{code.length === 5 ? "" : "s"} to go. Paste works too; try{" "}
        <b className="font-semibold text-g-700">000000</b> to see the error.
      </FieldDescription>
    ) :
    wrong ?
    <FieldError match>That code didn't work. Check the latest email and try again.</FieldError> :
    (
      <output className="flex items-center gap-1.5 text-label-sm text-gain">
        <Icon name="check-circle" size={14} />Code accepted. You're signed in.
      </output>
    )
  return (
    <Section
      title="Input OTP"
      purpose="A one-time code, one digit per slot. Paste fills every slot at once."
      base="OTPField"
    >
      <Demo className="justify-center">
        <Field invalid={wrong} className="justify-items-center text-center">
          <FieldLabel className="font-normal text-g-600">
            Enter the code we sent to <b className="font-semibold text-ink">a•••@mail.com</b>
          </FieldLabel>
          <InputOTP length={6} value={code} onValueChange={setCode} className="my-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="contents">
                {i === 3 && <InputOTPSeparator />}
                <InputOTPSlot {...(i > 0 ? { "aria-label": `Digit ${i + 1} of 6` } : {})} />
              </span>
            ))}
          </InputOTP>
          {message}
        </Field>
      </Demo>
      <States
        items={[
          ["Empty", <OTPSample key="empty" value="" />],
          ["Active", <OTPSample key="active" value="4" focusSecond />],
          [
            "Error",
            <Field key="error" invalid>
              <OTPSample value="000" />
            </Field>
          ],
          ["Disabled", <OTPSample key="disabled" value="481" disabled />]
        ]}
      />
    </Section>
  )
}

function OTPSample(
  { value, focusSecond = false, disabled = false }: {
    readonly value: string
    readonly focusSecond?: boolean
    readonly disabled?: boolean
  }
) {
  return (
    <InputOTP length={3} value={value} disabled={disabled} readOnly aria-hidden className="gap-[5px]">
      {[0, 1, 2].map((i) => (
        <InputOTPSlot
          key={i}
          tabIndex={-1}
          className={cn(
            "h-[38px] w-[30px] rounded-sm text-body-lg sm:h-[38px] sm:w-[30px] sm:text-body-lg",
            focusSecond && i === 1 && focusRing
          )}
        />
      ))}
    </InputOTP>
  )
}

function TextareaSection() {
  return (
    <Section
      title="Textarea"
      purpose="Multi-line text that grows with what you type, with a live character count."
      base="Textarea"
    >
      <Demo>
        <FieldGroup className="w-full">
          <Field className="col-span-full">
            <FieldLabel>Tell your agent what to do</FieldLabel>
            <Textarea
              rows={2}
              maxLength={400}
              limit={280}
              placeholder="e.g. Keep about a third in Nvidia and never let cash drop under $200."
              defaultValue="Rebalance my portfolio once a week so no stock is more than 25%."
              hint={
                <FieldDescription>
                  Plain words are fine. You'll review the limits before anything runs.
                </FieldDescription>
              }
            />
          </Field>
          <Field invalid>
            <FieldLabel>Over the limit</FieldLabel>
            <Textarea
              rows={3}
              defaultValue="Buy every stock that goes up and sell every stock that goes down and also…"
            />
            <FieldError match>Keep it under 280 characters.</FieldError>
          </Field>
          <Field disabled>
            <FieldLabel>Disabled</FieldLabel>
            <Textarea rows={2} disabled defaultValue="This agent is paused." />
          </Field>
        </FieldGroup>
      </Demo>
    </Section>
  )
}

function LabelSection() {
  return (
    <Section
      title="Label"
      purpose="Names a control. Clicking it focuses or toggles the control it belongs to."
      base="Label"
    >
      <Demo>
        <FieldGroup className="w-full">
          <Field>
            <FieldLabel required>Cash reserve</FieldLabel>
            <Input defaultValue="$200" required />
          </Field>
          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Nickname</FieldLabel>
              <span className="text-caption text-g-400">Optional</span>
            </div>
            <Input placeholder="What should we call you?" />
          </Field>
          <Field disabled>
            <FieldLabel>Max per trade</FieldLabel>
            <Input defaultValue="$500" />
          </Field>
          <Label className="items-start font-[550]">
            <Checkbox defaultChecked className="mt-px" />
            Email me a receipt for every trade
          </Label>
        </FieldGroup>
      </Demo>
    </Section>
  )
}

function FieldSection() {
  const [created, setCreated] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  return (
    <Section
      title="Field and form"
      purpose="Label, control, description and error as one unit. Checked when you submit, then as you fix."
      base="Field · Form"
    >
      <Demo>
        <Form
          key={formKey}
          onFormSubmit={(values) => setCreated(String(values["name"] ?? "").trim())}
          onReset={() => {
            setCreated(null)
            setFormKey((k) => k + 1)
          }}
        >
          <div>
            <h4 className="text-[17px] font-semibold tracking-[-0.02em]">Set up a Weekly buyer</h4>
            <p className="mt-0.5 text-[13.5px] text-g-600">
              Buys the same amount every week. You can pause it any time.
            </p>
          </div>
          <FieldGroup>
            <Field name="name" validate={(value) => (String(value ?? "").trim() ? null : "Give your agent a name.")}>
              <FieldLabel required>Agent name</FieldLabel>
              <Input placeholder="e.g. Friday buyer" maxLength={32} />
              <FieldDescription>Only you see this.</FieldDescription>
              <FieldError />
            </Field>
            <Field name="stock" validate={(value) => (value ? null : "Choose the stock to buy.")}>
              <Select<string> items={STOCKS}>
                <SelectLabel>
                  Stock <span aria-hidden className="-ml-1.5 text-loss">*</span>
                </SelectLabel>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a stock" />
                </SelectTrigger>
                <SelectContent>
                  {STOCKS.map((stock) => <SelectItem key={stock.value} value={stock.value}>{stock.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
            <Field
              name="amount"
              validate={(value) => {
                const raw = String(value ?? "").replace(/[$,\s]/g, "")
                const amount = Number(raw)
                if (!raw) return "Enter how much to buy each week."
                return Number.isNaN(amount) || amount < 10 || amount > 1000
                  ? "Enter an amount from $10 to $1,000."
                  : null
              }}
            >
              <FieldLabel required>Amount each week</FieldLabel>
              <InputGroup>
                <InputGroupText>$</InputGroupText>
                <InputGroupInput inputMode="decimal" placeholder="50" className="tabular-nums" />
              </InputGroup>
              <FieldDescription>From $10 to $1,000.</FieldDescription>
              <FieldError />
            </Field>
            <Field name="day">
              <FieldSet
                render={<RadioGroup defaultValue="Fri" />}
                className="flex flex-wrap items-center gap-x-5 gap-y-2.5"
              >
                <FieldLegend className="basis-full">Day</FieldLegend>
                {["Mon", "Wed", "Fri"].map((day) => (
                  <Label key={day} className="font-[550]">
                    <RadioGroupItem value={day} />
                    {day}
                  </Label>
                ))}
              </FieldSet>
            </Field>
            <Field
              name="understood"
              orientation="horizontal"
              className="col-span-full flex-wrap"
              validate={(value) => (value ? null : "Tick this to continue.")}
            >
              <Checkbox />
              <FieldLabel>I understand prices can go down as well as up.</FieldLabel>
              <FieldError className="basis-full" />
            </Field>
          </FieldGroup>
          {created && (
            <output className="flex items-center gap-1.5 text-label-sm text-gain">
              <Icon name="check-circle" size={14} />
              {created} is ready. Lock its limits with Face ID to turn it on.
            </output>
          )}
          <div className="flex justify-end gap-2 border-t border-g-100 pt-[18px]">
            <Button type="reset" variant="ghost">Reset</Button>
            <Button type="submit">
              <Icon name="check" size={16} />Create Weekly buyer
            </Button>
          </div>
        </Form>
      </Demo>
    </Section>
  )
}

/* ---------- Choices ---------- */

const KIDS = [["NVDA", "Nvidia"], ["AAPL", "Apple"], ["TSLA", "Tesla"], ["MSFT", "Microsoft"]] as const

function CheckboxSection() {
  const [allowed, setAllowed] = useState<ReadonlySet<string>>(new Set(["NVDA", "AAPL"]))
  const all = allowed.size === KIDS.length
  return (
    <Section
      title="Checkbox"
      purpose="Turns an option on or off inside a list. A parent shows a dash when only some are on."
      base="Checkbox"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <div className="grid min-w-[min(100%,280px)] gap-2.5 rounded-lg bg-g-50 p-4 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]">
          <Label>
            <Checkbox
              checked={all}
              indeterminate={allowed.size > 0 && !all}
              onCheckedChange={(checked) => setAllowed(new Set(checked ? KIDS.map(([t]) => t) : []))}
            />
            Stocks this agent can trade
          </Label>
          <div className="ml-2 grid gap-2.5 border-l border-g-200 pl-7">
            {KIDS.map(([symbol, name]) => (
              <Label key={symbol}>
                <Checkbox
                  checked={allowed.has(symbol)}
                  onCheckedChange={(checked) =>
                    setAllowed((current) => {
                      const next = new Set(current)
                      if (checked) next.add(symbol)
                      else next.delete(symbol)
                      return next
                    })}
                />
                <Ticker symbol={symbol} />
                {name}
              </Label>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          <Field orientation="horizontal">
            <Checkbox defaultChecked />
            <FieldContent>
              <FieldLabel>Ask me before trades over $500</FieldLabel>
              <FieldDescription>You'll get a Face ID prompt on your phone.</FieldDescription>
            </FieldContent>
          </Field>
          <Field orientation="horizontal" disabled>
            <Checkbox />
            <FieldLabel>Trade with borrowed money (not available)</FieldLabel>
          </Field>
        </div>
      </Demo>
      <States
        items={[
          ["Unchecked", <Checkbox key="off" aria-label="Unchecked" {...sample} />],
          ["Checked", <Checkbox key="on" aria-label="Checked" checked {...sample} />],
          ["Indeterminate", <Checkbox key="mixed" aria-label="Indeterminate" indeterminate {...sample} />],
          [
            "Hover",
            <Checkbox
              key="hover"
              aria-label="Hover"
              className="shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.32),0_1px_2px_rgba(10,11,13,.08)]"
              {...sample}
            />
          ],
          ["Focus", <Checkbox key="focus" aria-label="Focus" checked className={focusOutline} {...sample} />],
          ["Error", <Checkbox key="error" aria-label="Error" aria-invalid {...sample} />],
          ["Disabled", <Checkbox key="disabled" aria-label="Disabled" disabled />],
          ["Disabled on", <Checkbox key="disabled-on" aria-label="Disabled on" disabled checked />]
        ]}
      />
    </Section>
  )
}

function RadioGroupSection() {
  const askId = useId()
  const templateId = useId()
  const options = [
    ["every", "Every trade", "Approve each one with Face ID."],
    ["over-500", "Trades over $500", "Smaller trades run on their own."],
    ["never", "Never", "The agent runs inside its limits."]
  ] as const
  return (
    <Section
      title="Radio group"
      purpose="Choose exactly one. Arrow keys move and select; radio cards give each choice room to explain itself."
      base="RadioGroup"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <div className="grid gap-2">
          <span id={askId} className="text-[13.5px] font-[550]">Ask before a trade</span>
          <RadioGroup aria-labelledby={askId} defaultValue="over-500">
            {options.map(([value, label, description]) => (
              <Label key={value} className="items-start">
                <RadioGroupItem value={value} className="mt-px" />
                <span className="grid gap-0.5">
                  {label}
                  <span className="text-label-sm font-normal text-g-500">{description}</span>
                </span>
              </Label>
            ))}
            <Label>
              <RadioGroupItem value="weekends" disabled />
              Only on weekends (soon)
            </Label>
          </RadioGroup>
        </div>
        <div className="grid min-w-0 flex-1 basis-[min(100%,460px)] gap-2">
          <span id={templateId} className="text-[13.5px] font-[550]">Start from a template</span>
          <RadioGroup
            aria-labelledby={templateId}
            defaultValue="rebalancer"
            className="grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5"
          >
            {TEMPLATES.map((template) => (
              <RadioCard key={template.id} value={template.id}>
                <RadioCardIcon>
                  <Icon name={template.icon} size={18} />
                </RadioCardIcon>
                <RadioCardContent>
                  <strong>{template.name}</strong>
                  {template.say}
                </RadioCardContent>
              </RadioCard>
            ))}
          </RadioGroup>
        </div>
      </Demo>
      <States
        items={[
          ["Off", <RadioSample key="off" />],
          ["On", <RadioSample key="on" checked />],
          [
            "Hover",
            <RadioSample
              key="hover"
              className="shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.32)]"
            />
          ],
          ["Focus", <RadioSample key="focus" checked className={focusOutline} />],
          ["Error", <RadioSample key="error" invalid />],
          ["Disabled", <RadioSample key="disabled" disabled />]
        ]}
      />
    </Section>
  )
}

function RadioSample(
  { checked = false, invalid = false, disabled = false, className }: {
    readonly checked?: boolean
    readonly invalid?: boolean
    readonly disabled?: boolean
    readonly className?: string
  }
) {
  return (
    <RadioGroup aria-label="Sample" value={checked ? "a" : null} disabled={disabled}>
      <RadioGroupItem
        value="a"
        tabIndex={-1}
        {...(invalid ? { "aria-invalid": true } : {})}
        {...(className ? { className } : {})}
      />
    </RadioGroup>
  )
}

function SwitchSection() {
  const rows = [
    ["Pause all agents", "Nothing trades until you turn this off.", false],
    ["Trade alerts", "A notification after every trade.", true],
    ["Weekly summary email", "Sent Sunday mornings.", true]
  ] as const
  return (
    <Section title="Switch" purpose="Turns a setting on or off right away, with no save button." base="Switch">
      <Demo>
        <div className="grid w-full max-w-[560px] divide-y divide-g-100">
          {rows.map(([label, description, on]) => (
            <SettingRow key={label} label={label} description={description}>
              <Switch defaultChecked={on} />
            </SettingRow>
          ))}
          <SettingRow label="Borrow to trade" description="bluechip never trades with borrowed money." disabled>
            <Switch disabled />
          </SettingRow>
        </div>
      </Demo>
      <States
        items={[
          ["Off", <Switch key="off" aria-label="Off" {...sample} />],
          ["On", <Switch key="on" aria-label="On" checked {...sample} />],
          ["Hover", <Switch key="hover" aria-label="Hover" className="bg-g-300" {...sample} />],
          ["Focus", <Switch key="focus" aria-label="Focus" checked className={focusOutline} {...sample} />],
          ["Small", <Switch key="small" aria-label="Small" size="sm" checked {...sample} />],
          ["Disabled", <Switch key="disabled" aria-label="Disabled" disabled />],
          ["Disabled on", <Switch key="disabled-on" aria-label="Disabled on" disabled checked />]
        ]}
      />
    </Section>
  )
}

function SettingRow(
  { label, description, disabled = false, children }: {
    readonly label: string
    readonly description: string
    readonly disabled?: boolean
    readonly children: ReactNode
  }
) {
  return (
    <Label className={cn("flex justify-between gap-5 py-3.5", disabled && "cursor-not-allowed text-g-400")}>
      <span className="grid gap-0.5">
        {label}
        <span className="text-label-sm font-normal text-g-500">{description}</span>
      </span>
      {children}
    </Label>
  )
}

function SliderSection() {
  const [maxPerTrade, setMaxPerTrade] = useState<number | ReadonlyArray<number>>(250)
  const [cash, setCash] = useState<number | ReadonlyArray<number>>([5, 20])
  const range = Array.isArray(cash) ? cash : [cash, cash]
  return (
    <Section
      title="Slider"
      purpose="Sets a number or a range by dragging. Values show above the thumb; arrow keys step."
      base="Slider"
    >
      <Demo>
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-x-6 gap-y-7">
          <div className="grid gap-[7px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-[550]">Max per trade</span>
              <output className="text-label font-semibold text-blue tabular-nums">
                ${String(maxPerTrade)} per trade
              </output>
            </div>
            <Slider
              value={maxPerTrade}
              onValueChange={setMaxPerTrade}
              max={1000}
              step={25}
              format={USD_WHOLE}
              thumbLabels={["Max per trade"]}
            />
          </div>
          <div className="grid gap-[7px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-[550]">Keep cash between</span>
              <output className="text-label font-semibold text-blue tabular-nums">{range[0]}% – {range[1]}%</output>
            </div>
            <Slider
              value={cash}
              onValueChange={setCash}
              max={50}
              format={PERCENT}
              thumbLabels={["Lowest cash", "Highest cash"]}
            />
          </div>
          <div className="grid gap-[7px]">
            <div className="flex items-center justify-between gap-3 text-g-400">
              <span className="text-[13.5px] font-[550]">Max in one stock (locked)</span>
              <Icon name="lock" size={14} />
            </div>
            <Slider defaultValue={25} step={5} format={PERCENT} thumbLabels={["Max in one stock"]} disabled />
          </div>
        </div>
      </Demo>
    </Section>
  )
}

/* ---------- Pickers ---------- */

function StockOption({ stock }: { readonly stock: Stock }) {
  return (
    <>
      <Ticker symbol={stock.value} />
      <span>{stock.name}</span>
      <span className="ml-auto pl-2 text-label-sm font-normal text-g-500 tabular-nums">{usd.format(stock.price)}</span>
    </>
  )
}

function SelectSection() {
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

function ComboboxSection() {
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
            <ComboboxInput placeholder="Search 10 stocks" />
            <ComboboxContent>
              <ComboboxEmpty>No stock matches that. bluechip has 10 stocks for now.</ComboboxEmpty>
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
