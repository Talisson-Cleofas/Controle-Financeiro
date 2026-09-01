import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../public/cloud-sync.js',import.meta.url),'utf8');
const TK='cf_saas_token',TX='controleFinanceiro_v2_transactions',SETTINGS='controleFinanceiro_v2_settings';
function browser({entries={},fetch,quota=false}={}){
  const data=new Map(Object.entries({[TK]:'fake',...entries})),nodes=new Map();let reloads=0;
  const node=()=>({textContent:'',classList:{add(){},remove(){}},remove(){}});
  for(const id of ['syncNotice','saasSync','saasGate','saasUserName'])nodes.set(id,node());
  const context={window:{APP_CONFIG:{API_URL:'https://api.example.invalid'}},document:{getElementById:id=>nodes.get(id)||null},localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){if(quota&&k.startsWith('cf_recovery_'))throw new Error('quota');data.set(k,String(v));},removeItem:k=>data.delete(k)},location:{reload(){reloads++;}},setTimeout(){},clearTimeout(){},confirm:()=>false,fetch};
  vm.runInNewContext(source,context);
  return {sync:context.window.CloudSync,data,nodes,reloads:()=>reloads};
}
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
test('falha de sincronização não apaga token ou dados locais',async()=>{
  const original=JSON.stringify([{id:'a',amount:100}]);
  const b=browser({entries:{[TX]:original},fetch:async url=>url.endsWith('/me')?response({user:{id:'u',name:'Teste'}}):response({message:'Sem conexão'},503)});
  await b.sync.boot();assert.equal(b.data.get(TK),'fake');assert.equal(b.data.get(TX),original);assert.equal(b.reloads(),0);
});
test('401 invalida somente sessão; cache financeiro permanece',async()=>{
  const b=browser({entries:{[TX]:'[]'},fetch:async()=>response({message:'Sessão expirada'},401)});
  await b.sync.boot();assert.equal(b.data.has(TK),false);assert.equal(b.data.get(TX),'[]');
});
test('primeiro carregamento cria cópia antes de substituir cache de outra conta',async()=>{
  const original=JSON.stringify([{id:'a',amount:100}]);let writes=0;
  const b=browser({entries:{[TX]:original,[SETTINGS]:'{}',cf_cloud_owner:'old'},fetch:async(url,options)=>{if(options.method==='PUT')writes++;return url.endsWith('/me')?response({user:{id:'new',name:'Novo'}}):response({transactions:[],settings:{},revision:0});}});
  await b.sync.boot();assert.equal(writes,0);assert.equal(b.data.get('cf_cloud_owner'),'new');assert.equal(b.data.get(TX),'[]');assert.ok([...b.data].some(([key,value])=>key.startsWith('cf_recovery_')&&JSON.parse(value).transactions[0].id==='a'));
});
test('quota de backup impede substituição dos dados locais',async()=>{
  const b=browser({entries:{[TX]:'[{"id":"a"}]'},quota:true,fetch:async url=>url.endsWith('/me')?response({user:{id:'u'}}):response({transactions:[],settings:{},revision:0})});
  await b.sync.boot();assert.equal(b.data.get(TX),'[{"id":"a"}]');assert.equal(b.reloads(),0);
});
test('conflito após reload conserva rascunho e não envia PUT',async()=>{
  let writes=0;const b=browser({entries:{[TX]:'[{"id":"a"}]',cf_cloud_owner:'u',cf_cloud_dirty:'1',cf_cloud_revision:'2'},fetch:async(url,options)=>{if(options.method==='PUT')writes++;return url.endsWith('/me')?response({user:{id:'u',name:'Teste'}}):response({transactions:[],settings:{},revision:3});}});
  await b.sync.boot();assert.equal(writes,0);assert.equal(b.data.get(TX),'[{"id":"a"}]');assert.match(b.nodes.get('syncNotice').textContent,/Conflito/);
});
test('página de renovação e scripts publicados têm sintaxe válida',()=>{
  const html=fs.readFileSync(new URL('../../public/vendas.html',import.meta.url),'utf8');
  assert.match(html,/billing-page.js/);assert.match(html,/assets\/icons\/icon-192.png/);
  new vm.Script(fs.readFileSync(new URL('../../public/billing-page.js',import.meta.url),'utf8'));
  const main=fs.readFileSync(new URL('../../public/index.html',import.meta.url),'utf8');
  for(const match of main.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(!match[0].includes('type="module"'))new vm.Script(match[1]);
});
