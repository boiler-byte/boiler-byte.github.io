/* Run: node tests/offline-manager.test.cjs. Simulated DOM and worker messages. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../workspace');
const scope = 'https://example.test/project/workspace/';
class Element {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.dataset={}; this.listeners={}; this.textContent=''; this.value=''; this.disabled=false; this.hidden=false; }
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(){}
  addEventListener(name,callback){this.listeners[name]=callback;}
  emit(name,event={}){return this.listeners[name]?.(event);}
  click(){if(!this.disabled) this.emit('click');}
  text(){return [this.textContent,...this.children.map(child=>child.text())].join(' ');}
}
const ids=new Map(); const ui=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const document=new Element(); Object.assign(document,{getElementById:ui,createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element('fragment'),visibilityState:'visible'});
const window=new Element(); window.confirm=()=>true;
const navigator={onLine:true,serviceWorker:new Element()};
const repos=['Installed','Missing','NoPackage','OtherWorkspace'].map(label=>({label,url:`workspace/apps/${label}/index.html`,type:'tool'}));
const groups=new Map([['other',{label:'Other',repos:[repos[3]]}]]);
const stores={workspace:{selected:'favorites'},favorites:repos.slice(0,3).map(r=>r.label),favoriteOrder:[]};
const B=window.BoilerRoom={data:{repos,types:{tool:{label:'Tool'}},getGroups:()=>groups},storage:{init(){},get:key=>stores[key]},searchRelevance:{normalize:s=>s,score:(repo,query)=>repo.label.includes(query)?0:-1}};
let now=Date.now(), timers=0;
class Clock extends Date { static now(){return now;} }
const context=vm.createContext({window,document,navigator,URL,URLSearchParams,Date:Clock,location:{href:scope+'offline.html',search:''},history:{replaceState(){}},Option:Element,setInterval:()=>{timers++;}});
vm.runInContext(fs.readFileSync(path.join(root,'offline-model.js'),'utf8'),context);
const M=vm.runInContext('globalThis.BoilerRoomOfflineModel',context);
const metadata=v=>({schema_version:2,version:v,version_name:`${v}.0.0`,offline:{mode:'full',limitations:[]},files:['app.js']});
const desc=(repo,v)=>({...M.describe(repo,scope,metadata(v)),checkedAt:now});
const record=(repo,v)=>({...desc(repo,v).pkg,complete:true,installedAt:new Date().toISOString()});
const installed=new Map([['Installed',record(repos[0],1)]]);
const results=new Map([['Installed',desc(repos[0],1)],['Missing',desc(repos[1],1)],['NoPackage',{kind:'unsupported',reason:'Keine boiler-room.json gefunden.',checkedAt:now}],['OtherWorkspace',desc(repos[3],1)]]);
const discoveries=[], installations=[];
B.offline={describe:repo=>M.locate(repo,scope),status:M.status,statusLabel:M.statusLabel,isVersionCheckFresh:M.isVersionCheckFresh,
  async request(action,payload){if(action==='list')return [...installed.values()];if(action==='install'){const label=payload.repo.label;installations.push(label);const result=record(payload.repo,results.get(label).pkg.version*1);installed.set(label,result);return result;}throw Error(action);},
  async discover(repo,options){discoveries.push({label:repo.label,...options});return results.get(repo.label);},
  async snapshot(){return [...installed.values()];},async cachedDescription(repo){return results.get(repo.label);}};
vm.runInContext(fs.readFileSync(path.join(root,'offline-manager.js'),'utf8'),context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await flush();
  assert.deepEqual(discoveries.map(d=>d.label).sort(),['Installed','Missing','NoPackage']);
  assert(discoveries.every(d=>!d.force && !d.cacheOnly));
  discoveries.length=0; window.emit('pageshow',{persisted:false}); await flush();
  assert.equal(discoveries.length,0); // no duplicate opening check
  assert.equal(timers,0);
  assert.match(ui('offlineList').text(),/Offline bereit/);
  assert(ui('updateAll').hidden); assert.equal(ui('installAll').textContent,'Bereitstellen (1)');
  assert.equal(ui('checkVersions').disabled,false);
  results.set('Installed',desc(repos[0],2));
  discoveries.length=0; ui('checkVersions').click(); await flush();
  assert.equal(discoveries.length,3); assert(discoveries.every(d=>d.force===true && !d.cacheOnly));
  assert.match(ui('offlineList').text(),/Version 2.0.0 verfügbar/);
  assert.equal(ui('updateAll').hidden,false); assert.equal(ui('updateAll').textContent,'Alle Aktualisieren (1)');
  assert.equal(ui('installAll').textContent,'Bereitstellen (1)');
  navigator.onLine=false;discoveries.length=0;window.emit('offline');window.emit('pageshow',{persisted:true});await flush();
  assert.equal(ui('updateAll').hidden,false);assert(ui('updateAll').disabled);assert(ui('checkVersions').disabled);
  assert(discoveries.slice(-3).every(d=>d.cacheOnly));assert.match(ui('offlineList').text(),/Version 2.0.0 verfügbar/);
  discoveries.length=0;navigator.onLine=true;window.emit('online');await flush();
  assert.equal(discoveries.length,3);assert(discoveries.every(d=>d.cacheOnly && !d.force));
  discoveries.length=0;ui('updateAll').click();await flush();
  assert(discoveries.length>0 && discoveries.every(d=>d.cacheOnly));
  assert.deepEqual(installations,['Installed']);assert(ui('updateAll').hidden);assert.match(ui('offlineList').text(),/Offline bereit/);
  ui('installAll').click();await flush();assert.deepEqual(installations,['Installed','Missing']);
  discoveries.length=0;ui('offlineWorkspace').value='group:other';ui('offlineWorkspace').emit('change');await flush();
  assert.deepEqual(discoveries.map(d=>d.label),['OtherWorkspace']);
  assert(discoveries.every(d=>d.cacheOnly && !d.force));
  now+=8*24*60*60*1000;
  for(const trigger of [()=>document.emit('visibilitychange'),()=>window.emit('storage',{key:'boilerRoom'}),()=>navigator.serviceWorker.emit('message',{data:{protocol:'boiler-room-offline-v1',changed:true}}),()=>navigator.serviceWorker.emit('controllerchange')]){
    discoveries.length=0;trigger();await flush();
    assert.equal(discoveries.length,1);assert(discoveries.every(d=>d.cacheOnly && !d.force));
  }
  discoveries.length=0; window.emit('pageshow',{persisted:true}); await flush();
  assert.deepEqual(discoveries.map(d=>d.label),['OtherWorkspace']);
  assert(discoveries.every(d=>!d.cacheOnly && !d.force));
  discoveries.length=0;ui('checkVersions').click();await flush();
  assert.equal(discoveries.length,1);assert(discoveries.every(d=>d.force && !d.cacheOnly));
  assert.equal(timers,0);
  console.log('OK: only opening/history restoration and manual check may fetch manifests; other events cache-only; update and provisioning controls intact.');
})().catch(error=>{console.error(error);process.exitCode=1;});
