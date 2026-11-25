import type { AgentId, IntentId, SigningRequestId } from "@bluechip/domain/Ids"
import * as Effect from "effect/Effect"
import * as Atom from "effect/reactivity/Atom"
import { BluechipApiClient, intentsReactivityKey, liveReactivityKey } from "../../../lib/api/client.ts"
import { signWithPasskey } from "../../../lib/passkey.ts"

const reactivityKeys = [intentsReactivityKey, liveReactivityKey]

/** How many of an agent's intents one page of its activity holds. */
export const intentPageSize = 20

/**
 * One page of an agent's intents, newest first, keyed by `"<agentId> <pageToken>"` (an empty token for the first
 * page). Pages are cut by intent id, so a new intent only ever joins the first one.
 */
export const agentIntentsAtom = Atom.family((key: string) => {
  const [agentId, pageToken = ""] = key.split(" ") as [AgentId, string?]
  return BluechipApiClient.query("intents", "list", {
    query: { agentId, pageSize: intentPageSize, ...(pageToken === "" ? {} : { pageToken }) },
    reactivityKeys
  })
})

/** Agents' trades waiting for your Face ID, newest first. */
export const approvalsAtom = BluechipApiClient.query("intents", "approvals", { reactivityKeys })

/** One intent. */
export const intentAtom = Atom.family((id: IntentId) =>
  BluechipApiClient.query("intents", "intent", { params: { id }, reactivityKeys })
)

/** What an agent's policies would decide for a trade, without trading. */
export const previewIntentAtom = BluechipApiClient.mutation("intents", "preview")

/** Asks an agent to make a trade (decided in the background), or prepares your own for the passkey. */
export const createIntentAtom = BluechipApiClient.mutation("intents", "create")

/** Prepares an agent's trade that needs you for the passkey. */
export const approveIntentAtom = BluechipApiClient.mutation("intents", "approve")

/** Says no to an agent's trade that waits for you. */
export const declineIntentAtom = BluechipApiClient.mutation("intents", "decline")

/** Stops an intent before it's sent. */
export const cancelIntentAtom = BluechipApiClient.mutation("intents", "cancel")

/** Signs a prepared intent with the account's passkey (Face ID) and sends it. */
export const confirmIntentAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(request: { readonly id: SigningRequestId; readonly options: Record<string, unknown> }) {
    const client = yield* BluechipApiClient
    const credential = yield* signWithPasskey(request.options)

    return yield* client.intents.confirm({
      params: { id: request.id },
      payload: { credential }
    })
  })
)
