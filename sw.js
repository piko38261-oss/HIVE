const CACHE_NAME = 'dosh-pwa-cache-v2'; // 🌟 เปลี่ยนตรงนี้เป็น v2 เพื่อบังคับล้างแคชเก่า!
const urlsToCache = [
  './',
  './index.html',
  './app.html',
  './admin.html',
  './style.css',
  './main.js'
];

// โหลดไฟล์ทั้งหมดเก็บไว้ในเครื่องผู้ใช้ตอนเข้าแอปครั้งแรก
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('DOSH Caching files (v2)...');
        return cache.addAll(urlsToCache);
      })
  );
});

// เวลาใช้งานแอป ให้ดึงข้อมูลจากเครื่องก่อนเน็ต
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) { return response; }
        return fetch(event.request);
      })
  );
});

// เคลียร์แคชเก่าทิ้งเวลาแอปมีการอัปเดตเวอร์ชันใหม่
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('🗑️ ลบแคชเวอร์ชันเก่าทิ้ง:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});