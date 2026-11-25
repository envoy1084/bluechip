# @bluechip/ui

bluechip's design system for the web app: Tailwind v4 theme, base components (shadcn on Base UI, restyled),
bluechip's product components, the halftone motion engine, illustrations and icons. Private; consumed by `apps/web`, shown in full by `apps/uikit`.

The visual reference is the brand kit (`research/brand/brand-kit.html`, published as an artifact). Components are
presentational: they take props and callbacks and never fetch data.

| Import                                    | Contents                                                   |
| ----------------------------------------- | ---------------------------------------------------------- |
| `@bluechip/ui/styles.css`                 | Tailwind entry: theme tokens, base styles, surfaces, fonts |
| `@bluechip/ui/lib/*`                      | `cn`, formatting, tickers                                  |
| `@bluechip/ui/icons/icon`                 | `<Icon name="agent" />` over Hugeicons                     |
| `@bluechip/ui/components/*`               | Base components (button, dialog, select, …)                |
| `@bluechip/ui/bluechip/*`                 | Product components (permission card, approval sheet, …)    |
| `@bluechip/ui/motion/*`                   | `<Halftone>`, number roll, seal, confetti, …               |
| `@bluechip/ui/illustrations/illustration` | `<Illustration name="garden" variant="pixel" />`           |
