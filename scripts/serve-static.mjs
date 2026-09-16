import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.zip':'application/zip','.md':'text/plain; charset=utf-8','.csv':'text/csv','.glb':'model/gltf-binary','.stl':'model/stl','.pdf':'application/pdf'};
export function createStaticServer(directory,{prefix='/',host='127.0.0.1',port=8000}={}){
  const root=path.resolve(directory);
  if(!prefix.startsWith('/')||!prefix.endsWith('/'))throw Error('Prefix must start and end with /.');
  const server=http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return;}
    if(prefix!=='/'&&url===prefix.slice(0,-1)){res.writeHead(301,{Location:prefix});res.end();return;}
    if(!url.startsWith(prefix)){res.writeHead(404);res.end('Not found');return;}
    let file=path.resolve(root,url.slice(prefix.length));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    try{
      if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
      const stat=fs.statSync(file);if(!stat.isFile())throw Error();
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size});
      if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server));});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const directory=path.resolve(import.meta.dirname,'../dist');
 if(!fs.existsSync(path.join(directory,'index.html')))throw Error('Run npm run build first.');
 const port=Number(process.argv[2]||8000),prefix=process.argv[3]||'/',host=process.argv[4]||'127.0.0.1';
 await createStaticServer(directory,{port,prefix,host});
 console.log(`Cephalo-Silk Structural Lab: http://${host}:${port}${prefix}`);
}
