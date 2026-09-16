import {solve} from './solver.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:solve(data.model)});}catch(e){self.postMessage({id:data.id,error:e.message});}};
