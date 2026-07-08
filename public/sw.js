self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  self.clients.claim()
})

self.addEventListener('fetch', () => {
  // Basic passthrough — required for Chrome to consider this installable
})self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  self.clients.claim()
})

self.addEventListener('fetch', () => {
  // Basic passthrough — required for Chrome to consider this installable
})