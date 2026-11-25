/* Run: node tests/offline.test.cjs. In-memory SW lifecycle/CacheStorage simulation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..','workspace');
const scope = 'https://example.test/project/workspace/';
const handlers = {};
const registry = new Map();
const key = req => typeof req === 'string' ? req : req.url;
const caches = {
  async keys(){return [...registry.keys()];},
  async delete(name){return registry.delete(name);},
  async open(name){
    if(!registry.has(name)) registry.set(name,new Map());
    const store=registry.get(name);
    return {
      async put(req,res){store.set(key(req),res.clone());},
      async match(req){return store.get(key(req))?.clone();},
      async delete(req){return store.delete(key(req));},
      async addAll(reqs){const responses=await Promise.all(reqs.map(async r=>[r,await fetchMock(r)]));if(responses.some(([,r])=>!r.ok))throw Error('addAll failed');for(const [r,res] of responses)store.set(key(r),res.clone());}
    };
  }
};
let offline=false, blocked=new Set(), version='v1', manifestVersion=1, mode='full', badFiles=false, invalidJSON=false, privateManifest=false;
let now=Date.now();
class Clock extends Date { static now(){ return now; } }
const metadata=()=>({schema_version:2,version:manifestVersion,version_name:`${manifestVersion}.0.0`,offline:{mode,limitations:mode==='partial'?['API benötigt Internet']:[]},files:badFiles?['../other/app.js']:['app.js','style.css']});
const requests=[];
async function fetchMock(req,options){
  const href=key(req); requests.push({href,options});
  if(offline) throw Error('offline');
  if(blocked.has(href)) return new Response('missing',{status:404});
  const file=new URL(href).pathname;
  if(file.endsWith('boiler-room.json')) return new Response(invalidJSON?'invalid JSON':JSON.stringify(metadata()),{headers:{'Content-Type':'application/json','Cache-Control':privateManifest?'private, no-store':'no-cache'}});
  if(file.endsWith('repos.js') || file.endsWith('.ttf')) return new Response('missing',{status:404});
  return new Response(`${version}:${file}`,{headers:{'Content-Type':file.endsWith('.html')||file.endsWith('/')?'text/html':'text/plain'}});
}
const self={registration:{scope},clients:{async claim(){},async matchAll(){return [];}},addEventListener(type,handler){handlers[type]=handler;}};
function startWorker(){
  const context=vm.createContext({URL,Request,Response,Date:Clock,caches,fetch:fetchMock,self,console,importScripts(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);}});
  vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
}
startWorker();
const M=self.BoilerRoomOfflineModel;
const prefix=M.prefix(scope);
function life(type){let wait;handlers[type]({waitUntil(p){wait=p;}});return wait;}
function message(action,payload={},source=scope+'offline.html'){
  let response, wait; const progress=[];
  handlers.message({source:{url:source},data:{protocol:'boiler-room-offline-v1',action,...payload},ports:[{postMessage(msg){if(msg.progress)progress.push(msg.progress);else response=msg;}}],waitUntil(p){wait=p;}});
  return Promise.resolve(wait).then(()=>({response,progress}));
}
async function eventFetch(href,{mode='cors',destination='',method='GET',headers=new Headers()}={}){
  let promise;
  handlers.fetch({request:{url:href,mode,destination,method,headers},respondWith(p){promise=p;}});
  return promise ? await promise : undefined;
}
const base={label:'Demo',url:'workspace/apps/demo/index.html'};
const sibling={label:'Sibling',url:'https://example.test/OtherApp'};
(async()=>{
  const loc=M.locate(base,scope); assert.equal(loc.kind,'candidate');
  assert.equal(loc.manifest,scope+'apps/demo/boiler-room.json');
  assert.equal(M.locate({label:'remote',url:'https://outside.test'},scope).kind,'unsupported');
  assert.equal(M.locate({label:'info'},scope).kind,'info');
  assert.equal(M.locate({...base,url:'https://example.test/OtherApp/app.html?x=1#top'},scope).manifest,'https://example.test/OtherApp/boiler-room.json');
  assert.equal(M.locate({...base,url:'https://example.test/OtherApp'},scope).manifest,'https://example.test/OtherApp/boiler-room.json');
  assert.equal(M.describe({...base,offline:{entry:'ignored'}},scope).kind,'candidate');
  assert.equal(M.describe(base,scope,{...metadata(),files:['../other/app.js']}).kind,'unsupported');
  assert.equal(M.describe(base,scope,{...metadata(),schema_version:1}).kind,'unsupported');
  assert.equal(M.describe(base,scope,{...metadata(),offline:{mode:'none',limitations:[]}}).kind,'unsupported');
  const partial=M.describe(base,scope,{...metadata(),offline:{mode:'partial',limitations:['API']}});
  assert.equal(partial.pkg.mode,'partial'); assert.equal(partial.pkg.limitations[0],'API');
  await caches.open(prefix+'shell-v25'); await caches.open('other-app-cache');
  await life('install'); await life('activate');
  assert((await caches.keys()).includes(prefix+'shell-v26')); assert(!(await caches.keys()).includes(prefix+'shell-v25')); assert((await caches.keys()).includes('other-app-cache'));
  offline=true;
  assert((await eventFetch(scope+'offline.html?workspace=group:demo',{mode:'navigate',destination:'document'})).ok);
  assert((await eventFetch(scope+'index.html?group=demo',{mode:'navigate',destination:'document'})).ok);
  assert.equal(await eventFetch('https://outside.test/app/',{mode:'navigate',destination:'iframe'}),undefined);
  assert.equal(await eventFetch(scope+'../index.html',{mode:'navigate',destination:'document'}),undefined);
  const manifestRequests = (href = loc.manifest) => requests.filter(r => r.href === href).length;
  const before = manifestRequests();
  assert.equal((await message('discover',{repo:base,cacheOnly:true})).response.result.kind,'candidate');
  assert.equal(manifestRequests(),before);
  offline=false;
  blocked.add(loc.manifest);
  const missingManifest = (await message('discover',{repo:base})).response.result;
  assert.equal(missingManifest.kind,'unsupported'); assert.equal(missingManifest.checkedAt,now);
  blocked.clear();
  // Negative results are cached just like installed apps, across multiple requests.
  assert.equal((await message('discover',{repo:base})).response.result.kind,'unsupported');
  assert.equal(manifestRequests(),before+1);
  assert.equal((await message('discover',{repo:base,cacheOnly:true})).response.result.kind,'unsupported');
  now += 24*60*60*1000-1;
  assert.equal((await message('discover',{repo:base})).response.result.kind,'unsupported');
  assert.equal(manifestRequests(),before+1);
  now++;
  const simultaneous = await Promise.all(Array.from({length:6},()=>message('discover',{repo:base})));
  const desc=simultaneous[0].response.result; assert.equal(desc.kind,'package');
  assert(simultaneous.every(x=>x.response.result.checkedAt===now));
  assert.equal(manifestRequests(),before+2);
  // The persisted status can be read directly after reload / worker restart.
  const persisted = await (await caches.open(M.versionCheckCache(scope))).match(M.versionCheckKey(loc,scope));
  assert.equal((await persisted.json()).pkg.version,'1');
  startWorker(); // New global state; only CacheStorage survives.
  assert.equal(M.status(desc,null),'missing');
  assert.equal((await message('discover',{repo:base})).response.result.kind,'package');
  assert.equal(manifestRequests(),before+2);
  const changedURL={...base,url:'workspace/apps/changed/index.html'};
  const changedLoc=M.locate(changedURL,scope);
  assert.equal((await message('discover',{repo:changedURL})).response.result.pkg.entry,changedLoc.entry);
  assert.equal(manifestRequests(changedLoc.manifest),1);
  const disabled={label:'Disabled',url:'workspace/apps/disabled/index.html'};
  const disabledLoc=M.locate(disabled,scope);
  mode='none';
  assert.equal((await message('discover',{repo:disabled})).response.result.kind,'unsupported');
  mode='full';
  assert.equal((await message('discover',{repo:disabled})).response.result.kind,'unsupported');
  assert.equal(manifestRequests(disabledLoc.manifest),1);
  assert.equal((await message('discover',{repo:disabled,force:true})).response.result.kind,'package');
  assert.equal(manifestRequests(disabledLoc.manifest),2);
  const invalid={label:'Invalid',url:'workspace/apps/invalid/index.html'};
  const invalidLoc=M.locate(invalid,scope);
  invalidJSON=true;
  assert.equal((await message('discover',{repo:invalid})).response.result.kind,'unsupported');
  invalidJSON=false;
  assert.equal((await message('discover',{repo:invalid})).response.result.kind,'unsupported');
  assert.equal(manifestRequests(invalidLoc.manifest),1);
  privateManifest=true;
  assert.equal((await message('discover',{repo:invalid,force:true})).response.result.kind,'unsupported');
  privateManifest=false;
  assert.equal((await message('discover',{repo:invalid})).response.result.kind,'unsupported');
  assert.equal(manifestRequests(invalidLoc.manifest),2);
  const unreachable={label:'Unreachable',url:'workspace/apps/unreachable/index.html'};
  const unreachableLoc=M.locate(unreachable,scope);
  offline=true;
  assert.equal((await message('discover',{repo:unreachable})).response.result.kind,'unknown');
  offline=false;
  assert.equal((await message('discover',{repo:unreachable})).response.result.kind,'unknown');
  assert.equal(manifestRequests(unreachableLoc.manifest),1);
  assert.equal((await message('discover',{repo:unreachable,force:true})).response.result.kind,'package');
  assert.equal(manifestRequests(unreachableLoc.manifest),2);
  const pkg=desc.pkg; assert.equal(pkg.entry,scope+'apps/demo/index.html'); assert.equal(pkg.files.length,4);
  const installed=await message('install',{repo:base}); assert(installed.response.ok); assert.equal(installed.progress.at(-1).done,4);
  assert.equal(M.status(desc,installed.response.result),'ready');
  let list=(await message('list')).response.result; assert.equal(list.length,1); assert(list[0].complete);
  assert(requests.filter(r=>pkg.files.includes(r.href)).every(r=>r.options.credentials==='omit' && r.options.redirect==='error'));
  offline=true;
  assert.equal(M.status(M.locate(base,scope),list[0]),'saved');
  assert.equal(M.status(M.locate({...base,url:'workspace/apps/new/index.html'},scope),list[0]),'unknown');
  assert.match(await (await eventFetch(pkg.entry,{mode:'navigate',destination:'iframe'})).text(),/^v1:/);
  assert.match(await (await eventFetch(scope+'apps/demo/app.js')).text(),/^v1:/);
  assert.equal((await (await eventFetch(pkg.manifest)).json()).version,1);
  assert.equal(await eventFetch(pkg.entry,{headers:new Headers({Range:'bytes=0-1'})}),undefined);
  await assert.rejects(()=>eventFetch(scope+'apps/demo/undeclared.json'),/offline/);
  offline=false; manifestVersion=2;
  const beforeUpdate=manifestRequests();
  assert.equal(M.status((await message('discover',{repo:base})).response.result,list[0]),'ready');
  assert.equal(manifestRequests(),beforeUpdate);
  const newDesc=(await message('discover',{repo:base,force:true})).response.result;
  assert.equal(M.status(newDesc,list[0]),'update');
  assert.equal(M.statusLabel('update',newDesc),'Version 2.0.0 verfügbar');
  assert.equal(M.statusLabel('update',{pkg:{version:'2',versionName:''}}),'Version 2 verfügbar');
  assert.equal(manifestRequests(),beforeUpdate+1);
  offline=true;
  now+=24*60*60*1000;
  assert.equal(M.status((await message('discover',{repo:base,cacheOnly:true})).response.result,list[0]),'update');
  assert.equal(manifestRequests(),beforeUpdate+1);
  offline=false;
  blocked.add(scope+'apps/demo/style.css'); version='v2';
  const failed=await message('install',{repo:base}); assert.equal(failed.response.ok,false);
  list=(await message('list')).response.result; assert.equal(list[0].version,'1'); assert(list[0].complete);
  assert.match(await (await eventFetch(pkg.entry)).text(),/^v1:/);
  blocked.clear();
  assert((await message('install',{repo:base})).response.ok);
  list=(await message('list')).response.result; assert.equal(list[0].version,'2'); assert.equal(M.status(newDesc,list[0]),'ready');
  const afterInstall=manifestRequests();
  assert.equal(M.status((await message('discover',{repo:base})).response.result,list[0]),'ready');
  assert.equal(manifestRequests(),afterInstall);
  assert.match(await (await eventFetch(pkg.entry)).text(),/^v2:/);
  const conflicting=await message('install',{repo:{...base,label:'Another'}}); assert.equal(conflicting.response.ok,false);
  await (await caches.open(list[0].cache)).delete(scope+'apps/demo/app.js');
  list=(await message('list')).response.result; assert.equal(M.status(newDesc,list[0]),'incomplete');
  assert((await message('install',{repo:base})).response.ok);
  assert((await message('list')).response.result[0].complete);
  badFiles=true; assert.equal((await message('install',{repo:base})).response.ok,false); badFiles=false;
  mode='none'; assert.equal((await message('install',{repo:base})).response.ok,false); mode='partial';
  const mirrored=(await message('install',{repo:sibling})).response; assert(mirrored.ok); const remote=mirrored.result;
  assert.equal(remote.entry,sibling.url); assert.equal(remote.canonicalEntry,sibling.url+'/'); assert(remote.launchEntry.startsWith(scope+'offline-apps/'));
  assert.equal(remote.mode,'partial'); assert.equal(remote.limitations[0],'API benötigt Internet');
  offline=true;
  assert.match(await (await eventFetch(remote.launchEntry,{mode:'navigate',destination:'iframe'})).text(),/OtherApp\/$/);
  assert.match(await (await eventFetch(remote.mirror+'app.js')).text(),/OtherApp\/app.js$/);
  assert.equal((await eventFetch(remote.mirror+'undeclared.json')).status,404);
  const denied=await message('remove',{id:'Demo'},scope+'apps/demo/index.html');assert.equal(denied.response,undefined);
  assert((await message('remove',{id:'Demo'})).response.ok);
  assert((await message('remove',{id:'Sibling'})).response.ok);
  assert.equal((await message('list')).response.result.length,0);
  await assert.rejects(()=>eventFetch(pkg.entry,{mode:'navigate',destination:'iframe'}),/offline/);
  assert.equal((await eventFetch(remote.launchEntry)).status,404);
  assert((await caches.keys()).includes('other-app-cache'));
  console.log('OK: daily positive/negative version checks, manual refresh, offline cache, concurrent requests, schema 2 discovery, missing/unreachable manifests, modes, lifecycle, direct/mirrored offline assets, atomic update, repair, removal, isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
