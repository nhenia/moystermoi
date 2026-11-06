const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');const write=(f,t)=>fs.writeFileSync(path.join(root,f),t);
const sources=JSON.parse(read('sources.json'));const categories=['Foundations','Fragrance concept','Materials & accords','History & ritual','Formulation reference','Sourcing & safety','Critical thought'];
const entries=[];const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const terms=['jasmine','ink','incense','clay','stone','smoke','hinoki','soil','rain','wax','salt','spikenard','charcoal','sakura','myth','ritual','femininity','research'];
sources.forEach((s,index)=>{s.title=s.text.split('\n')[0].replace(/^# PERFUME 7 — /,'');s.status=s.text.split('\n').find(l=>l.startsWith('Status: ')).slice(8);for(const chunk of s.text.split(/^## /m).slice(1)){const lines=chunk.trim().split('\n'),title=lines.shift(),body=lines.join('\n').trim();entries.push({id:slug(categories[index]+'-'+title),title,body,source:index,category:categories[index],status:s.status,tags:terms.filter(t=>body.toLowerCase().includes(t))});}});
write('content.js','globalThis.P7_CONTENT = '+JSON.stringify({sources,entries},null,2)+';\n');
const sandbox={};vm.runInNewContext(read('config.js'),sandbox);const c=sandbox.APP_CONFIG;const manifest=JSON.parse(read('manifest.webmanifest'));Object.assign(manifest,{name:c.name,short_name:c.shortName,description:c.description,start_url:'./',scope:'./',background_color:c.colors.background,theme_color:c.colors.background});write('manifest.webmanifest',JSON.stringify(manifest,null,2)+'\n');
const assets=['index.html','style.css','config.js','core.js','content.js','sources.json','script.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','.nojekyll'];const hash=crypto.createHash('sha256');for(const f of assets)hash.update(read(f));const version=hash.digest('hex').slice(0,12);
write('sw.js',`const PREFIX='perfume7-'+self.registration.scope+'-';
const CACHE=PREFIX+'${version}';
const ASSETS=${JSON.stringify(['./',...assets.map(f=>'./'+f)])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
`);
if(process.argv.includes('--publish')){const dest=path.resolve(root,'../../_site/perfume-7');fs.mkdirSync(dest,{recursive:true});for(const f of [...assets,'sw.js'])fs.copyFileSync(path.join(root,f),path.join(dest,f));}
console.log('Prepared '+entries.length+' entries from '+sources.length+' sources.');
