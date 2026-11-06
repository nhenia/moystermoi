// Synchronize settings with installation metadata, then version the offline cache.
// Uses only Node's built-in tools; no packages or accounts needed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'config.js'),'utf8'), context);
const c = context.APP_CONFIG;
for (const key of ['name','shortName','description','inputLabel','saveLabel','archiveLabel','emptyMessage','storageId']) {
  if (typeof c[key] !== 'string' || !c[key].trim()) throw Error('Fill in config.js: ' + key);
}
for(const key of ['background','ink','accent','muted']) if(!/^#[0-9a-f]{6}$/i.test(c.colors[key])) throw Error('Use a six-digit hex color for '+key);
const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<title>.*?<\/title>/,()=>`<title>${escape(c.name)}</title>`)
 .replace(/(<meta name="description" content=")[^"]*/,()=>`<meta name="description" content="${escape(c.description)}`)
 .replace(/(<meta name="theme-color" content=")[^"]*/,()=>`<meta name="theme-color" content="${c.colors.accent}`)
 .replace(/<h1 id="app-name">.*?<\/h1>/,()=>`<h1 id="app-name">${escape(c.name)}</h1>`);
fs.writeFileSync(path.join(root,'index.html'), html);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
Object.assign(manifest,{name:c.name,short_name:c.shortName,description:c.description,theme_color:c.colors.accent,background_color:c.colors.background});
fs.writeFileSync(path.join(root,'manifest.webmanifest'), JSON.stringify(manifest,null,2)+'\n');
const files=['index.html','config.js','script.js','core.js','style.css','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
const digest=crypto.createHash('sha256');
for(const file of files) digest.update(fs.readFileSync(path.join(root,file)));
const version=digest.digest('hex').slice(0,12);
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/const CACHE = .*;/,()=> 'const CACHE = `${PREFIX}'+version+'`;');
fs.writeFileSync(path.join(root,'sw.js'),sw);
console.log('Ready: '+c.name+'. Phone metadata and offline version updated.');
