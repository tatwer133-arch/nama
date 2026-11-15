const CACHE='seega-v2-static';
self.addEventListener('install', event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./game.mjs','./socket.io/socket.io.js'])));
  self.skipWaiting();
});
self.addEventListener('activate', event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.includes('/socket.io/')) return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
