// DOM-only integration. Existing element IDs and their event handlers remain local to each case.
export function mountCase({id,number,title,subtitle,nativeGeometryMode,cameraSelector,sourceFile}){
 document.body.classList.add('integrated',id);
 const detached=[];const $=s=>document.querySelector(s)||detached.map(e=>e.querySelector(s)).find(Boolean),el=(tag,cls,html='')=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e};
 const workspace=$('main>.workspace'),aside=$('main>aside'),stage=id==='pavilion'?$('#viewport'):$('.stage');
 workspace.prepend(el('div','case-heading',`<span class="eyebrow">${number} / ${id==='pavilion'?'PAVILION · BEAM + NET':'LOOP TOWERS · ELASTIC LATTICE'}</span><h1>${title}</h1><p>${subtitle}</p>`));
 const toolbar=el('div','case-toolbar'),modes=$('.segmented');modes.className='representation';modes.setAttribute('aria-label','Representation');
 modes.querySelectorAll('button').forEach(b=>{b.textContent=b.dataset.mode===nativeGeometryMode?'GEOMETRY':b.dataset.mode.toUpperCase();b.setAttribute('aria-pressed',String(b.classList.contains('selected')))});
 toolbar.append(modes,el('span','toolbar-note','Single-image structural interpretation'));$('.case-heading').after(toolbar);
 const cameras=$(cameraSelector);cameras.className='view-tools';cameras.setAttribute('aria-label','Camera views');stage.append(cameras);
 cameras.querySelectorAll('button').forEach(b=>{if(b.textContent==='Plan')b.textContent='Top'});
 if(id==='loop-towers'){const fit=$('#fit');cameras.append(fit);fit.textContent='Fit model';}else{const fit=el('button','','Fit model');fit.id='fit-model';fit.type='button';cameras.insertBefore(fit,$('#rotate'));fit.onclick=()=>cameras.querySelector('[data-camera="Perspective"]').click();}
 if(id==='pavilion'){stage.append($('#legend'),$('.interaction'));}
 const card=el('button','concept-card',`<img src="./original-concept.png" alt="Original ${title} concept"><span>Original Concept <b>↗</b></span>`);card.setAttribute('aria-label','Enlarge Original Concept');stage.append(card);
 const dialog=el('dialog','concept-dialog',`<button class="dialog-close" aria-label="Close Original Concept">×</button><span class="eyebrow">ORIGINAL CONCEPT</span><h2>${title}</h2><img src="./original-concept.png" alt="Original ${title} concept enlarged"><p>Original 2D concept → inferred 3D geometry → structural representation → mechanical response.</p>`);document.body.append(dialog);card.onclick=()=>dialog.showModal();dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close()};
 const titlebar=el('div','experiment-title','<span>EXPERIMENT CONTROLS</span><button aria-label="Reset experiment" title="Reset experiment">↺</button>');
 const section=(num,name)=>el('section','control-section',`<h2><span>${num}</span>${name}</h2>`);
 const loading=section('01','Loading'),material=section('02','Material & Sections'),analysis=section('03','Deformation / Analysis'),exports=section('04','Reset / Export');
 detached.push(loading,material,analysis,exports);
 const moveRange=(id,target)=>{const input=document.getElementById(id),label=input.previousElementSibling;target.append(label,input)};
 const moveSelect=(id,target)=>{const input=document.getElementById(id);if(input.parentElement.tagName==='LABEL')target.append(input.parentElement);else target.append(input.previousElementSibling,input)};
 if(id==='loop-towers'){
  moveSelect('loadcase',loading);moveRange('load',loading);moveRange('stiffness',material);moveRange('thickness',material);material.append($('.micro'));
  for(const field of ['floors','web','circulation'])analysis.append(document.getElementById(field).closest('label'));
  const response=$('#quantity').closest('section');Array.from(response.children).filter(e=>e.tagName!=='H2').forEach(e=>analysis.append(e));
  exports.append($('.downloads'));const reset=$('#reset');reset.textContent='Reset experiment';titlebar.querySelector('button').onclick=()=>reset.click();
  const notes=$('#aboutOpen');notes.className='notes-button';aside.append(notes);
 }else{
  moveSelect('loadCase',loading);moveRange('pressure',loading);moveRange('stiffness',material);moveRange('thickness',material);material.append($('#thickness').nextElementSibling?.classList.contains('hint')?$('#thickness').nextElementSibling:el('p','hint','Scales tube diameter and wall; net area scales with size². Initial tension stays fixed.'));
  moveSelect('quantity',analysis);analysis.append($('.checks'));const deformation=$('#scale').closest('section');Array.from(deformation.children).filter(e=>e.tagName!=='H3').forEach(e=>analysis.append(e));
  const inspect=el('div','member-inspector','<label for="inspect-member">Inspect structural member</label><input id="inspect-member" aria-label="Inspect structural member" type="number" min="0" max="647" value="0" style="width:100%;padding:9px;border:1px solid #d6e1e8;border-radius:4px;margin:8px 0"><div id="member-detail" style="font-size:12px;line-height:1.7;color:#5f7d90"></div>');analysis.append(inspect);
  exports.append($('.export'));const reset=el('button','reset-experiment','Reset experiment');reset.id='reset-experiment';exports.insertBefore(reset,exports.children[1]);reset.onclick=()=>location.reload();titlebar.querySelector('button').onclick=()=>reset.click();
  const notes=$('#about');notes.className='notes-button';aside.append(notes);
  const notice=el('div','','Conceptual tangent response · fixed bases · prestress is not form-found.');notice.id='notice';workspace.append(notice);
 }
 const footnote=$('.footnote'),notes=$('.notes-button');aside.replaceChildren(titlebar,loading,material,analysis,exports,notes,footnote);
 aside.querySelectorAll('a[download]').forEach(a=>{if(/\.zip/.test(a.getAttribute('href')))a.href=sourceFile});
 modes.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>modes.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))));
 return {stage,analysis};
}
