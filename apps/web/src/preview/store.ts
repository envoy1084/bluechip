// The made-up world one preview tab runs on, kept in memory: the mock API reads and changes it, the panel toggles it,
// and both tell the app what changed through live events. Panel actions are saved in the tab's session storage and
// played again after a reload, so a page refresh keeps the state being reviewed.
import type { LiveEvent } from "@bluechip/domain/Events"
import { type Cast, castOf, type ScenarioId } from "./world/cast.ts"
import { makeWorld, type World } from "./world/World.ts"

/** How the mock answers a part of the API: as usual, slowly, never (stuck loading), or with a network error. */
export type NetworkMode = "normal" | "slow" | "loading" | "error"

/** How the live stream behaves: connected, dropped (reconnecting), refused as outdated, or refused as signed out. */
export type LiveMode = "connected" | "dropped" | "outdated" | "signedOut"

/** What happens when a screen asks for Face ID. */
export type FaceIdMode = "approve" | "cancel"

/** A panel action: a named change to the world with its arguments, saved so a reload plays it again. */
export interface Action {
  readonly name: string
  readonly args: ReadonlyArray<string | number | boolean | null>
}

type Apply = (world: World, ...args: Action["args"]) => ReadonlyArray<LiveEvent> | void

/** A panel action's definition: its name and what it does to the world. */
export interface ActionDef {
  readonly name: string
  readonly apply: Apply
}

/** An action that makes saved {@link Action}s of itself, with its definition for the store's registry. */
export interface DefinedAction {
  (...args: Action["args"]): Action
  readonly def: ActionDef
}

/**
 * Defines a panel action: a change to the world, returning the live events that tell the app (the store adds a
 * reconnect, so every live query refetches anyway). List it in its slice's actions for the store to know it.
 */
export const defineAction = (name: string, apply: Apply): DefinedAction =>
  Object.assign((...args: Action["args"]): Action => ({ name, args }), { def: { name, apply } })

const ACTIONS_KEY = "bluechip:preview:actions"
const SETTINGS_KEY = "bluechip:preview:settings"

interface Settings {
  network: Record<string, NetworkMode>
  live: LiveMode
  faceId: FaceIdMode
}

const readJson = <A>(key: string, fallback: A): A => {
  try {
    const text = sessionStorage.getItem(key)
    return text === null ? fallback : JSON.parse(text) as A
  } catch {
    return fallback
  }
}

/** The preview tab's world and settings. */
export class PreviewStore {
  readonly scenario: ScenarioId
  readonly cast: Cast
  world: World
  settings: Settings
  #actions: Array<Action>
  #listeners = new Set<() => void>()
  #liveListeners = new Set<(event: LiveEvent | "bounce") => void>()
  #version = 0

  #definitions: ReadonlyMap<string, Apply>

  constructor(scenario: ScenarioId, definitions: ReadonlyArray<ActionDef>) {
    this.#definitions = new Map(definitions.map((definition) => [definition.name, definition.apply]))
    this.scenario = scenario
    this.cast = castOf(scenario)
    this.world = makeWorld(this.cast, new Date())
    this.settings = readJson<Settings>(SETTINGS_KEY, { network: {}, live: "connected", faceId: "approve" })
    this.#actions = readJson<Array<Action>>(ACTIONS_KEY, [])
    for (const action of this.#actions) this.#definitions.get(action.name)?.(this.world, ...action.args)
  }

  /** Changes the world from the mock API: what an app action does (not saved across reloads). */
  update(change: (world: World) => void) {
    change(this.world)
    this.#changed()
  }

  /** Plays a panel action, saves it for reloads and tells the app. */
  act(action: Action) {
    const apply = this.#definitions.get(action.name)
    if (apply === undefined) throw new Error(`No preview action "${action.name}"`)
    const events = apply(this.world, ...action.args) ?? []
    this.#actions.push(action)
    sessionStorage.setItem(ACTIONS_KEY, JSON.stringify(this.#actions))
    for (const event of events) this.emit(event)
    this.bounce()
    this.#changed()
  }

  /** Forgets every panel action and starts the scenario again. */
  reset() {
    sessionStorage.removeItem(ACTIONS_KEY)
    window.location.reload()
  }

  setNetwork(group: string, mode: NetworkMode) {
    if (mode === "normal") delete this.settings.network[group]
    else this.settings.network[group] = mode
    this.#saveSettings()
    this.bounce()
  }

  setLive(mode: LiveMode) {
    this.settings.live = mode
    this.#saveSettings()
    this.bounce()
  }

  setFaceId(mode: FaceIdMode) {
    this.settings.faceId = mode
    this.#saveSettings()
  }

  /** Sends a live event to the app, as the server's stream would. */
  emit(event: LiveEvent) {
    for (const listener of this.#liveListeners) listener(event)
  }

  /** Ends every live stream: the app reconnects and refetches every live query, so it reads the world afresh. */
  bounce() {
    for (const listener of this.#liveListeners) listener("bounce")
  }

  onLive(listener: (event: LiveEvent | "bounce") => void): () => void {
    this.#liveListeners.add(listener)
    return () => this.#liveListeners.delete(listener)
  }

  /** For the panel: re-render when anything changes. */
  subscribe = (listener: () => void): () => void => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  version = (): number => this.#version

  get actions(): ReadonlyArray<Action> {
    return this.#actions
  }

  #saveSettings() {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
    this.#changed()
  }

  #changed() {
    this.#version++
    for (const listener of this.#listeners) listener()
  }
}

let current: PreviewStore | undefined

/** The tab's store, made once by `install`. */
export const previewStore = (): PreviewStore => {
  if (current === undefined) throw new Error("Preview mode isn't installed")
  return current
}

export const createPreviewStore = (scenario: ScenarioId, definitions: ReadonlyArray<ActionDef>): PreviewStore => {
  current = new PreviewStore(scenario, definitions)
  return current
}
