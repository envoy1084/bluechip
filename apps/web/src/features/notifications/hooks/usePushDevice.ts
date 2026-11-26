import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useCallback, useEffect, useState } from "react"
import {
  pushDevicesAtom,
  pushKeyAtom,
  pushKeys,
  subscribePushAtom,
  unsubscribePushAtom
} from "../atoms/notifications.ts"
import { deviceName } from "../model/notificationText.ts"

/**
 * Where push stands on this browser: it can't do push (`unsupported`), the server has no push keys (`unavailable`),
 * you blocked notifications for bluechip (`blocked`), or it is `off` or `on`.
 */
export type PushState = "loading" | "unsupported" | "unavailable" | "blocked" | "off" | "on"

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window &&
  "Notification" in window

// The service worker shows pushes and opens their page when clicked (`public/sw.js`).
const registration = () => navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready)

/** This browser's push opt-in: its state, and turning it on (asks for permission) or off. */
export function usePushDevice() {
  const key = useAtomValue(pushKeyAtom)
  const devices = useAtomValue(pushDevicesAtom)
  const subscribe = useAtomSet(subscribePushAtom, { mode: "promise" })
  const unsubscribe = useAtomSet(unsubscribePushAtom, { mode: "promise" })
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!supported()) return
    registration().then((ready) => ready.pushManager.getSubscription()).then(
      (subscription) => setEndpoint(subscription?.endpoint ?? null),
      () => setEndpoint(null)
    )
  }, [])

  const publicKey = AsyncResult.isSuccess(key) ? key.value.publicKey : undefined
  const listed = AsyncResult.isSuccess(devices) ? devices.value : []
  const device = listed.find((candidate) => candidate.endpoint === endpoint)
  const state: PushState = !supported() ?
    "unsupported" :
    publicKey === undefined || endpoint === undefined ?
    "loading" :
    publicKey === null ?
    "unavailable" :
    Notification.permission === "denied" ?
    "blocked" :
    device === undefined ?
    "off" :
    "on"

  const turnOn = useCallback(async () => {
    if (publicKey == null) return
    setBusy(true)
    setFailed(false)
    try {
      if ((await Notification.requestPermission()) !== "granted") return
      const ready = await registration()
      const subscription = (await ready.pushManager.getSubscription()) ?? await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(
          atob(publicKey.replaceAll("-", "+").replaceAll("_", "/")),
          (char) => char.charCodeAt(0)
        )
      })
      const json = subscription.toJSON()
      await subscribe({
        payload: {
          endpoint: subscription.endpoint,
          keys: { p256dh: json.keys?.["p256dh"] ?? "", auth: json.keys?.["auth"] ?? "" },
          device: deviceName(navigator.userAgent)
        },
        reactivityKeys: pushKeys
      })
      setEndpoint(subscription.endpoint)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [publicKey, subscribe])

  const turnOff = useCallback(async () => {
    setBusy(true)
    setFailed(false)
    try {
      const subscription = await (await registration()).pushManager.getSubscription()
      await subscription?.unsubscribe()
      if (device !== undefined) await unsubscribe({ params: { id: device.id }, reactivityKeys: pushKeys })
      setEndpoint(null)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [device, unsubscribe])

  return { state, busy, failed, turnOn, turnOff, others: listed.filter((other) => other.endpoint !== endpoint) }
}
