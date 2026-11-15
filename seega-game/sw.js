const CACHE='seega-v5-20261115';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./game.mjs','./bot.mjs','./socket.io/socket.io.js'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('seega-')&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&url.pathname.includes('/seega/')){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
    }
    return response;
  }).catch(()=>caches.match(event.request,{ignoreSearch:true})));
});
