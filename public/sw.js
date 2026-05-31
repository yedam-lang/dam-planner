const CACHE = 'dam-planner-v1'
const PRECACHE = ['/', '/notes', '/calendar', '/word']

// 설치: 주요 페이지 미리 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

// 활성화: 이전 캐시 정리
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  if (!request.url.startsWith('http')) return

  // 페이지 이동: 네트워크 우선, 실패 시 캐시
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('/'))
        )
    )
    return
  }

  // Next.js 정적 파일: 캐시 우선
  if (request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // 아이콘 등 기타 정적 자원: 캐시 우선
  if (request.url.includes('/icons/') || request.url.includes('/favicon')) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    )
    return
  }
})
