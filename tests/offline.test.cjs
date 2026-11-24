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
let offline=false, blocked=new Set(), version='v1';
const requests=[];
async function fetchMock(req,options){
  const href=key(req); requests.push({href,options});
  if(offline) throw Error('offline');
  if(blocked.has(href)) return new Response('missing',{status:404});
  const file=new URL(href).pathname;
  if(file.endsWith('repos.js') || file.endsWith('.ttf')) return new Response('missing',{status:404});
  return new Response(`${version}:${file}`,{headers:{'Content-Type':file.endsWith('.html')||file.endsWith('/')?'text/html':'text/plain'}});
}
const self={registration:{scope},clients:{async claim(){},async matchAll(){return [];}},addEventListener(type,handler){handlers[type]=handler;}};
const context=vm.createContext({URL,Request,Response,caches,fetch:fetchMock,self,console,importScripts(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);}});
vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
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
const base={label:'Demo',url:'https://outside.test/app/',offline:{entry:'workspace/apps/demo/index.html',files:['app.js','style.css'],version:'1'}};
(async()=>{
  const desc=M.describe(base,scope); assert.equal(desc.kind,'package'); const pkg=desc.pkg;
  assert.equal(pkg.entry,scope+'apps/demo/index.html'); assert.equal(pkg.files.length,3);
  assert.equal(M.describe({label:'remote',url:'https://outside.test'},scope).kind,'unsupported');
  assert.equal(M.describe({label:'info'},scope).kind,'info');
  assert.equal(M.describe({...base,offline:{...base.offline,files:['../other/app.js']}},scope).kind,'unsupported');
  assert.throws(()=>M.validate({...pkg,entry:'https://outside.test/index.html'},scope));
  assert.throws(()=>M.validate({...pkg,entry:scope+'apps/%2fother/index.html'},scope));
  assert.throws(()=>M.validate({...pkg,files:[scope+'../index.html']},scope));
  await caches.open(prefix+'shell-v23'); await caches.open('other-app-cache');
  await life('install'); await life('activate');
  assert((await caches.keys()).includes(prefix+'shell-v24')); assert(!(await caches.keys()).includes(prefix+'shell-v23')); assert((await caches.keys()).includes('other-app-cache'));
  offline=true;
  assert((await eventFetch(scope+'offline.html?workspace=group:demo',{mode:'navigate',destination:'document'})).ok);
  assert((await eventFetch(scope+'index.html?group=demo',{mode:'navigate',destination:'document'})).ok);
  assert.equal(await eventFetch('https://outside.test/app/',{mode:'navigate',destination:'iframe'}),undefined);
  assert.equal(await eventFetch(scope+'../index.html',{mode:'navigate',destination:'document'}),undefined);
  offline=false;
  const installed=await message('install',{package:pkg}); assert(installed.response.ok); assert.equal(installed.progress.at(-1).done,3);
  assert.equal(M.status(desc,installed.response.result),'ready');
  let list=(await message('list')).response.result; assert.equal(list.length,1); assert(list[0].complete);
  assert(requests.filter(r=>pkg.files.includes(r.href)).every(r=>r.options.credentials==='omit' && r.options.redirect==='error'));
  offline=true;
  assert.match(await (await eventFetch(pkg.entry,{mode:'navigate',destination:'iframe'})).text(),/^v1:/);
  assert.match(await (await eventFetch(scope+'apps/demo/app.js')).text(),/^v1:/);
  assert.equal(await eventFetch(pkg.entry,{headers:new Headers({Range:'bytes=0-1'})}),undefined);
  await assert.rejects(()=>eventFetch(scope+'apps/demo/undeclared.json'),/offline/);
  offline=false;
  const newDesc=M.describe({...base,offline:{...base.offline,version:'2'}},scope);
  assert.equal(M.status(newDesc,list[0]),'update');
  blocked.add(scope+'apps/demo/style.css'); version='v2';
  const failed=await message('install',{package:newDesc.pkg}); assert.equal(failed.response.ok,false);
  list=(await message('list')).response.result; assert.equal(list[0].version,'1'); assert(list[0].complete);
  assert.match(await (await eventFetch(pkg.entry)).text(),/^v1:/);
  blocked.clear();
  assert((await message('install',{package:newDesc.pkg})).response.ok);
  list=(await message('list')).response.result; assert.equal(list[0].version,'2'); assert.equal(M.status(newDesc,list[0]),'ready');
  assert.match(await (await eventFetch(pkg.entry)).text(),/^v2:/);
  const conflicting=await message('install',{package:{...pkg,id:'Another'}}); assert.equal(conflicting.response.ok,false);
  await (await caches.open(list[0].cache)).delete(scope+'apps/demo/app.js');
  list=(await message('list')).response.result; assert.equal(M.status(newDesc,list[0]),'incomplete');
  assert((await message('install',{package:newDesc.pkg})).response.ok);
  assert((await message('list')).response.result[0].complete);
  const denied=await message('remove',{id:'Demo'},scope+'apps/demo/index.html');assert.equal(denied.response,undefined);
  offline=true; assert((await message('remove',{id:'Demo'})).response.ok);
  assert.equal((await message('list')).response.result.length,0);
  await assert.rejects(()=>eventFetch(pkg.entry,{mode:'navigate',destination:'iframe'}),/offline/);
  assert((await caches.keys()).includes('other-app-cache'));
  console.log('OK: package contract, lifecycle, offline shell/iframe/assets, atomic update, repair, removal, cache isolation, source restriction.');
})().catch(e=>{console.error(e);process.exitCode=1;});
