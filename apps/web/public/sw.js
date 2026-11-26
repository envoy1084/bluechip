// bluechip's service worker: shows web pushes (a notification's title, sentence and buttons, from the server's
// `PushMessage`) and opens the page a push is about when it is clicked, in an open bluechip window if there is one.
// A button (Pause all agents, Cancel recovery) acts right away with this browser's session, without Face ID, as the
// bell's buttons do: both only take power away. Review, and a button that can't act (signed out, offline), opens the
// page instead.

// Each button's request to bluechip's API, on this origin (as the app's requests are).
const REQUESTS = {
  pauseAll: "/api/agents/pause-all",
  cancelRecovery: "/api/account/recovery/cancel"
}

self.addEventListener("push", (event) => {
  const message = event.data === null ? null : event.data.json()
  if (message === null) return
  const actions = message.actions ?? []
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.id,
      data: { link: message.link, actions },
      actions: actions.map(({ action, title }) => ({ action, title }))
    })
  )
})

const openPage = (link) => {
  const url = new URL(link ?? "/home", self.location.origin).href
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (open === undefined) return self.clients.openWindow(url)
    return open.focus().then(() => open.navigate(url))
  })
}

const act = (action, data) =>
  fetch(REQUESTS[action], { method: "POST", credentials: "same-origin" }).then((response) => {
    if (!response.ok) return openPage(data.link)
    const done = (data.actions ?? []).find((each) => each.action === action)?.done
    return done === undefined ? undefined : self.registration.showNotification(done, { tag: `${action}-done` })
  }, () => openPage(data.link))

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const data = event.notification.data ?? {}
  event.waitUntil(event.action in REQUESTS ? act(event.action, data) : openPage(data.link))
})
