import fs from 'node:fs';
import path from 'node:path';
import {zipSync} from 'fflate';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'dist/downloads/cephalo-structural-lab.zip');
if(!fs.existsSync(path.join(root,'dist/index.html'))) throw Error('Build dist/ first.');
// An editable source archive, without recursive builds, dependencies or local state.
const excluded=new Set(['node_modules','dist','.git','test-output','publication_exports']);
const entries={};
function collect(dir){
  for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(excluded.has(item.name)||item.name.startsWith('.env')||/\.(log|tsbuildinfo)$/.test(item.name))continue;
    const file=path.join(dir,item.name);
    if(item.isDirectory())collect(file);
    else if(item.isFile())entries['cephalo-structural-lab/'+path.relative(root,file).split(path.sep).join('/')]=[fs.readFileSync(file),{mtime:new Date('2026-01-01T00:00:00Z')}];
  }
}
collect(root);
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,zipSync(entries,{level:6}));
// The original result files are copied, never rerun or rewritten during builds.
fs.cpSync(path.join(root,'validation'),path.join(root,'dist/validation'),{recursive:true});
console.log(`Source download: ${path.relative(root,out)} (${fs.statSync(out).size} bytes)`);
