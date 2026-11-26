// bluechip's service worker: shows web pushes (a notification's title and sentence, from the server's `PushMessage`)
// and opens the page a push is about when it is clicked, in an open bluechip window if there is one.

self.addEventListener("push", (event) => {
  const message = event.data === null ? null : event.data.json()
  if (message === null) return
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.id,
      data: { link: message.link }
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.link ?? "/home", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (open === undefined) return self.clients.openWindow(url)
      return open.focus().then(() => open.navigate(url))
    })
  )
})
