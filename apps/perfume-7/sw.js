const PREFIX='perfume7-'+self.registration.scope+'-';
const CACHE=PREFIX+'32f2b2fc3a34';
const ASSETS=["./","./index.html","./style.css","./config.js","./core.js","./content.js","./sources.json","./script.js","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png","./.nojekyll"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
