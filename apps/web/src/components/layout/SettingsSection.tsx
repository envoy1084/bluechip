import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import type { ReactNode } from "react"

/** A card of settings: its title and what it is for, then its rows. */
export function SettingsSection(
  { title, description, children }: Readonly<{ title: string; description: string; children: ReactNode }>
) {
  return (
    <section className="rounded-lg bg-white px-[22px] pt-0.5 pb-1 shadow-e2">
      <div className="grid gap-1 border-b border-g-100 pt-[18px] pb-3.5">
        <h3 className="text-base font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="text-[13.5px] text-g-600">{description}</p>
      </div>
      {children}
    </section>
  )
}

/** One setting: its icon, title and description, and what it offers on the right. */
export function SettingsRow(
  { title, description, icon, children }: Readonly<
    { title: ReactNode; description: ReactNode; icon?: IconName; children?: ReactNode }
  >
) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-g-100 py-3.5 last:border-b-0">
      <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3">
        {icon === undefined ?
          null :
          (
            <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(180deg,#fff,#f1f3f6)] text-g-600 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08)]">
              <Icon name={icon} size={18} />
            </span>
          )}
        <div className="grid min-w-0 gap-0.5">
          <b className="inline-flex items-center gap-2 text-sm font-semibold">{title}</b>
          <span className="text-[13px] text-g-500">{description}</span>
        </div>
      </div>
      {children}
    </div>
  )
}
