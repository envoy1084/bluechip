import { ToggleGroup, ToggleGroupItem } from "../components/toggle-group.tsx"
import { Icon, type IconName } from "../icons/icon.tsx"
import { type ThemeChoice, useThemeChoice } from "../lib/theme.ts"

const CHOICES: ReadonlyArray<{ readonly value: ThemeChoice; readonly label: string; readonly icon: IconName }> = [
  { value: "system", label: "System", icon: "desktop" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" }
]

/** System, Light or Dark, remembered in this browser. `compact` shows only the icons, each named for screen readers. */
export function ThemePicker({ compact = false, className }: Readonly<{ compact?: boolean; className?: string }>) {
  const [choice, setChoice] = useThemeChoice()
  return (
    <ToggleGroup
      size="sm"
      aria-label="Appearance"
      value={[choice]}
      onValueChange={(values) => {
        const picked = CHOICES.find((option) => option.value === values[0])
        if (picked !== undefined) setChoice(picked.value)
      }}
      className={className}
    >
      {CHOICES.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={compact ? option.label : undefined}
        >
          <Icon name={option.icon} size={16} />
          {compact ? null : option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
