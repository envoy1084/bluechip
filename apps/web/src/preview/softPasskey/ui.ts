// The software passkey's own controls, in plain DOM beside the app (never in React's tree): a dialog to pick a key
// for a discoverable sign-in, and a badge in the bottom-right corner (preview's god mode pill is bottom-left).
import { turnSoftPasskeyOff } from "./activation.ts"
import type { Keyring, SoftCredential } from "./Keyring.ts"

// Long enough for the app to hydrate the document first: until then React owns `<body>`'s markup.
const AFTER_HYDRATION_MS = 600

const FONT = "font: 13px/1.4 system-ui, sans-serif; color: #10131a;"
const BUTTON =
  "display: block; width: 100%; text-align: left; padding: 8px 10px; border: 1px solid #d9dde6; border-radius: 8px; background: #fff; cursor: pointer; font: inherit; color: inherit;"

const describe = (credential: SoftCredential) =>
  `${credential.label}, made ${new Date(credential.createdAt).toLocaleString()}`

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { readonly text?: string; readonly style?: string; readonly attributes?: Record<string, string> } = {}
) => {
  const node = document.createElement(tag)
  if (props.text !== undefined) node.textContent = props.text
  if (props.style !== undefined) node.style.cssText = props.style
  for (const [name, value] of Object.entries(props.attributes ?? {})) node.setAttribute(name, value)
  return node
}

/** Asks which key signs in, newest first and focused; cancelling answers as a person dismissing the prompt would. */
export const chooseCredential = (candidates: ReadonlyArray<SoftCredential>, signal?: AbortSignal) =>
  new Promise<SoftCredential>((resolve, reject) => {
    const dialog = element("dialog", {
      style: `${FONT} border: 1px solid #d9dde6; border-radius: 12px; padding: 16px; width: min(360px, 90vw);`,
      attributes: { "aria-labelledby": "bluechip-soft-passkey-title", "data-soft-passkey": "chooser" }
    })
    const title = element("h2", {
      text: "Software passkey: choose a key",
      style: "font-size: 15px; margin: 0 0 12px;",
      attributes: { id: "bluechip-soft-passkey-title" }
    })
    const list = element("div", { style: "display: grid; gap: 6px;" })

    const close = (settle: () => void) => {
      signal?.removeEventListener("abort", onAbort)
      dialog.close()
      dialog.remove()
      settle()
    }
    const onAbort = () => close(() => reject(new DOMException("The operation was aborted.", "AbortError")))
    const cancel = () =>
      close(() => reject(new DOMException("The software passkey prompt was cancelled.", "NotAllowedError")))

    for (const [index, candidate] of candidates.entries()) {
      const option = element("button", {
        text: describe(candidate),
        style: BUTTON,
        attributes: { type: "button", ...(index === 0 ? { autofocus: "" } : {}) }
      })
      option.addEventListener("click", () => close(() => resolve(candidate)))
      list.append(option)
    }
    const cancelButton = element("button", {
      text: "Cancel",
      style: `${BUTTON} margin-top: 10px; text-align: center;`,
      attributes: { type: "button" }
    })
    cancelButton.addEventListener("click", cancel)
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault()
      cancel()
    })
    signal?.addEventListener("abort", onAbort, { once: true })

    dialog.append(title, list, cancelButton)
    document.body.append(dialog)
    dialog.showModal()
  })

/** Mounts the badge after hydration; `refresh` updates its count after a new key. */
export const mountBadge = (keyring: Keyring) => {
  const root = element("div", {
    style: `${FONT} position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;`,
    attributes: { id: "bluechip-soft-passkey" }
  })
  const toggle = element("button", {
    style:
      "border: 1px solid #d9dde6; border-radius: 999px; padding: 6px 12px; background: #fff; box-shadow: 0 2px 8px rgb(16 19 26 / 0.08); cursor: pointer; font: inherit; color: inherit;",
    attributes: {
      type: "button",
      "aria-haspopup": "true",
      "aria-expanded": "false",
      "aria-controls": "bluechip-soft-passkey-menu"
    }
  })
  const menu = element("div", {
    style:
      "position: absolute; right: 0; bottom: calc(100% + 8px); width: 300px; padding: 12px; display: grid; gap: 6px; border: 1px solid #d9dde6; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgb(16 19 26 / 0.12);",
    attributes: { id: "bluechip-soft-passkey-menu", role: "region", "aria-label": "Software passkey keys" }
  })
  menu.hidden = true

  const render = () => {
    const credentials = keyring.list().toSorted((a, b) => b.createdAt - a.createdAt)
    toggle.textContent = `Software passkey, ${credentials.length} ${credentials.length === 1 ? "key" : "keys"}`

    const keys = credentials.length === 0 ?
      [element("p", { text: "No keys yet. Sign up or add a passkey to make one.", style: "margin: 0;" })] :
      credentials.map((credential) =>
        element("p", {
          text: `${describe(credential)}, used ${credential.counter} times, for ${credential.rpId}`,
          style: "margin: 0;"
        })
      )
    const forget = element("button", {
      text: "Forget all keys",
      style: `${BUTTON} margin-top: 6px;`,
      attributes: { type: "button" }
    })
    forget.addEventListener("click", () => {
      keyring.save([])
      render()
    })
    const off = element("button", {
      text: "Turn the software passkey off",
      style: BUTTON,
      attributes: { type: "button" }
    })
    off.addEventListener("click", turnSoftPasskeyOff)
    menu.replaceChildren(...keys, forget, off)
  }

  toggle.addEventListener("click", () => {
    menu.hidden = !menu.hidden
    toggle.setAttribute("aria-expanded", String(!menu.hidden))
    if (!menu.hidden) render()
  })
  root.append(menu, toggle)
  render()

  const start = () => {
    if (document.getElementById(root.id) === null) document.body.append(root)
  }
  // The software passkey installs while the page loads, so the load event may already be over.
  if (document.readyState === "complete") setTimeout(start, AFTER_HYDRATION_MS)
  else window.addEventListener("load", () => setTimeout(start, AFTER_HYDRATION_MS), { once: true })

  return { refresh: render }
}
