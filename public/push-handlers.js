// Avisos push de IngApp. El service worker principal (generado por Workbox) carga este archivo con importScripts.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'IngApp', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'ingapp',
      data: { url: data.url || '/' },
    }),
  )
})

// Al tocar el aviso se abre la app en la pantalla que corresponde (o se usa la que ya estaba abierta).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = (event.notification.data && event.notification.data.url) || '/'
  const target = new URL('#' + path, self.registration.scope).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          await client.focus()
          try {
            await client.navigate(target)
          } catch {
            // algunos navegadores no dejan navegar una ventana ya abierta: queda donde estaba
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
