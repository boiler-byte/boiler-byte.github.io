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
  setAttribute(name,value){(this.attributes ||= {})[name]=value;}
  addEventListener(name,callback){this.listeners[name]=callback;}
  emit(name,event={}){return this.listeners[name]?.(event);}
  click(){if(!this.disabled) this.emit('click');}
  text(){return [this.textContent,...this.children.map(child=>child.text())].join(' ');}
}
const ids=new Map(); const ui=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const document=new Element(); Object.assign(document,{getElementById:ui,createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element('fragment'),visibilityState:'visible'});
const window=new Element(); window.confirm=()=>true;
const navigator={onLine:true,serviceWorker:new Element()};
const repos=['Installed','Missing','NoPackage','OtherWorkspace'].map(label=>({label,url:`workspace/apps/${label}/index.html`,type:'tool',boiler_room_pwa:true}));
const excluded = ['FlagMissing','FlagFalse','FlagString','FlagNumber','FlagNull'].map(label=>({label,url:`workspace/apps/${label}/index.html`,type:'tool'}));
[false,'true',1,null].forEach((value,i)=>excluded[i+1].boiler_room_pwa=value);
repos.push(...excluded);
const groups=new Map([['other',{label:'Other',repos:[repos[3],...excluded]}]]);
const stores={workspace:{selected:'favorites'},favorites:[...repos.slice(0,3),...excluded].map(r=>r.label),favoriteOrder:[]};
const B=window.BoilerRoom={data:{repos,types:{tool:{label:'Tool'}},getGroups:()=>groups},storage:{init(){},get:key=>stores[key]},searchRelevance:{normalize:s=>s,score:(repo,query)=>repo.label.includes(query)?0:-1}};
let now=Date.now(), timers=0, tick;
class Clock extends Date { static now(){return now;} }
const context=vm.createContext({window,document,navigator,URL,URLSearchParams,Date:Clock,location:{href:scope+'offline.html',search:''},history:{replaceState(){}},Option:Element,setInterval:fn=>{timers++;tick=fn;}});
vm.runInContext(fs.readFileSync(path.join(root,'offline-model.js'),'utf8'),context);
const M=vm.runInContext('globalThis.BoilerRoomOfflineModel',context);
const metadata=v=>({schema_version:2,version:v,version_name:`${v}.0.0`,offline:{mode:'full',limitations:[]},files:['app.js']});
const desc=(repo,v)=>({...M.describe(repo,scope,metadata(v)),checkedAt:now});
const record=(repo,v)=>({...desc(repo,v).pkg,complete:true,installedAt:new Date().toISOString()});
const installed=new Map([['Installed',record(repos[0],1)]]);
for (const repo of excluded) installed.set(repo.label,record(repo,1));
installed.set('OldRemoved',record({label:'OldRemoved',url:'workspace/apps/old/index.html'},1));
const results=new Map([['Installed',desc(repos[0],1)],['Missing',desc(repos[1],1)],['NoPackage',{kind:'unsupported',reason:'Keine boiler-room.json gefunden.',checkedAt:now}],['OtherWorkspace',desc(repos[3],1)]]);
for (const repo of excluded) results.set(repo.label,desc(repo,1));
const discoveries=[], installations=[], removals=[];
B.offline={describe:repo=>M.locate(repo,scope),status:M.status,statusLabel:M.statusLabel,isVersionCheckFresh:M.isVersionCheckFresh,
  async request(action,payload){if(action==='list')return [...installed.values()];if(action==='install'){const label=payload.repo.label;installations.push(label);const result=record(payload.repo,results.get(label).pkg.version*1);installed.set(label,result);return result;}if(action==='remove'){removals.push(payload.id);installed.delete(payload.id);return;}throw Error(action);},
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
  assert.equal(timers,1);
  assert.match(ui('offlineList').text(),/Offline bereit/);
  assert.equal(ui('lastVersionCheck').textContent,'Zuletzt: gerade eben');
  now+=65*60000; tick(); assert.equal(ui('lastVersionCheck').textContent,'Zuletzt: vor 1 Stunde');
  assert.equal(discoveries.length,0);
  ui('filterReady').click(); assert.match(ui('offlineList').text(),/Installed/); assert.doesNotMatch(ui('offlineList').text(),/Missing|NoPackage/);
  assert.equal(ui('filterReady').attributes['aria-pressed'],'true');
  ui('filterPending').click(); assert.match(ui('offlineList').text(),/Missing/); assert.doesNotMatch(ui('offlineList').text(),/Installed|NoPackage/);
  ui('offlineSearch').value='Installed';ui('offlineSearch').emit('input');assert.match(ui('offlineList').text(),/Keine passenden Apps/);
  ui('offlineSearch').value='';ui('filterUnsupported').click();assert.match(ui('offlineList').text(),/NoPackage/);assert.doesNotMatch(ui('offlineList').text(),/Installed|Missing/);
  ui('filterUnsupported').click();assert.match(ui('offlineList').text(),/Installed/);assert.match(ui('offlineList').text(),/Missing/);
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
  assert.equal(timers,1);
  // All manager views and actions must ignore unflagged and orphaned packages.
  discoveries.length=0;ui('offlineWorkspace').value='all';ui('offlineWorkspace').emit('change');await flush();
  assert.deepEqual(discoveries.map(d=>d.label).sort(),['Installed','Missing','NoPackage','OtherWorkspace']);
  assert.doesNotMatch(ui('offlineList').text(),/Flag|OldRemoved/);
  assert.equal(ui('metricReady').textContent,2);
  assert.equal(ui('metricPending').textContent,1);
  assert.equal(ui('metricUnsupported').textContent,1);
  assert.equal(ui('coverage').max,4);
  assert.match(ui('storageSummary').textContent,/^2 gespeicherte Pakete/);
  ui('offlineSearch').value='Flag';ui('offlineSearch').emit('input');assert.match(ui('offlineList').text(),/Keine passenden Apps/);
  discoveries.length=0;ui('checkVersions').click();await flush();
  assert.equal(discoveries.length,4);assert(discoveries.every(d=>!d.label.startsWith('Flag')));
  ui('installAll').click();await flush();assert.deepEqual(installations,['Installed','Missing','OtherWorkspace']);
  ui('removeAll').click();await flush();assert.deepEqual(removals.sort(),['Installed','Missing','OtherWorkspace']);
  assert.equal(installed.size,excluded.length+1);
  for(const repo of excluded) assert(installed.has(repo.label));
  assert(installed.has('OldRemoved'));
  assert.equal(ui('removeAll').disabled,true);
  assert(ui('offlineWorkspace').children.some(option=>option.tag==='Favoriten'));
  console.log('OK: only opening/history restoration and manual check may fetch manifests; other events cache-only; update and provisioning controls intact.');
})().catch(error=>{console.error(error);process.exitCode=1;});
