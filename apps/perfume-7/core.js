(function(root){
const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function filterEntries(entries,{query='',view='library',section='',saved=[]}={}){
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 return entries.filter(e=>(view!=='materials'||e.source===2)&&(view!=='research'||![1,2].includes(e.source))&&(view!=='saved'||saved.includes(e.id))&&(!section||String(e.source)===section)&&words.every(w=>normalize([e.title,e.body,e.category,...e.tags].join(' ')).includes(w)));
}
function readBookmarks(storage,key,entries){const raw=storage.getItem(key);const ids=raw===null?[]:JSON.parse(raw);if(!Array.isArray(ids)||ids.some(x=>typeof x!=='string'))throw Error('Invalid bookmarks');return [...new Set(ids)].filter(id=>entries.some(e=>e.id===id));}
const api={normalize,filterEntries,readBookmarks};root.P7Core=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
