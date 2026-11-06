const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
 constructor(){this.value='';this.textContent='';this.hidden=false;this.children=[];this.events={};this.classList={toggle(){}};}
 append(...items){this.children.push(...items)}
 replaceChildren(){this.children=[]}
 setAttribute(){} focus(){} scrollIntoView(){}
 addEventListener(name, fn){this.events[name]=fn}
}
process.chdir(require('node:path').resolve(__dirname,'..'));
const store = new Map(); let blocked=false;
function boot() {
 const elements = new Map();
 const ctx = {document:{documentElement:{style:{setProperty(){}}},querySelector(id){if(!elements.has(id)) elements.set(id,new Element());return elements.get(id)},createElement(){return new Element()}},localStorage:{getItem(k){return store.get(k)??null},setItem(k,v){if(blocked)throw Error('Quota');store.set(k,v)}},window:{addEventListener(){}},navigator:{},location:{protocol:'file:',href:'https://example.github.io/tiny-notes/'},confirm:()=>true,crypto:{randomUUID:()=>String(Math.random())},Intl,Date,Math,console,URL};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('config.js','utf8'),ctx);vm.runInContext(fs.readFileSync('script.js','utf8'),ctx);
 return {get:id=>elements.get(id),submit(text){elements.get('#sentence').value=text;elements.get('#capture').events.submit({preventDefault(){}})}};
}
const settingsContext={};vm.createContext(settingsContext);vm.runInContext(fs.readFileSync('config.js','utf8'),settingsContext);
const storageKey=settingsContext.APP_CONFIG.storageId+':/tiny-notes/';
const saved=()=>JSON.parse(store.get(storageKey)||'[]');
let app=boot();app.submit('   ');assert.equal(saved().length,0);
app.submit('The moon owes me five dollars.');assert.equal(saved().length,1);
const timestamp=saved()[0].createdAt;
app=boot();assert.equal(app.get('#entries').children[0].children[0].textContent,'The moon owes me five dollars.');
app.get('#entries').children[0].children[1].children[1].children[0].onclick();app.submit('The moon owes me ten dollars.');assert.equal(saved()[0].createdAt,timestamp);assert.equal(saved()[0].text,'The moon owes me ten dollars.');
app.submit('<img src=x onerror=alert(1)>');assert.equal(app.get('#entries').children.some(e=>e.children[0].textContent==='<img src=x onerror=alert(1)>'),true);
blocked=true;app.submit('Keep this draft');assert.equal(app.get('#sentence').value,'Keep this draft');assert.equal(saved().length,2);blocked=false;
app.get('#entries').children[0].children[1].children[1].children[1].onclick();assert.equal(saved().length,1);
store.set(storageKey,'broken');app=boot();app.submit('Do not overwrite');assert.equal(store.get(storageKey),'broken');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
for(const icon of manifest.icons)assert.ok(fs.existsSync(''+icon.src));
console.log('PASS: whitespace, save, reopen, edit, original timestamp, literal HTML, storage failure, delete, corrupt-data protection, manifest assets.');

for (const file of ['index.html','script.js','style.css','config.js','sw.js','manifest.webmanifest']) assert.ok(fs.existsSync(file));
const configContext={};vm.createContext(configContext);vm.runInContext(fs.readFileSync('config.js','utf8'),configContext);
assert.equal(manifest.name,configContext.APP_CONFIG.name);
assert.equal(manifest.start_url,'./');
assert.ok(fs.readFileSync('sw.js','utf8').includes("'./config.js'"));
console.log('PASS: template settings and relative PWA paths.');

// Regression: clicking Edit again must never replace the current draft.
store.clear(); app=boot(); app.submit('original');
const actions=()=>app.get('#entries').children[0].children[1].children[1].children;
actions()[0].onclick(); app.get('#sentence').value='unsaved revision';
actions()[0].onclick(); assert.equal(app.get('#sentence').value,'unsaved revision');
assert.equal(saved()[0].text,'original');
// Deleting the edited record preserves the draft and exits edit mode.
actions()[1].onclick(); assert.equal(saved().length,0);
assert.equal(app.get('#sentence').value,'unsaved revision');
assert.equal(app.get('#cancel').hidden,true);
app.submit(app.get('#sentence').value); assert.equal(saved()[0].text,'unsaved revision');
// Finite numbers outside Date's range must be rejected without overwriting storage.
for (const createdAt of [1e20,-1e20]) {
 const raw=JSON.stringify([{id:'x',text:'note',createdAt}]); store.set(storageKey,raw);
 assert.doesNotThrow(()=>{app=boot();});
 assert.match(app.get('#status').textContent,/archive could not be opened/);
 app.submit('keep this draft'); assert.equal(store.get(storageKey),raw);
 assert.equal(app.get('#sentence').value,'keep this draft');
}
console.log('PASS: repeated-edit draft retention, deletion draft retention and resave, invalid-date protection.');
