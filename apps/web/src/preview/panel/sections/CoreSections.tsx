// The panel's own sections: which made-up account the tab shows, and how the network, the live stream and Face ID
// behave.
import { switchPreview } from "../../activation.ts"
import { NETWORK_AREAS } from "../../network.ts"
import type { FaceIdMode, LiveMode, NetworkMode } from "../../store.ts"
import { SCENARIOS } from "../../world/cast.ts"
import { Act, Group, Row, Segmented, usePreview } from "../controls.tsx"

export function ScenarioSection() {
  const store = usePreview()

  return (
    <>
      <Group title="Account" hint="Each one starts fresh. Your toggles are kept across reloads until you reset.">
        <div className="grid gap-1.5">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => switchPreview(scenario.id)}
              className={`grid cursor-pointer gap-0.5 rounded-[10px] px-3 py-2.5 text-left transition-colors ${
                scenario.id === store.scenario ?
                  "bg-blue-50 shadow-[inset_0_0_0_1px_var(--color-info-line)]" :
                  "shadow-[inset_0_0_0_1px_var(--color-g-200)] hover:bg-g-50"
              }`}
            >
              <span className="text-[13px] font-semibold">{scenario.label}</span>
              <span className="text-[12px] leading-snug text-g-500">{scenario.description}</span>
            </button>
          ))}
        </div>
      </Group>
      <Group
        title="Toggles"
        hint={`${store.actions.length} ${store.actions.length === 1 ? "change" : "changes"} on top of the account.`}
      >
        <div className="flex flex-wrap gap-2">
          <Act onClick={() => store.reset()}>Reset changes</Act>
          <Act onClick={() => window.location.reload()}>Reload</Act>
          <Act tone="danger" onClick={() => switchPreview(null)}>Leave preview</Act>
        </div>
      </Group>
    </>
  )
}

const NETWORK_MODES: ReadonlyArray<{ readonly value: NetworkMode; readonly label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "slow", label: "Slow" },
  { value: "loading", label: "Loading" },
  { value: "error", label: "Error" }
]

export function NetworkSection() {
  const store = usePreview()

  return (
    <>
      <Group title="Live stream" hint="What the connection banner and live updates see.">
        <Segmented<LiveMode>
          value={store.settings.live}
          options={[
            { value: "connected", label: "Live" },
            { value: "dropped", label: "Dropped" },
            { value: "outdated", label: "Outdated" },
            { value: "signedOut", label: "Signed out" }
          ]}
          onChange={(mode) => store.setLive(mode)}
        />
      </Group>
      <Group title="Face ID" hint="What happens when a screen asks for your passkey.">
        <Segmented<FaceIdMode>
          value={store.settings.faceId}
          options={[{ value: "approve", label: "Approve" }, { value: "cancel", label: "Cancel" }]}
          onChange={(mode) => store.setFaceId(mode)}
        />
      </Group>
      <Group
        title="Requests"
        hint="Slow waits 2.5 s, Loading never answers (skeletons), Error fails like a lost connection. Applies to new requests."
      >
        {NETWORK_AREAS.map((area) => (
          <Row key={area.id} label={area.label}>
            <Segmented<NetworkMode>
              value={store.settings.network[area.id] ?? "normal"}
              options={NETWORK_MODES}
              onChange={(mode) => store.setNetwork(area.id, mode)}
            />
          </Row>
        ))}
      </Group>
    </>
  )
}
