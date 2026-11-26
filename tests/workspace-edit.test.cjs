/* Run: node tests/workspace-edit.test.cjs. Simulated DOM, pointer and worker events. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../workspace');
const scope = 'https://example.test/project/workspace/';
class Element {
  constructor(tag='div') {
    this.tag=tag; this.children=[]; this.dataset={}; this.attributes={}; this.listeners={}; this.hidden=false; this.value=''; this.textContent=''; this.className='';
    this.style={removeProperty(name){delete this[name];}};
    this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:(...cs)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...cs])].join(' ');},remove:(...cs)=>{this.className=this.className.split(/\s+/).filter(c=>!cs.includes(c)).join(' ');},toggle:(c,f)=>{const on=f??!this.classList.contains(c);this.classList[on?'add':'remove'](c);return on;}};
  }
  append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
  replaceChildren(...nodes){for(const n of this.children)n.parentElement=null;this.children=[];this.append(...nodes);}
  remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(n=>n!==this);this.parentElement=null;}}
  insertBefore(n,b){n.remove();const i=this.children.indexOf(b);n.parentElement=this;this.children.splice(i<0?this.children.length:i,0,n);}
  get nextSibling(){const p=this.parentElement;return p?.children[p.children.indexOf(this)+1]||null;}
  get isConnected(){return Boolean(this.parentElement);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k];}
  removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  emit(k,e={}){e.target??=this;e.preventDefault??=()=>{e.defaultPrevented=true;};for(const fn of this.listeners[k]||[])fn(e);}
  click(){if(!this.disabled)this.emit('click');}
  focus(){}
  matches(s){return s.startsWith('.')?this.classList.contains(s.slice(1)):s===this.tag;}
  closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
  contains(e){return this===e||this.children.some(c=>c.contains(e));}
  querySelectorAll(s){const matches=s.split(',').map(x=>x.trim());return this.children.flatMap(c=>[...(matches.some(x=>c.matches(x))?[c]:[]),...c.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  getBoundingClientRect(){return {left:0,top:0,right:500,bottom:600,width:100,height:100};}
  cloneNode(){const n=new Element(this.tag);n.className=this.className;return n;}
  setPointerCapture(){} hasPointerCapture(){return false;} releasePointerCapture(){}
  set innerHTML(v){this.replaceChildren(new Element('svg'));}
}
const ids=new Map();const ui=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const document=new Element();document.body=new Element();Object.assign(document,{getElementById:ui,createElement:t=>new Element(t),visibilityState:'visible',elementFromPoint:()=>hit});
const window=new Element();window.matchMedia=()=>Object.assign(new Element(),{matches:true});
const toolbar=new Element();toolbar.className='toolbar';toolbar.append(ui('toolbarMenu'));
ui('toolbarMenu').hidden=true;ui('homeSearchWrap').hidden=true;ui('homeApps').className='home-apps';ui('homeWorkspaceApps').className='home-apps';document.body.append(ui('homeView'));ui('homeView').append(ui('homeApps'),ui('homeWorkspaceApps'));
let hit=null, timerId=0;const timers=new Map();
const navigator={onLine:true,serviceWorker:new Element()};
const repos=[{label:'Demo',boiler_room_pwa:true},{label:'Other',boiler_room_pwa:'true'},{label:'New',boiler_room_pwa:true}].map(r=>({...r,type:'tool',url:`workspace/apps/${r.label}/index.html`}));
const groups=new Map([['all',{label:'All',repos}]]);
const stores={workspace:{selected:'favorites'},favorites:['Demo','Other'],favoriteOrder:['Demo','Other'],workspaceRecentApps:[]};
const B=window.BoilerRoom={data:{repos,types:{tool:{label:'Tool'}},getGroups:()=>groups},storage:{init(){},get:k=>JSON.parse(JSON.stringify(stores[k]??false)),set:(k,v)=>{stores[k]=JSON.parse(JSON.stringify(v));},isAvailable:()=>true},searchRelevance:{normalize:s=>s,score:(r,q)=>r.label.includes(q)?0:-1},toast:{showFavorite(){},showMessage(){}}};
const context=vm.createContext({window,document,navigator,URL,URLSearchParams,location:{href:scope+'index.html',search:''},history:{replaceState(){}},Option:Element,Image:Element,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
vm.runInContext(fs.readFileSync(path.join(root,'../js/favorites.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'offline-model.js'),'utf8'),context);
const M=vm.runInContext('globalThis.BoilerRoomOfflineModel',context);
const desc=(repo,v)=>M.describe(repo,scope,{schema_version:2,version:v,offline:{mode:'full',limitations:[]},files:['app.js']});
const results=new Map(repos.map(r=>[r.label,desc(r,1)]));const installed=new Map(),discoveries=[],operations=[];
B.offline={supported:true,describe:r=>M.locate(r,scope),status:M.status,localEntry:()=>null,async snapshot(){return [...installed.values()];},async discover(r,o){discoveries.push([r.label,o.force,o.cacheOnly]);return results.get(r.label);},async cachedDescription(r){return results.get(r.label);},async request(a,p){operations.push(a);if(a==='remove'){installed.delete(p.id);return;}const r={...results.get(p.repo.label).pkg,complete:true};installed.set(p.repo.label,r);return r;}};
vm.runInContext(fs.readFileSync(path.join(root,'workspace.js'),'utf8'),context);
const flush=()=>new Promise(r=>setImmediate(r));
const grid=ui('homeWorkspaceApps'),cards=()=>grid.querySelectorAll('.app-card');
const button=(c,label)=>c.querySelectorAll('button').find(b=>b.textContent===label);
function press(c,type='mouse'){const b=c.querySelector('.app-item');b.emit('pointerdown',{isPrimary:true,button:0,pointerId:1,pointerType:type,clientX:50,clientY:50});const t=[...timers.entries()].at(-1);timers.delete(t[0]);t[1]();assert(c.classList.contains('is-editing'));assert(!c.querySelector('.app-edit-more'));}
function release(){document.emit('pointerup',{pointerId:1});}
function menu(c){c.querySelector('.app-edit-more').click();}
(async()=>{
 await flush();assert.equal(cards().length,2);assert.equal(grid.querySelectorAll('.workspace-fav').length,0);
 let demo=cards()[0];press(demo);release();menu(demo);await flush();assert.deepEqual(discoveries,[['Demo',false,false]]);assert(button(demo,'Installieren'));button(demo,'Installieren').click();await flush();assert(button(demo,'Deinstallieren'));assert(!button(demo,'Installieren'));
 results.set('Demo',desc(repos[0],2));menu(demo);menu(demo);await flush();assert(button(demo,'Update'));button(demo,'Update').click();await flush();assert(!button(demo,'Update'));button(demo,'Deinstallieren').click();await flush();assert(button(demo,'Installieren'));assert.deepEqual(operations,['install','install','remove']);demo.querySelector('.app-edit-exit').click();await flush();
 demo=cards()[0];press(demo,'touch');hit=cards()[1];document.emit('pointermove',{pointerId:1,clientX:160,clientY:50});release();assert.deepEqual(stores.favoriteOrder,['Other','Demo']);demo.querySelector('.app-edit-exit').click();
 const other=cards()[0];press(other);release();menu(other);await flush();assert(!button(other,'Installieren'));assert(!discoveries.some(x=>x[0]==='Other'));button(other,'Favorit entfernen').click();assert.deepEqual(stores.favorites,['Demo']);
 ui('homeSearch').value='New';ui('homeSearch').emit('input');const search=ui('homeApps').querySelector('.app-card');assert(search.querySelector('.workspace-fav'));search.querySelector('.workspace-fav').click();const added=ui('homeApps').querySelector('.app-card');assert(!added.querySelector('.workspace-fav'));assert(stores.favorites.includes('New'));
 navigator.onLine=false;press(added);release();menu(added);await flush();assert.deepEqual(discoveries.at(-1),['New',false,true]);assert(button(added,'Installieren').disabled);
 added.querySelector('.app-edit-exit').click();
 const before=stores.favoriteOrder.slice();
 ui('workspaceSelect').value='group:all';ui('workspaceSelect').emit('change');
 assert(!grid.classList.contains('reorderable'));const groupFirst=cards()[0];press(groupFirst,'touch');hit=cards()[1];document.emit('pointermove',{pointerId:1,clientX:160,clientY:50});release();assert.deepEqual(stores.favoriteOrder,before);assert.equal(cards()[0],groupFirst);groupFirst.querySelector('.app-edit-exit').click();
 ui('workspaceSelect').value='favorites';ui('workspaceSelect').emit('change');const original=cards().map(c=>c.dataset.label);press(cards()[0]);hit=cards()[1];document.emit('pointermove',{pointerId:1,clientX:160,clientY:50});document.emit('pointercancel',{pointerId:1});assert.deepEqual(cards().map(c=>c.dataset.label),original);assert.deepEqual(stores.favoriteOrder,before);
 console.log('OK: long press, edit controls, favorites-only drag and shared order, favorite button hiding, PWA opt-in, install/update/remove, offline cache-only check.');
})().catch(e=>{console.error(e);process.exitCode=1;});
