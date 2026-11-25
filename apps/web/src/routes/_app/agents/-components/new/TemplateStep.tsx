import type { Template } from "@bluechip/domain/agents/Templates"
import { TemplatePicker } from "@bluechip/ui/bluechip/template-picker"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import { templateOf, uiTemplate } from "../../../../../agents/limits.ts"
import { StepFoot } from "./NewAgentShell.tsx"

/** Step one: which of the four agents to make. */
export function TemplateStep(
  { template, onPick, onContinue }: Readonly<{
    template: Template
    onPick: (template: Template) => void
    onContinue: () => void
  }>
) {
  return (
    <div className="grid gap-[18px]">
      <div className="grid gap-1.5">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">What should your agent do?</h2>
        <p className="max-w-[60ch] text-[15px] text-g-600">
          Pick a starting point. You'll set its limits next, and nothing runs until you lock them with Face ID.
        </p>
      </div>

      <TemplatePicker value={uiTemplate(template)} onValueChange={(picked) => onPick(templateOf(picked.name))} />

      <StepFoot>
        <Button variant="ghost" nativeButton={false} render={<Link to="/agents" />}>Cancel</Button>
        <Button onClick={onContinue}>
          Continue<Icon name="arrow-right" size={16} />
        </Button>
      </StepFoot>
    </div>
  )
}
