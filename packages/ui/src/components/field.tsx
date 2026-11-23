import { Field as BaseField } from "@base-ui/react/field"
import { Fieldset as BaseFieldset } from "@base-ui/react/fieldset"
import { Form as BaseForm } from "@base-ui/react/form"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { labelClassName, RequiredMark } from "./label.tsx"

/**
 * A form that validates its fields on submit, then again as they change, and moves focus to the first invalid
 * field. `onFormSubmit` only runs when every field is valid.
 */
export function Form({ className, ...props }: ComponentProps<typeof BaseForm>) {
  return <BaseForm data-slot="form" noValidate className={cn("grid w-full gap-[22px]", className)} {...props} />
}

/** Groups related fields (a radio group, a set of checkboxes) under one legend. */
export function FieldSet({ className, ...props }: ComponentProps<typeof BaseFieldset.Root>) {
  return <BaseFieldset.Root data-slot="field-set" className={cn("grid min-w-0 gap-2.5", className)} {...props} />
}

/** The caption of a `FieldSet`. */
export function FieldLegend({ className, ...props }: ComponentProps<typeof BaseFieldset.Legend>) {
  return <BaseFieldset.Legend data-slot="field-legend" className={cn(labelClassName, className)} {...props} />
}

/** Lays fields out in responsive columns: one per 240 px, one column on phones. */
export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] items-start gap-x-6 gap-y-5",
        className
      )}
      {...props}
    />
  )
}

export const fieldVariants = cva("group/field min-w-0", {
  variants: {
    orientation: {
      vertical: "grid content-start gap-[7px]",
      horizontal: "flex items-start gap-2.5 [&>[role=checkbox],&>[role=switch],&>[role=radio]]:mt-px"
    }
  },
  defaultVariants: { orientation: "vertical" }
})

export interface FieldProps extends ComponentProps<typeof BaseField.Root>, VariantProps<typeof fieldVariants> {}

/**
 * Label, control, description and error as one unit. Set `name` and a `validate` function (or native constraints
 * like `required`) and the field tracks its own validity; `invalid` forces the error state.
 */
export function Field({ orientation, className, ...props }: FieldProps) {
  return (
    <BaseField.Root
      data-slot="field"
      data-orientation={orientation ?? "vertical"}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

/** Stacks a label and its description next to a checkbox, radio or switch in a horizontal field. */
export function FieldContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-content" className={cn("grid min-w-0 flex-1 gap-0.5", className)} {...props} />
}

export interface FieldLabelProps extends ComponentProps<typeof BaseField.Label> {
  /** Shows a red asterisk; the control itself carries `required`. */
  readonly required?: boolean
}

/** The label of a `Field`, wired to its control. Turns red when a stacked field is invalid. */
export function FieldLabel({ required = false, className, children, ...props }: FieldLabelProps) {
  return (
    <BaseField.Label
      data-slot="field-label"
      className={cn(
        labelClassName,
        "w-fit cursor-pointer data-disabled:cursor-not-allowed data-disabled:text-g-400",
        "group-data-[orientation=vertical]/field:data-invalid:text-loss",
        className
      )}
      {...props}
    >
      {children}
      {required && <RequiredMark />}
    </BaseField.Label>
  )
}

/** Helper text under a control, announced with it. */
export function FieldDescription({ className, ...props }: ComponentProps<typeof BaseField.Description>) {
  return (
    <BaseField.Description
      data-slot="field-description"
      className={cn("text-label-sm leading-[1.45] text-g-500 data-disabled:text-g-400", className)}
      {...props}
    />
  )
}

/**
 * The field's error, shown only while it is invalid. Without children it shows the message from `validate` or
 * the browser's constraint message.
 */
export function FieldError({ className, children, ...props }: ComponentProps<typeof BaseField.Error>) {
  return (
    <BaseField.Error
      data-slot="field-error"
      className={cn("flex items-start gap-1.5 text-label-sm leading-[1.45] text-loss", className)}
      {...props}
    >
      <Icon name="error" size={14} className="mt-px" />
      <span>{children ?? <BaseField.Validity>{(validity) => validity.error}</BaseField.Validity>}</span>
    </BaseField.Error>
  )
}
