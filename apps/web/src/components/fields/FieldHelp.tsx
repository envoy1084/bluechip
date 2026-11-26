import { Tooltip, TooltipContent, TooltipTrigger } from "@bluechip/ui/components/tooltip"
import { Icon } from "@bluechip/ui/icons/icon"

/**
 * A field's explanation behind an (i) beside its label, so a form of many fields stays short. A problem is never put
 * here: it shows under the field, where it can't be missed.
 */
export function FieldHelp({ label, help }: Readonly<{ label: string; help: string | undefined }>) {
  if (help === undefined) return null
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`About ${label.toLowerCase()}: ${help}`}
        className="inline-grid size-4 cursor-help place-items-center rounded-full text-g-400 hover:text-g-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
      >
        <Icon name="info" size={14} />
      </TooltipTrigger>
      <TooltipContent>{help}</TooltipContent>
    </Tooltip>
  )
}
