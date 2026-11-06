// Optional local preview. Run node scripts/serve.cjs and open the printed address.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const publicFiles = new Set(['index.html','style.css','script.js','core.js','config.js','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png']);
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?'index.html':pathname.slice(1);
 if(!publicFiles.has(file)){res.writeHead(404);return res.end('Not found');}
 fs.readFile(path.join(root,file),(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'text/plain'});res.end(err?'Not found':data);});
}).listen(4174,'127.0.0.1',()=>console.log('Open http://127.0.0.1:4174 — press Ctrl+C to stop.'));
