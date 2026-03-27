const CACHE_NAME = 'hive-pwa-cache-v8';

const urlsToCache = [
  './',
  './index.html',
  './app.html',
  './style.css',
  './main.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName); // ลบแคช V7 ทิ้ง
        })
      );
    })
  );
});

// 🌟 ระบบใหม่! ดักจับเวลากดแจ้งเตือน (Notification Click)
self.addEventListener('notificationclick', event => {
  event.notification.close(); // ปิดแจ้งเตือนบนหน้าจอ
  
  // สั่งให้เด้งกลับมาที่หน้าเว็บแอป HIVE
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // 1. ถ้าแอปเปิดแช่อยู่เบื้องหลัง ให้ดึงขึ้นมาด้านหน้า (Focus)
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. ถ้าแอปถูกปิดไปแล้ว ให้เปิดหน้าแอปขึ้นมาใหม่
      if (clients.openWindow) {
        return clients.openWindow('/'); 
      }
    })
  );
});