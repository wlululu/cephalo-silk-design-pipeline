import {assetUrl} from './shared/assetUrl';
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import BridgeCase from './cases/bridge/BridgeCase';
import {Header,CaseNavigation,caseStudies} from './shared/Platform';
import './app/globals.css';
import './public/shared/lab.css';
function App(){
 const read=()=>caseStudies.some(c=>c.id===location.hash.slice(2))?location.hash.slice(2):'bridge';
 const [active,setActive]=useState(read);
 useEffect(()=>{const onHash=()=>setActive(read());window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash)},[]);
 useEffect(()=>{document.title=`${caseStudies.find(c=>c.id===active)?.title} · CEPHALO-SILK / STRUCTURAL LAB`},[active]);
 return <><Header/><CaseNavigation active={active}/><div className="case-host" key={active}>{active==='bridge'?<BridgeCase/>:<iframe className="case-frame" title={caseStudies.find(c=>c.id===active)?.title} src={assetUrl(`cases/${active}/index.html`)}/>}</div></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
