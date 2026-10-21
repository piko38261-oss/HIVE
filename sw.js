// เปลี่ยนชื่อ Cache ใหม่เพื่อล้างไฟล์เก่า (v31) ออกจากเครื่องผู้ใช้ทุกคนอัตโนมัติ
const CACHE_NAME = 'hive-pwa-network-first-v32';

const urlsToCache = [
  './',
  './index.html',
  './app.html',
  './style.css',
  './main.js',
  './manifest.json'
];

// 1. ติดตั้ง Service Worker และบังคับให้เริ่มทำงานทันทีไม่ต้องรอปิดแท็บ
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✅ อัปเดตระบบ Cache HIVE เวอร์ชันล่าสุดสำเร็จ');
      return cache.addAll(urlsToCache).catch(() => {});
    })
  );
});

// 2. ลบ Cache เวอร์ชันเก่า (เช่น hive-pwa-cache-v31-stable) ทิ้งทั้งหมดอัตโนมัติ
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
    }).then(() => self.clients.claim())
  );
});

// 3. ดึงไฟล์เวอร์ชันใหม่ล่าสุดจากเซิร์ฟเวอร์ก่อนเสมอ (Network-First) เฉพาะไฟล์ภายในระบบ
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // 🌟 ปล่อยผ่านคำขอไปยัง API ภายนอก (GIPHY, Google Gemini, Firebase อื่นๆ) ไม่ให้ Service Worker มายุ่ง
  if (!requestUrl.origin.includes(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(networkResponse => {
        // อัปเดตไฟล์ใหม่ล่าสุดเก็บสำรองไว้ใน Cache เผื่อตอนเน็ตหลุด
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        // ถ้าไม่มีอินเทอร์เน็ต ค่อยดึงจาก Cache มาแสดง
        return caches.match(event.request);
      })
  );
});