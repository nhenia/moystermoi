// Optional integration test: npm install jsdom fake-indexeddb in an external test runtime.
// USUAL_TEST_MODULES=/absolute/path/to/node_modules node tests/browser-simulation.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const modules=process.env.USUAL_TEST_MODULES;if(!modules)throw Error('Set USUAL_TEST_MODULES to a test runtime containing jsdom and fake-indexeddb.');
const {JSDOM}=require(path.join(modules,'jsdom')),{IDBFactory}=require(path.join(modules,'fake-indexeddb'));
const root=path.resolve(__dirname,'..'),indexedDB=new IDBFactory();let accept=true,downloads=[];
function boot(){const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/the-usual/',runScripts:'outside-only'}),w=dom.window;
 w.Image=class {constructor(){this.naturalWidth=640;this.naturalHeight=480;}set src(value){if(w.importingPhoto){this.naturalWidth=320;this.naturalHeight=240;}queueMicrotask(()=>this.onload());}};
 w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){}});
 w.HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){w.lastCanvas={width:this.width,height:this.height,type,quality};callback(new Blob(['compressed-jpeg'],{type}));};
 w.FileReader=class {async readAsDataURL(blob){try{this.result='data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onload();}catch(error){this.error=error;this.onerror();}}};
 w.indexedDB=indexedDB;w.confirm=()=>accept;w.Blob=Blob;w.BroadcastChannel=undefined;
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test-'+downloads.length;};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 for(const file of ['config.js','core.js','script.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8')+(file==='script.js' ? `\n globalThis.testState={get records(){return records},get db(){return db},failWrites(){const original=db.transaction.bind(db);db.transaction=(...args)=>{const tx=original(...args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};return ()=>{db.transaction=original;};}};` : ''));
 return {w,dom,$:id=>w.document.getElementById(id)};}
const delay=()=>new Promise(r=>setTimeout(r,5));
async function wait(fn){for(let n=0;n<300;n++){if(fn())return;await delay();}throw Error('Timed out waiting for app state');}
const click=(app,button)=>{const b=[...app.$('entries').querySelectorAll('button')].find(b=>b.textContent===button);assert.ok(b,button);b.click();};
const submit=app=>app.$('capture').dispatchEvent(new app.w.Event('submit',{cancelable:true}));
function fill(app,values){for(const [k,v]of Object.entries(values)){app.$(k).value=v;app.$(k).dispatchEvent(new app.w.Event('input'));}}
(async()=>{
 let a=boot();await wait(()=>!a.$('save').disabled);
 fill(a,{name:'José',cue1:'silver glasses',drink:'tequila soda',note1:'quiet greeting'});submit(a);await wait(()=>a.$('status').textContent==='Customer saved.');
 const original=a.w.testState.records[0].createdAt;assert.equal(a.$('entries').children.length,1);
 a.$('search').value='JOSE silver tequila';a.$('search').dispatchEvent(new a.w.Event('input'));assert.equal(a.$('entries').children.length,1);
 a.$('search').value='vodka';a.$('search').dispatchEvent(new a.w.Event('input'));assert.equal(a.$('entries').children.length,0);a.$('clear-search').click();assert.equal(a.$('entries').children.length,1);
 click(a,'Edit');fill(a,{drink:'mezcal soda'});click(a,'Edit');assert.equal(a.$('drink').value,'mezcal soda');submit(a);await wait(()=>a.$('status').textContent==='Customer saved.'&&!a.$('save').disabled);assert.equal(a.w.testState.records[0].createdAt,original);
 click(a,'☆ Favorite');await wait(()=>a.$('status').textContent==='Favorite updated.'&&!a.$('save').disabled);assert.equal(a.w.testState.records[0].favorite,true);
 click(a,'Edit');fill(a,{note2:'unsaved draft'});click(a,'Delete');await wait(()=>!a.$('undo-area').hidden&&!a.$('save').disabled);assert.equal(a.$('note2').value,'unsaved draft');assert.equal(a.$('entries').children.length,0);
 a.$('undo').click();await wait(()=>a.$('status').textContent==='Customer restored.'&&!a.$('save').disabled);assert.equal(a.$('entries').children.length,1);assert.equal(a.$('note2').value,'unsaved draft');
 accept=false;a.$('cancel').click();assert.equal(a.$('note2').value,'unsaved draft');accept=true;a.$('cancel').click();assert.equal(a.$('note2').value,'');
 a.$('add').click();fill(a,{name:'Jose'});assert.equal(a.$('duplicate').hidden,false);accept=false;submit(a);assert.equal(a.$('entries').children.length,1);accept=true;a.$('cancel').click();
 a.$('add').click();fill(a,{name:'Limit',drink:Array(45).fill('word').join(' ')});assert.equal(a.$('word-count').textContent,'46/45 words');submit(a);assert.match(a.$('status').textContent,/45 words/);assert.equal(a.$('name').value,'Limit');
 fill(a,{drink:'<img src=x onerror=alert(1)>'});submit(a);await wait(()=>a.$('status').textContent==='Customer saved.'&&!a.$('save').disabled);assert.equal(a.$('entries').querySelectorAll('img').length,0);assert.ok(a.$('entries').textContent.includes('<img src=x'));
 a.$('add').click();fill(a,{name:'Retained',drink:'draft'});
 const restoreWrites=a.w.testState.failWrites();
 submit(a);await wait(()=>a.$('status').classList.contains('error')&&!a.$('save').disabled);assert.equal(a.$('name').value,'Retained');assert.equal(a.$('drink').value,'draft');assert.equal(a.$('entries').children.length,2);
 restoreWrites();
 a.$('export').click();await wait(()=>a.$('status').textContent.startsWith('Backup download requested')&&!a.$('save').disabled);const backup=JSON.parse(await downloads.at(-1).text());assert.equal(backup.customers.length,2);
 function importValue(value){Object.defineProperty(a.$('import'),'files',{configurable:true,value:[{text:async()=>JSON.stringify(value)}]});a.$('import').dispatchEvent(new a.w.Event('change'));}
 importValue({...backup,customers:[{...backup.customers[0],createdAt:1e20}]});await wait(()=>a.$('status').textContent.startsWith('Import failed')&&!a.$('save').disabled);assert.equal(a.$('entries').children.length,2);assert.equal(a.$('name').value,'Retained');
 const edited={...backup,customers:backup.customers.map((r,n)=>n? r:{...r,drink:'restored order'})};importValue(edited);await wait(()=>a.$('status').textContent==='Imported 2 customers.'&&!a.$('save').disabled);assert.equal(a.$('entries').children.length,2);assert.equal(a.$('name').value,'Retained');assert.ok(a.$('entries').textContent.includes('restored order'));
 importValue(edited);await wait(()=>!a.$('save').disabled);assert.equal(a.$('entries').children.length,2);

 a.$('cancel').click();click(a,'Edit');
 Object.defineProperty(a.$('photo'),'files',{configurable:true,value:[new Blob(['original-large-image'],{type:'image/png'})]});a.$('photo').dispatchEvent(new a.w.Event('change'));
 await wait(()=>a.$('status').textContent.startsWith('Photo ready')&&!a.$('save').disabled);
 assert.equal(a.w.lastCanvas.width,320);assert.equal(a.w.lastCanvas.height,240);assert.equal(a.w.lastCanvas.type,'image/jpeg');assert.equal(a.w.lastCanvas.quality,.65);
 submit(a);await wait(()=>a.$('status').textContent==='Customer saved.'&&!a.$('save').disabled);
 const withPhoto=a.w.testState.records.find(r=>r.photo);assert.equal(withPhoto.photo.type,'image/jpeg');assert.ok(withPhoto.photo.size<=30000);
 a.$('export').click();await wait(()=>a.$('status').textContent.startsWith('Backup download requested')&&!a.$('save').disabled);
 const photoBackup=JSON.parse(await downloads.filter(b=>b.type==='application/json').at(-1).text());assert.ok(photoBackup.customers.some(r=>r.photo?.startsWith('data:image/jpeg;base64,')));
 a.w.importingPhoto=true;importValue(photoBackup);await wait(()=>a.$('status').textContent==='Imported 2 customers.'&&!a.$('save').disabled);assert.ok(a.w.testState.records.some(r=>r.photo instanceof Blob));
 click(a,'Edit');a.$('remove-photo').click();assert.equal(a.$('photo-preview').hidden,true);submit(a);await wait(()=>a.$('status').textContent==='Customer saved.'&&!a.$('save').disabled);assert.ok(a.w.testState.records.every(r=>r.photo===null));

 a.w.testState.db.close();a.dom.window.close();a=boot();await wait(()=>!a.$('save').disabled);assert.equal(a.$('entries').children.length,2);assert.ok(a.$('entries').textContent.includes('restored order'));
 a.w.testState.db.close();a.dom.window.close();
 console.log('PASS: DOM + IndexedDB save/reopen/edit, original timestamp, search/clear, favorite, delete/undo, draft retention, cancel confirmation, duplicate warning, 46-word rejection, literal HTML, failed transaction, export/import, invalid-import atomicity and repeat-import IDs, photo selection/resize/save/export/import/remove (mock image decoder and encoder).');
})().catch(error=>{console.error(error);process.exit(1);});
