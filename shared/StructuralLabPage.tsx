import {caseStudies} from './Platform';
import './structural-lab-page.css';

export default function StructuralLabPage() {
 return <main className="structural-lab-page">
  <p className="lab-landing-kicker">CEPHALO-SILK / STRUCTURAL LAB</p>
  <h1>Executable structural environments</h1>
  <p>Explore three independent structural reconstructions. Open a case to inspect its model, adjust experiment parameters, and examine the computed response.</p>
  <div className="lab-landing-cases">{caseStudies.map(c => <a key={c.id} href={`#/${c.id}`}><span>CASE {c.number}</span><h2>{c.title}</h2><p>Geometry · structure · response</p><strong>Open environment →</strong></a>)}</div>
  <p className="lab-landing-note">The <a href="#/pipeline">Design Pipeline</a> explores the generalized closed-loop method through the verified Bridge trajectory. Loop Towers and Woven-Wing Pavilion are executable cases; they are not closed-loop controller demonstrations.</p>
 </main>;
}
