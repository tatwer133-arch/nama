const CACHE='seega-v1';
self.addEventListener('install', event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/styles.css','/app.js','/manifest.json','/icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/socket.io')) return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
