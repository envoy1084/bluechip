import { Popover, PopoverContent, PopoverTrigger } from "../components/popover.tsx"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export interface CitationSource {
  /** What kind of source: "Price", "Filing", "News", "Account". */
  readonly kind: string
  /** Who it's from: "Reuters", "Nvidia 10-Q", "Your portfolio". */
  readonly from: string
  readonly title: string
  /** How fresh it is: "Updated 12 seconds ago". */
  readonly when: string
  readonly icon?: IconName
}

export interface CitationChipProps {
  /** The source's number in the answer, from 1. */
  readonly index: number
  readonly source: CitationSource
  readonly className?: string
}

/** A numbered source next to the claim it supports. Click or press Enter for where it came from; Escape closes. */
export function CitationChip({ index, source, className }: CitationChipProps) {
  return (
    <Popover>
      <PopoverTrigger
        data-slot="citation-chip"
        aria-label={`Source ${index}: ${source.from}`}
        className={cn(
          "inline-flex max-w-[16ch] cursor-pointer items-center gap-1 rounded-full bg-g-100 py-px pr-1.5 pl-0.5 align-[1px] text-[11px] leading-normal font-[550] whitespace-nowrap text-g-600",
          "transition-[background,color] duration-fast ease-brand hover:bg-blue-100 hover:text-blue-deep data-popup-open:bg-blue-100 data-popup-open:text-blue-deep",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue",
          className
        )}
      >
        <span
          aria-hidden
          className="inline-grid h-[15px] min-w-[15px] place-items-center rounded-full bg-white text-[10px] font-bold text-blue shadow-[0_0_0_1px_rgba(10,11,13,.06)]"
        >
          {index}
        </span>
        <span className="truncate">{source.from}</span>
      </PopoverTrigger>
      <PopoverContent
        aria-label={`Source ${index}`}
        className="w-max max-w-[min(280px,calc(100vw-16px))] gap-0.5 rounded-[12px] px-3 py-2.5 text-label-sm text-g-500"
      >
        <span className="inline-flex items-center gap-[5px] text-caption font-semibold text-blue">
          {source.icon && <Icon name={source.icon} size={13} />}
          {source.kind}
        </span>
        <b className="text-label font-semibold text-ink">{source.title}</b>
        <span>{source.from}, {source.when}</span>
      </PopoverContent>
    </Popover>
  )
}
