const CACHE='mi-orquideario-plantnet-v3';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);

  // Never cache API calls or non-GET requests.
  if(req.method!=='GET' || url.pathname.startsWith('/api/')) return;

  // Network-first for page navigation so deployments appear immediately.
  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req)
        .then(resp=>{
          const copy=resp.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          return resp;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for static files, with network fallback.
  event.respondWith(
    caches.match(req).then(cached=>cached || fetch(req).then(resp=>{
      if(resp.ok && url.origin===self.location.origin){
        const copy=resp.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy));
      }
      return resp;
    }))
  );
});
