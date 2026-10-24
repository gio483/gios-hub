// Service worker for The Making of a Man
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'The Making of a Man', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'The Making of a Man', {
    body: d.body || '', icon: '/vibe/icon-192.png', badge: '/vibe/icon-192.png', data: { url: d.url || '/vibe/readings.html' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/vibe/readings.html';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if (c.url.includes('/vibe/')) { await c.focus(); c.navigate(url); return; } }
    await self.clients.openWindow(url);
  })());
});
