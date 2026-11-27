import { assert, describe, it } from "@effect/vitest"

import { importProblems } from "../../../lint/ImportDirections.ts"

describe("importProblems", () => {
  it.each([
    {
      name: "a route importing a feature",
      path: "apps/web/src/routes/_app/agents.tsx",
      source: `import { AgentScreen } from "../../features/agents/screens/AgentScreen.tsx"`,
      expected: []
    },
    {
      name: "a feature importing shared code",
      path: "apps/web/src/features/agents/screens/AgentScreen.tsx",
      source: `import { AppPage } from "../../../components/layout/AppPage.tsx"`,
      expected: []
    },
    {
      name: "a feature importing another feature",
      path: "apps/web/src/features/agents/screens/AgentScreen.tsx",
      source: `import { Activity } from "../../intents/components/Activity.tsx"`,
      expected: [
        "apps/web/src/features/agents/screens/AgentScreen.tsx: feature agents imports feature intents: move the shared piece to components/, hooks/ or lib/ (apps/web/src/features/intents/components/Activity.tsx)"
      ]
    },
    {
      name: "the browser entry loading preview mode",
      path: "apps/web/src/client.tsx",
      source: `const { install } = await import("./preview/install.ts")`,
      expected: []
    },
    {
      name: "a feature importing preview mode's made-up data",
      path: "apps/web/src/features/agents/screens/AgentScreen.tsx",
      source: `import { castOf } from "../../../preview/world/cast.ts"`,
      expected: [
        "apps/web/src/features/agents/screens/AgentScreen.tsx: imports preview/ (made-up data, development only): only client.tsx may load it (apps/web/src/preview/world/cast.ts)"
      ]
    },
    {
      name: "preview mode importing a feature",
      path: "apps/web/src/preview/panel/Panel.tsx",
      source: `import { AgentScreen } from "../../features/agents/screens/AgentScreen.tsx"`,
      expected: [
        "apps/web/src/preview/panel/Panel.tsx: preview/ imports the app's features or routes: it stands in for the server, not the app (apps/web/src/features/agents/screens/AgentScreen.tsx)"
      ]
    },
    {
      name: "shared code importing a feature",
      path: "apps/web/src/hooks/useStocks.ts",
      source: `import { stocksAtom } from "../features/stocks/atoms/market.ts"`,
      expected: [
        "apps/web/src/hooks/useStocks.ts: shared code (hooks/) imports features/ (apps/web/src/features/stocks/atoms/market.ts)"
      ]
    },
    {
      name: "a feature importing a route",
      path: "apps/web/src/features/agents/model/links.ts",
      source: `import { Route } from "../../../routes/_app/agents.tsx"`,
      expected: [
        "apps/web/src/features/agents/model/links.ts: a feature imports a route (apps/web/src/routes/_app/agents.tsx)"
      ]
    },
    {
      name: "a module using another module's service",
      path: "apps/server/src/modules/intents/Intents.ts",
      source: `import { Trades } from "../trading/Trades.ts"`,
      expected: []
    },
    {
      name: "a module importing another module's handlers",
      path: "apps/server/src/modules/intents/Intents.ts",
      source: `import { TradesHandlers } from "../trading/http.ts"`,
      expected: [
        "apps/server/src/modules/intents/Intents.ts: module intents imports module trading's handlers (apps/server/src/modules/trading/http.ts)"
      ]
    },
    {
      name: "infrastructure importing a module",
      path: "apps/server/src/platform/live/LiveEvents.ts",
      source: `import { Accounts } from "../../modules/accounts/Accounts.ts"`,
      expected: [
        "apps/server/src/platform/live/LiveEvents.ts: platform/ imports modules/ (apps/server/src/modules/accounts/Accounts.ts)"
      ]
    },
    {
      name: "the schema aggregate gathering a module's tables",
      path: "apps/server/src/platform/db/schema.ts",
      source: `export { agents } from "../../modules/agents/tables.ts"`,
      expected: []
    },
    {
      name: "a module importing the composition root",
      path: "apps/server/src/modules/agents/Agents.ts",
      source: `import { ServicesLive } from "../../Services.ts"`,
      expected: [
        "apps/server/src/modules/agents/Agents.ts: imports the composition root (Services.ts) (apps/server/src/Services.ts)"
      ]
    },
    {
      name: "a package import",
      path: "apps/web/src/hooks/useStocks.ts",
      source: `import { deploymentOf } from "@bluechip/chain/ChainDeployment"`,
      expected: []
    }
  ])("$name", ({ expected, path, source }) => {
    assert.deepStrictEqual(importProblems([{ path, source }]), expected)
  })
})
