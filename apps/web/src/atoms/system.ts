import { BluechipApiClient, liveReactivityKey } from "../api/client.ts"

/** The server's release, contract version and clock (`GET /api/version`). */
export const versionAtom = BluechipApiClient.query("system", "version", { reactivityKeys: [liveReactivityKey] })
