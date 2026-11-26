import { Input } from "@bluechip/ui/components/input"
import { cn } from "@bluechip/ui/lib/cn"
import { useId, useState } from "react"

/**
 * A line of text, or a list of words written with commas (`list`): "chips, AI". A list keeps what is typed while it
 * is edited and holds only the words of 2 to 40 characters.
 */
export function TextField(
  { label, help, placeholder, value, problem, onChange }: Readonly<{
    label: string
    help?: string | undefined
    placeholder: string
    value: string | ReadonlyArray<string>
    problem?: string | undefined
    onChange: (value: string | ReadonlyArray<string>) => void
  }>
) {
  const id = useId()
  const list = typeof value !== "string"
  const [text, setText] = useState<string | null>(null)
  const note = problem ?? help

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13.5px] font-medium text-g-700">{label}</label>
      <Input
        id={id}
        size="sm"
        autoComplete="off"
        maxLength={200}
        placeholder={placeholder}
        value={text ?? (list ? value.join(", ") : value)}
        aria-invalid={problem === undefined ? undefined : true}
        aria-describedby={note === undefined ? undefined : `${id}-note`}
        onChange={(event) => {
          const typed = event.currentTarget.value
          if (!list) return onChange(typed)
          setText(typed)
          onChange(typed.split(",").map((word) => word.trim()).filter((word) => word.length >= 2 && word.length <= 40))
        }}
        onBlur={() => setText(null)}
      />
      {note === undefined ? null : (
        <p
          id={`${id}-note`}
          className={cn("text-label-sm text-g-500", problem !== undefined && "font-medium text-loss")}
        >
          {note}
        </p>
      )}
    </div>
  )
}
