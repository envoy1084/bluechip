import type { Settings } from "@bluechip/domain/automations/Settings"
import { Input } from "@bluechip/ui/components/input"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import { Fragment, type ReactNode, useId } from "react"
import type { DraftFields } from "../../model/drafts.ts"
import type { Phrase } from "../../model/phrases.ts"
import { SettingsChips } from "../detail/SettingsChips.tsx"

const MAX_NAME = 60

/**
 * What it will do, as you set it: the sentence, each phrase leading to the part it says and the ones just changed
 * marked; its settings as chips; then its name and who trades.
 */
export function EditorSummary(
  { phrases, changed, draft, nameId, namePlaceholder, nameProblem, whoTrades, onName, onJump }: Readonly<{
    phrases: ReadonlyArray<Phrase>
    /** The phrases an edit just changed. */
    changed: ReadonlyArray<Phrase>
    draft: Pick<DraftFields, "name" | "trigger"> & { readonly settings: Settings }
    nameId: string
    namePlaceholder: string
    nameProblem: string | undefined
    whoTrades: ReactNode
    onName: (name: string) => void
    onJump: (phrase: Phrase) => void
  }>
) {
  const noteId = useId()

  return (
    <section aria-label="What it does" className="grid gap-4 rounded-lg bg-white p-[18px] shadow-e2">
      <div className="grid gap-2">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(180deg,#eef1ff,#e3e8ff)] shadow-[inset_0_0_0_1px_var(--color-info-line)]"
          >
            <Illustration name="bolt" size={22} label="" />
          </span>
          <span className="grid">
            <span className="text-caption font-semibold tracking-[.06em] text-blue uppercase">It will</span>
            <span className="text-label-sm text-g-500">Pick any part to change it.</span>
          </span>
        </span>
        <p
          aria-live="polite"
          className="text-[17px] leading-[1.5] font-semibold tracking-[-0.01em] text-pretty text-ink"
        >
          {phrases.map((phrase, index) => (
            <Fragment key={`${phrase.part}-${phrase.index}`}>
              <button
                type="button"
                onClick={() => onJump(phrase)}
                className={cn(
                  "-mx-0.5 cursor-pointer rounded-[5px] px-0.5 text-left underline decoration-g-300 decoration-dotted underline-offset-[5px] outline-none",
                  "transition-[background-color,color,text-decoration-color] duration-slow ease-brand",
                  "hover:text-blue hover:decoration-blue focus-visible:shadow-[0_0_0_2px_var(--color-blue)]",
                  changed.includes(phrase) && "bg-blue-100 text-blue-deep decoration-blue decoration-solid"
                )}
              >
                {phrase.text}
              </button>
              {index === phrases.length - 1 ? "." : ", "}
            </Fragment>
          ))}
        </p>
        <div className="[&_svg]:text-g-500">
          <SettingsChips automation={draft} />
        </div>
      </div>

      <div className="grid gap-3.5 border-t border-g-100 pt-4">
        <div className="grid gap-1.5">
          <label htmlFor={nameId} className="text-[13.5px] font-medium text-g-700">Name</label>
          <Input
            id={nameId}
            value={draft.name}
            maxLength={MAX_NAME}
            autoComplete="off"
            placeholder={namePlaceholder}
            aria-invalid={nameProblem === undefined ? undefined : true}
            aria-describedby={noteId}
            onChange={(event) => onName(event.currentTarget.value)}
          />
          <p
            id={noteId}
            className={cn("text-label-sm text-g-500", nameProblem !== undefined && "font-medium text-loss")}
          >
            {nameProblem ?? (draft.name.trim() === "" ? "Left empty, it's named after what it does." : null)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <span className="text-[13.5px] font-medium text-g-700">Trades through</span>
          <span className="min-w-0 text-label text-g-600">{whoTrades}</span>
        </div>
      </div>
    </section>
  )
}
