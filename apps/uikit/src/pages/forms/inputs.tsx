import { Button } from "@bluechip/ui/components/button"
import { Checkbox } from "@bluechip/ui/components/checkbox"
import {
  Field,
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
import { RadioGroup, RadioGroupItem } from "@bluechip/ui/components/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@bluechip/ui/components/select"
import { Textarea } from "@bluechip/ui/components/textarea"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useState } from "react"
import { STOCKS } from "./data.ts"
import { Demo, focusRing, hoverRing, sample, Section, States } from "./layout.tsx"

/* ---------- Inputs ---------- */

export function InputSection() {
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

export const WALLET = 1240.5

export function InputGroupSection() {
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

export function InputOTPSection() {
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

export function OTPSample(
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

export function TextareaSection() {
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

export function LabelSection() {
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

export function FieldSection() {
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
