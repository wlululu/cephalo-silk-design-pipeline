import {caseStudies} from './Platform';
import './surface-navigation.css';
export default function SurfaceNavigation({active}:{active:string}) {
 return <nav className="surface-nav" aria-label="Cephalo-Silk surfaces">
  <a className="surface-pipeline" href="#/pipeline" aria-current={active === 'pipeline' ? 'page' : undefined}>DESIGN PIPELINE</a>
  <div className={`surface-lab ${active !== 'pipeline' ? 'surface-lab-active' : ''}`}>
   <span className="surface-lab-label">STRUCTURAL LAB</span>
   <div className="surface-cases">{caseStudies.map(c => <a key={c.id} href={`#/${c.id}`} aria-current={active === c.id ? 'page' : undefined}><span>{c.number}</span>{c.id === 'pavilion' ? c.title : c.short}</a>)}</div>
  </div>
 </nav>;
}
