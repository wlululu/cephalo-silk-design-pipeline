import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {createStaticServer} from '../scripts/serve-static.mjs';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist');
const hash=x=>createHash('sha256').update(x).digest('hex');
const results=[];
for(const prefix of ['/','/cephalo-structural-lab/']){
 const server=await createStaticServer(dist,{prefix,port:0});
 try{
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  const get=async (relative,mime)=>{const response=await fetch(new URL(relative,base));assert.equal(response.status,200,relative);if(mime)assert.ok(response.headers.get('content-type').includes(mime),relative+' MIME');return Buffer.from(await response.arrayBuffer());};
  const html=(await get('','text/html')).toString();
  assert.ok(html.includes('CEPHALO-SILK / STRUCTURAL LAB'));
  for(const [,url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){assert.ok(!url.startsWith('/'),'Root-relative app asset: '+url);await get(url);}
  const publicFiles=[];
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())walk(f);else publicFiles.push(f);}};
  walk(path.join(root,'public'));
  for(const f of publicFiles){const relative=path.relative(path.join(root,'public'),f).split(path.sep).join('/');const actual=await get(relative,/\.(m?js)$/.test(relative)?'javascript':null);assert.equal(hash(actual),hash(fs.readFileSync(f)),relative+' served bytes differ');}
  for(const c of ['loop-towers','pavilion']){
   const entry=(await get(`cases/${c}/entry.js`)).toString();const relative=entry.match(/sourceFile:'([^']+)'/)[1];
   const url=new URL(relative,new URL(`cases/${c}/index.html`,base));assert.ok(url.pathname.startsWith(prefix+'downloads/'));await get(url.href);
  }
  const records=await get('validation/physics/physics-sanity-results.json');assert.equal(hash(records),hash(fs.readFileSync(path.join(root,'validation/physics/physics-sanity-results.json'))));
  const source=unzipSync(await get('downloads/cephalo-structural-lab.zip'));
  for(const f of ['package.json','package-lock.json','README.md','cases/bridge/model.mjs','public/cases/loop-towers/solver.js','public/cases/pavilion/solver.js','validation/physics/physics-sanity-results.json']){
   assert.equal(hash(source['cephalo-structural-lab/'+f]),hash(fs.readFileSync(path.join(root,f))),'Source download mismatch: '+f);
  }
  assert.ok(!Object.keys(source).some(f=>/\/(node_modules|dist|\.openai)\//.test(f)));
  assert.equal((await fetch(base+'missing-worker.mjs')).status,404,'Missing modules must not return HTML');
  results.push({prefix,public_files_checked:publicFiles.length,source_archive:true,validation:true,status:'pass'});
  console.log(`PASS: static hosting at ${prefix}; ${publicFiles.length} original public files, modules, records and source download verified.`);
 }finally{await new Promise(r=>server.close(r));}
}
fs.mkdirSync(path.join(root,'test-output'),{recursive:true});fs.writeFileSync(path.join(root,'test-output/static-report.json'),JSON.stringify(results,null,2)+'\n');
