import {assetUrl} from './shared/assetUrl';
import React,{useState,useEffect,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import BridgeCase from './cases/bridge/BridgeCase';
import {Header,caseStudies} from './shared/Platform';
import SurfaceNavigation from './shared/SurfaceNavigation';
import StructuralLabPage from './shared/StructuralLabPage';
import './app/globals.css';
import './public/shared/lab.css';
const PipelinePage=lazy(()=>import('./pipeline-ui/PipelinePage'));
function App(){
 const read=()=>location.hash==='#/structural-lab'?'structural-lab':location.hash==='#/pipeline'?'pipeline':caseStudies.some(c=>c.id===location.hash.slice(2))?location.hash.slice(2):'pipeline';
 const [active,setActive]=useState(read);
 useEffect(()=>{const onHash=()=>setActive(read());window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash)},[]);
 useEffect(()=>{document.title=active==='pipeline'?'Pipeline Explorer · CEPHALO-SILK / DESIGN PIPELINE':`${active==='structural-lab'?'Structural Lab':caseStudies.find(c=>c.id===active)?.title} · CEPHALO-SILK / STRUCTURAL LAB`},[active]);
 return <><Header pipeline={active==='pipeline'}/><SurfaceNavigation active={active}/>{active==='pipeline'?<Suspense fallback={<main style={{padding:32}}>Loading Pipeline Explorer…</main>}><PipelinePage/></Suspense>:active==='structural-lab'?<StructuralLabPage/>:<div className="case-host" key={active}>{active==='bridge'?<BridgeCase/>:<iframe className="case-frame" title={caseStudies.find(c=>c.id===active)?.title} src={assetUrl(`cases/${active}/index.html`)}/>}</div>}</>;
}
createRoot(document.getElementById('root')!).render(<App/>);
