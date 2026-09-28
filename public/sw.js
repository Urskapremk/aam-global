// AAM Admin push service worker.
// Shows a notification (with the device's default sound + vibration) whenever
// the server sends a push — even when the app is closed or the phone is locked.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'AAM', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'AAM'
  const options = {
    body: data.body || '',
    icon: '/images/aam-icon-192.png',
    badge: '/images/aam-icon-192.png',
    // Vibration pattern for phones (ms on/off). Sound is the system default.
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'aam-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/admin' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/admin'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an already-open admin tab if there is one.
      for (const client of clients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    }),
  )
})
