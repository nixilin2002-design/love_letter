const CACHE = 'love-letter-v5';

// ✅ Fix: Removed /music.mp3 from precache assets.
// Large files cause SW installation to fail if the fetch times out,
// rolling back the entire cache. Music is now cached at runtime on first play.
const ASSETS = ['/love_letter/', '/love_letter/index.html', '/love_letter/manifest.json', '/love_letter/icon-192.png', '/love_letter/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for external APIs, fallback to cache
  if (e.request.url.includes('open-meteo.com') || e.request.url.includes('nominatim')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // ✅ Fix: Cache music.mp3 at runtime (not precache) to avoid install failure
  if (e.request.url.includes('music.mp3')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Cache-first for all other assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});

// ── Push notification handler ──
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || '每日情书 💌';
  const body = data.body || '今天的情书在等你，点开看看吧～';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/love_letter/icon-192.png',
      badge: '/love_letter/icon-192.png',
      tag: 'daily-letter',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});

// ── Daily local notification ──
// ✅ Fix: SW can be killed by browser at any time, so setTimeout alone is not reliable.
// The main page should call SCHEDULE_DAILY every time the app opens to re-register the timer.
// This acts as a backup to the server-side Netlify push notification.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_DAILY') {
    scheduleDailyNotif(e.data.hour, e.data.minute);
  }
});

let notifTimer = null;
function scheduleDailyNotif(hour, minute) {
  if (notifTimer) clearTimeout(notifTimer);
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  notifTimer = setTimeout(() => {
    const messages = [
      '今天的情书在等你 💌',
      '有一封信，只写给你～',
      '打开看看，今天有新的话给你 🌸',
      '你的专属情书送达了 ❤️',
      '今天也要好好的，打开看看吧 🌤️',
    ];
    const body = messages[new Date().getDate() % messages.length];
    self.registration.showNotification('每日情书 💌', {
      body,
      icon: '/love_letter/icon-192.png',
      badge: '/love_letter/icon-192.png',
      tag: 'daily-letter',
      renotify: true,
      data: { url: '/' }
    });
    scheduleDailyNotif(hour, minute); // reschedule for next day
  }, ms);
}
