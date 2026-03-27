const CACHE_NAME = 'dosh-pwa-cache-v8.2';

// 📦 รายชื่อไฟล์ที่ต้องการให้แอปจดจำไว้ในเครื่อง (โหลดไวขึ้น)
const urlsToCache = [
  './',
  './index.html',
  './app.html',
  './style.css',
  './main.js',
  './manifest.json'
];

// ⚙️ ติดตั้ง Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('เปิดใช้งาน Cache สำเร็จ');
        return cache.addAll(urlsToCache);
      })
  );
});

// 🔄 ระบบดึงข้อมูล: ถ้าไม่มีเน็ต ให้ดึงจาก Cache มาแสดงแทน
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) { return response; }
        return fetch(event.request);
      })
  );
});

// 🧹 ล้าง Cache เก่าทิ้งเวลาอัปเดตเวอร์ชัน (v2, v3...)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});