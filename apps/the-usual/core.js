/* Shared validation and search: used by the app and its tests. */
(function(root) {
  'use strict';
  const fields = ['name','cue1','cue2','drink','note1','note2'];
  const normalize = text => text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
  const words = record => fields.reduce((count,key) => count + (record[key]?.trim() ? record[key].trim().split(/\s+/u).length : 0),0);
  function validate(record) {
    if (!record || typeof record !== 'object' || fields.some(key => typeof record[key] !== 'string')) throw Error('Invalid customer fields.');
    if (!record.name.trim()) throw Error('Add a name first.');
    if (words(record)>45) throw Error('Keep this customer to 45 words or fewer.');
    if (typeof record.id !== 'string' || !record.id || typeof record.favorite !== 'boolean' || !Number.isFinite(record.createdAt) || !Number.isFinite(new Date(record.createdAt).getTime())) throw Error('Invalid customer record.');
    return record;
  }
  function search(records,query) {
    const q=normalize(query),tokens=q.split(' ').filter(Boolean);
    const rank=r=>normalize(r.name)===q ? 0 : normalize(r.name).startsWith(q) ? 1 : 2;
    return records.filter(r=>{const haystack=normalize(fields.map(k=>r[k]).join(' '));return tokens.every(t=>haystack.includes(t));})
      .sort((a,b)=>(q ? rank(a)-rank(b) : 0) || Number(b.favorite)-Number(a.favorite) || normalize(a.name).localeCompare(normalize(b.name)) || a.id.localeCompare(b.id));
  }
  function validateBackup(value) {
    if (!value || value.app !== 'the-usual' || value.version !== 1 || !Array.isArray(value.customers)) throw Error('Choose a The Usual backup file.');
    const ids=new Set();
    return value.customers.map(record=>{
      validate(record);
      if(ids.has(record.id)) throw Error('Backup contains duplicate record IDs.'); ids.add(record.id);
      if(record.photo !== null && (typeof record.photo !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(record.photo))) throw Error('Invalid backup photo.');
      return {...Object.fromEntries(fields.map(k=>[k,record[k]])),id:record.id,favorite:record.favorite,createdAt:record.createdAt,photo:record.photo};
    });
  }
  const api={fields,normalize,words,validate,search,validateBackup};
  if(typeof module!=='undefined') module.exports=api; else root.UsualCore=api;
})(globalThis);
