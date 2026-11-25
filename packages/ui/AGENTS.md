# @bluechip/ui guide

Read the root `AGENTS.md` first. This package is bluechip's design system; the visual source of truth is the brand
kit artifact (`research/brand/brand-kit.html` with `research/brand/kit/**`, run it with
`research/brand/kit/preview.sh <view>`). Port what the kit shows; do not redesign.

## Rules

- **Presentational only.** Components take props and callbacks. No data fetching, no Effect services, no wagmi,
  no global state. Demo data lives in `apps/uikit/src/routes/*`.
- **One component per file**, kebab-case, shadcn names (`dropdown-menu.tsx`). Compound parts are named exports of
  the same file (`Dialog`, `DialogTrigger`, `DialogContent`, …), like shadcn. No barrel files.
- **Primitives from Base UI** (`@base-ui/react/<part>`) for anything with behaviour (focus, keyboard, overlays,
  positioning). Never hand-roll focus traps or menus that Base UI provides.
- **Styling** with Tailwind v4 classes on the brand tokens (`src/styles/theme.css`): colors `blue ink g-50…g-800
  canvas sunken gain loss warn info …`, text `text-display-1…text-caption-sm`, shadows `shadow-e1…e4`, radius
  `rounded-xs…2xl`, easing `ease-brand`, durations `duration-fast/base/slow`, depth utilities `surface-primary
  surface-secondary surface-danger surface-field surface-well surface-glass ring-focus`. No arbitrary hex colors
  unless the kit uses a one-off gradient stop.
- **Variants** with `class-variance-authority`, exported as `<name>Variants`; props named like shadcn (`variant`,
  `size`). Merge classes with `cn` from `../lib/cn.ts`. Set `data-slot="<part>"` on every rendered part.
- **State styling** from Base UI data attributes (`data-[open]`, `data-[checked]`, `data-[disabled]`,
  `data-[highlighted]`, `data-[starting-style]`, `data-[ending-style]`) for transitions.
- **Icons**: `<Icon name="…" />` from `../icons/icon.tsx`; names are typed (`IconName`).
- **Accessibility**: every interactive part reachable and operable by keyboard, visible focus (`:focus-visible`
  outline or `ring-focus`), labels for icon-only controls, `prefers-reduced-motion` respected.
- **Copy** in examples follows the kit's voice (agents, limits, Face ID, cash (USDC); never session key, grant,
  policy, oracle, smart account; no gains promises).
- **Relative imports end in `.ts`/`.tsx`.** Readonly props interfaces. Types fully inferred where possible.

## Use existing libraries

Reuse a maintained library before writing behaviour from scratch. The chosen set:

| Need                                                      | Library                                                                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behaviour and accessibility of controls and overlays      | `@base-ui/react`                                                                                                                                            |
| Number transitions (balances, prices, counters)           | `@number-flow/react`, through `motion/number-roll.tsx` (`NumberRoll`)                                                                                       |
| Text that changes in place (button states, status labels) | `torph`, through `components/text-morph.tsx` (`TextMorph`)                                                                                                  |
| Loading states                                            | `skullet`, through `components/skeleton.tsx` (`Skeleton` measures the real content; `SkeletonBlock` for rare manual shapes; theme in `styles/skeleton.css`) |
| Haptic feedback on phones                                 | `web-haptics`, through `lib/haptics.ts` (`haptic(kind)`, Button `haptic` prop)                                                                              |
| Big moments (agent locked, trade filled, money arrived)   | `glimm`, through `motion/sweep.tsx` (`MomentScope` + `useMoment`, `SweepProvider`)                                                                          |
| Tables                                                    | `@tanstack/react-table`                                                                                                                                     |
| Carousels                                                 | `embla-carousel-react`                                                                                                                                      |
| Resizable panels                                          | `react-resizable-panels`                                                                                                                                    |
| Charts                                                    | `@tanstack/charts` (sparklines stay plain SVG)                                                                                                              |
| Easing                                                    | tokens in `theme.css` (`ease-brand`, `ease-spring`, from easing.dev's curves)                                                                               |

The halftone engine, scenes and illustrations are bluechip's own art and stay in `src/motion` and
`src/illustrations`.

## Tests

`test/<folder>/<name>.test.tsx`, run in Chromium (Vitest browser mode). Import from `@effect/vitest`
(`describe`, `it`, `expect`), render with `vitest-browser-react`, interact with `userEvent` from `vitest/browser`,
and import the component by package name (`@bluechip/ui/components/dialog`). Test behaviour that matters: keyboard
paths, focus management, open/close, value changes, formatting and any logic. No snapshot or class-name tests.

## Kit pages

Each area has a page in `apps/uikit/src/routes/<section>.tsx` showing every component with all variants and
states, mirroring the artifact. Check it with the kit's dev server (`pnpm --filter @bluechip/uikit dev`) and a headless
screenshot.
