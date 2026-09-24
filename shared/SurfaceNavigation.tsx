import {caseStudies} from './Platform';
import './surface-navigation.css';
export default function SurfaceNavigation({active}:{active:string}) {
 const inLab = active !== 'pipeline';
 return <div className={`surface-navigation ${inLab ? 'surface-navigation-lab' : ''}`}>
  <nav className="surface-nav" aria-label="Cephalo-Silk sections">
   <a className="surface-pipeline" href="#/pipeline" aria-current={!inLab ? 'page' : undefined}>DESIGN PIPELINE</a>
   <a className="surface-lab" href="#/structural-lab" aria-current={inLab ? active === 'structural-lab' ? 'page' : 'true' : undefined}>STRUCTURAL LAB</a>
  </nav>
  {inLab && <nav className="surface-cases" aria-label="Structural Lab cases"><span className="surface-cases-label">STRUCTURAL LAB / CASES</span>{caseStudies.map(c => <a key={c.id} href={`#/${c.id}`} aria-current={active === c.id ? 'page' : undefined}><span>{c.number}</span>{c.id === 'pavilion' ? c.title : c.short}</a>)}</nav>}
 </div>;
}
