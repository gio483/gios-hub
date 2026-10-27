// Service worker for The Making of a Man (v2)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'The Making of a Man', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'The Making of a Man', {
    body: d.body || '', icon: '/vibe/icon-192.png', badge: '/vibe/icon-192.png', tag: 'mom-' + (d.url || 'daily'), data: { url: d.url || '/vibe/readings.html' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/vibe/readings.html', self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/vibe/')) {
        try { await c.focus(); } catch (_) {}
        try { if (c.navigate) { await c.navigate(url); return; } } catch (_) {}
        try { c.postMessage({ type: 'open', url }); return; } catch (_) {}
      }
    }
    await self.clients.openWindow(url);
  })());
});
// If iOS rotates the push subscription, re-save it automatically
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    try {
      const { key } = await fetch('/api/lifeos?ns=mom&action=vapid').then(r => r.json());
      if (!key) return;
      const pad = '='.repeat((4 - key.length % 4) % 4);
      const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from([...raw].map(c => c.charCodeAt(0))) });
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      all.forEach(c => c.postMessage({ type: 'resub' }));
    } catch (_) {}
  })());
});
