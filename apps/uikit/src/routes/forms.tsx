import { createFileRoute } from "@tanstack/react-router"
import { ButtonGroupSection, ToggleGroupSection, ToggleSection } from "../pages/forms/actions.tsx"
import { CheckboxSection, RadioGroupSection, SliderSection, SwitchSection } from "../pages/forms/choices.tsx"
import {
  FieldSection,
  InputGroupSection,
  InputOTPSection,
  InputSection,
  LabelSection,
  TextareaSection
} from "../pages/forms/inputs.tsx"
import { Group } from "../pages/forms/layout.tsx"
import { ComboboxSection, SelectSection } from "../pages/forms/pickers.tsx"
import { DatePickerSection, TimePickerSection } from "../pages/forms/time-and-date.tsx"

export const Route = createFileRoute("/forms")({ component: KitForms })

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
        <TimePickerSection />
        <DatePickerSection />
      </Group>
    </div>
  )
}
