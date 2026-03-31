const CACHE_NAME = 'hive-pwa-cache-v17';

const urlsToCache = [
  './',
  './index.html',
  './app.html',
  './style.css',
  './main.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
        console.log('เปิดใช้งาน Cache HIVE V15 สำเร็จ');
        return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
});

// 🌟 ดักจับการกดแจ้งเตือนบนมือถือ
self.addEventListener('notificationclick', event => {
  if (event.action === 'leave_call') {
    event.notification.close(); 
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        windowClients.forEach(client => {
          client.postMessage({ command: 'leave_voice' });
        });
      })
    );
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow('/'); 
      })
    );
  }
});