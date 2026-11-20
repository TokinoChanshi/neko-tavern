// 猫猫酒馆 PWA 轻量守护脚本（不劫持 /api 流式请求，支持桌面/手机独立窗口安装）
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) {
    return
  }
  event.respondWith(fetch(request))
})
