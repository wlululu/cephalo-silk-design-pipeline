"""Independent postprocessing of original solver outputs; never changes a model."""
import json,math,pathlib,statistics,hashlib,csv,datetime
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'validation/physics'
norm=lambda v:math.sqrt(sum(x*x for x in v))
add=lambda a,b:[x+y for x,y in zip(a,b)]
sub=lambda a,b:[x-y for x,y in zip(a,b)]
mul=lambda a,k:[x*k for x in a]
cross=lambda a,b:[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
sumvec=lambda vs:[sum(v[j] for v in vs) for j in range(3)]
read=lambda p:json.loads(p.read_text())
protocol=read(OUT/'protocol.json');threshold=protocol['thresholds']
def applied_loads(d):
 m,p,c=d['model'],d['parameters'],d['case']
 if c=='bridge':return m['loads']
 if c=='loop-towers':return [dict(node=l['node'],force=mul(l['force'],p['load'])) for l in m['loads'] if l['case']=='gravity' or l['case']==p['case']]
 loads=[]
 for face in m['faces']:
  a,b,c=[m['nodes'][i]['position'] for i in face]
  if p['loadCase']=='Asymmetric' and a[0]+b[0]+c[0]<=0:continue
  area=abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/2
  axis=0 if p['loadCase']=='Lateral' else 1;sign=1 if p['loadCase'] in ['Lateral','Uplift'] else -1
  f=[0,0,0];f[axis]=sign*p['pressure']*area/3
  loads.extend(dict(node=i,force=f.copy()) for i in face)
 return loads+p.get('nodalLoads',[])
def translations(d):
 r=d['result']
 if d['case']=='bridge':return [n['displacement'] for n in r['nodes']]
 if d['case']=='loop-towers':return [r['u'][3*i:3*i+3] for i in range(len(d['model']['nodes']))]
 return r['displacements']
def equilibrium(d):
 m,r=d['model'],d['result'];loads=applied_loads(d);u=translations(d)
 applied=sumvec([l['force'] for l in loads]);react=sumvec([l['force'] for l in r['reactions']]);err=add(applied,react)
 fscale=max(1,sum(norm(l['force']) for l in loads))
 def moments(ls,deformed=False):return [add(cross(add(m['nodes'][l['node']]['position'],u[l['node']]) if deformed else m['nodes'][l['node']]['position'],l['force']),l.get('moment',[0,0,0])) for l in ls]
 ml=sumvec(moments(loads));mr=sumvec(moments(r['reactions']));me=add(ml,mr)
 mscale=max(1,sum(norm(cross(m['nodes'][l['node']]['position'],l['force']))+norm(l.get('moment',[0,0,0])) for l in loads))
 # Independently evaluate the net torque introduced by noncentral reference-configuration member forces.
 noncentral=[0,0,0]
 if d['case']=='pavilion':
  for e in m['members']:
   if e['type']=='frame':continue
   a,b=e['nodes'];delta=sub(m['nodes'][b]['position'],m['nodes'][a]['position']);n=mul(delta,1/norm(delta));T=m['sections'][e['section']]['prestress']
   noncentral=add(noncentral,mul(cross(n,sub(u[b],u[a])),T))
 elif d['case']=='bridge':
  for e in m['members']:
   if e['behavior']!='tension_only_cable':continue
   a,b=e['a'],e['b'];delta=sub(m['nodes'][b]['position'],m['nodes'][a]['position']);current=add(delta,sub(u[b],u[a]));N=r['members'][e['id']]['axialForce']
   noncentral=add(noncentral,cross(delta,mul(current,N/norm(current))))
 return dict(applied_force_N=applied,reaction_force_N=react,force_error_vector_N=err,force_absolute_error_N=norm(err),force_reference_N=fscale,force_relative_error=norm(err)/fscale,force_status='Pass' if norm(err)/fscale<=threshold['global_force_relative'] else 'Fail',applied_moment_Nm=ml,reaction_moment_Nm=mr,moment_error_vector_Nm=me,moment_absolute_error_Nm=norm(me),moment_reference_Nm=mscale,moment_relative_error=norm(me)/mscale,moment_status='Pass' if norm(me)/mscale<=threshold['global_moment_relative'] else 'Fail',reference_member_noncentral_torque_Nm=noncentral,moment_error_minus_member_torque_Nm=sub(me,noncentral),deformed_coordinate_external_moment_sum_Nm=add(sumvec(moments(loads,True)),sumvec(moments(r['reactions'],True))),independently_assembled_loads_match_solver=max(abs(x-y) for x,y in zip(applied,r.get('totalLoad',r.get('applied'))))<1e-6)
def diagnostics(d):
 if not d['completed']:return {'completed':False,'status':'Fail','error':d['error']}
 m,r,c=d['model'],d['result'],d['case'];u=translations(d)
 if c=='bridge':
  forces=[v['axialForce'] for v in r['members']];stress=[v['maxCombinedNormalStress'] for v in r['members']];util=[v['yieldIndicator'] for v in r['members']]
  cables=[i for i,e in enumerate(m['members']) if e['behavior']=='tension_only_cable'];slack=[i for i in cables if r['members'][i]['status']=='slack']
  conv=r['residualNorm_N']<r['loadEquilibriumTolerance_N'];iterations=sum(h['iterations'] for h in r['nonlinearHistory']);outer=None;absres=r['residualNorm_N'];solver_target=r['loadEquilibriumTolerance_N'];target_unit='N'
 elif c=='loop-towers':
  forces=r['force'];stress=[abs(x) for x in r['stress']];util=None
  cables=[i for i,e in enumerate(m['members']) if e['type']=='tension-only'];slack=[i for i in cables if not r['active'][i]]
  conv=r['converged'];iterations=r['iterations'];outer=r['activeSetIterations'];solver_target=1e-8;target_unit='relative'
  # Explicit member-force assembly checks true physical free-DOF residual after active set updates.
  fint=[[0,0,0] for _ in m['nodes']];fext=[[0,0,0] for _ in m['nodes']]
  for l in applied_loads(d):fext[l['node']]=add(fext[l['node']],l['force'])
  for e,N in zip(m['members'],forces):
   a,b=e['nodes'];delta=sub(m['nodes'][b]['position'],m['nodes'][a]['position']);f=mul(delta,N/norm(delta));fint[a]=sub(fint[a],f);fint[b]=add(fint[b],f)
  fixed={(s['node'],j) for s in m['supports'] for j in range(3) if s['restrained'][j]};absres=math.sqrt(sum((fint[i][j]-fext[i][j])**2 for i in range(len(fint)) for j in range(3) if (i,j) not in fixed))
 else:
  forces=r['axial'];stress=None;util=None;cables=[i for i,e in enumerate(m['members']) if e['type']!='frame'];slack=[i for i in cables if forces[i]<0]
  conv=r['converged'];iterations=r['iterations'];outer=None;absres=None;solver_target=1e-7;target_unit='relative'
 eq=equilibrium(d);force_peak=max(range(len(forces)),key=lambda i:abs(forces[i]));maxnode=max(range(len(u)),key=lambda i:norm(u[i]))
 out=dict(completed=True,max_displacement_m=r['maxDisplacement'],independent_max_displacement_m=max(map(norm,u)),max_displacement_node=maxnode,max_deck_displacement_m=r.get('maxDeckDisplacement'),peak_abs_axial_N=abs(forces[force_peak]),peak_axial_member=force_peak,peak_stress_Pa=max(stress) if stress else None,stress_definition='max combined normal stress (frame axial+bending; cable axial)' if c=='bridge' else 'max absolute axial stress' if c=='loop-towers' else 'not exported; no strength/utilization check implemented',peak_yield_indicator=max(util) if util else None,converged=conv,relative_residual=r['relativeResidual'],absolute_force_residual_N=absres,solver_iteration_count=iterations,active_set_iterations=outer,solver_target=solver_target,solver_target_unit=target_unit,nonlinear_history=r.get('nonlinearHistory'),cable_total=len(cables),cable_slack_count=len(slack),cable_taut_count=len(cables)-len(slack),slack_member_ids=slack,cable_mechanisms=r.get('cableMechanisms'),inactive_cable_dofs=r.get('inactiveCableDofs'),frame_min_scaled_pivot=r.get('frameMinScaledPivot'),equilibrium=eq)
 if stress:
  out['peak_stress_member']=max(range(len(stress)),key=lambda i:stress[i])
 if util:
  out['peak_yield_indicator_member']=max(range(len(util)),key=lambda i:util[i]);out['members_above_yield_screening']=[i for i,v in enumerate(util) if v>1]
  out['peak_frame_combined_stress_Pa']=max(stress[i] for i,e in enumerate(m['members']) if e['behavior']=='bilateral_frame')
 if c=='loop-towers':out['independent_relative_force_residual']=absres/max(1,math.sqrt(sum(norm(f)**2 for f in fext)))
 if c=='pavilion':
  increments=[v-(m['sections'][e['section']].get('prestress',0) if e['type']!='frame' else 0) for e,v in zip(m['members'],forces)]
  out['peak_abs_incremental_axial_N']=max(map(abs,increments));out['minimum_net_total_tension_N']=min(forces[i] for i in cables);out['initial_tension_N']=18000;out['state_note']='Slack flags only; fixed tangent is retained, with no active-set redistribution.'
 if c=='bridge':
  out['reference_prestress_Pa']=d['parameters']['cablePrestress']*1e6
  out['cable_tension_range_N']=[min(forces[i] for i in cables),max(forces[i] for i in cables)]
 if c=='loop-towers':out['cable_tension_range_N']=[min(forces[i] for i in cables),max(forces[i] for i in cables)]
 return out

def reflection_check(d,axis):
 m=d['model'];u=translations(d);nodes=m['nodes'];pairs={};ge=[]
 for n in nodes:
  target=n['position'].copy();target[axis]*=-1
  q=min(nodes,key=lambda q:norm(sub(q['position'],target)));err=norm(sub(q['position'],target));ge.append(err)
  if err<=threshold['symmetry_geometry_m']:pairs[n['id']]=q['id']
 out={'plane':'x=0' if axis==0 else 'z=0','matched_nodes':len(pairs),'total_nodes':len(nodes),'max_nearest_reflection_distance_m':max(ge)}
 if len(pairs)!=len(nodes) or len(set(pairs.values()))!=len(nodes):return dict(out,applicable=False,status='Partial',notes='N/A: authored geometry is asymmetric; all-node reflection pairing is not valid.')
 def ends(e):return e.get('nodes',[e.get('a'),e.get('b')])
 edges={tuple(sorted(ends(e))):e for e in m['members']};missing=[];property_error=0
 def nums(x):
  if isinstance(x,dict):return [v for k in sorted(x) for v in nums(x[k])]
  if isinstance(x,(float,int)):return [x]
  return []
 for e in m['members']:
  a,b=ends(e);other=edges.get(tuple(sorted([pairs[a],pairs[b]])))
  if not other:missing.append(e['id']);continue
  if e.get('material')!=other.get('material') or e.get('behavior')!=other.get('behavior') or e.get('type')!=other.get('type'):missing.append(e['id'])
  for x,y in zip(nums([e.get('section')]),nums([other.get('section')])):property_error=max(property_error,abs(x-y)/max(abs(x),abs(y),1e-30))
  if isinstance(e.get('section'),dict):
   for k,x in e['section'].items():
    if isinstance(x,(int,float)):property_error=max(property_error,abs(x-other['section'][k])/max(abs(x),abs(other['section'][k]),1e-30))
  if 'restLength' in e:property_error=max(property_error,abs(e['restLength']-other['restLength'])/e['restLength'])
 supports={s['node']:s.get('fixed',s.get('restrained')) for s in m['supports']};support_ok=all(supports.get(pairs[i])==v for i,v in supports.items())
 f=[[0,0,0] for _ in nodes]
 for l in applied_loads(d):f[l['node']]=add(f[l['node']],l['force'])
 transform=lambda v:[-x if j==axis else x for j,x in enumerate(v)]
 load_error=max(norm(sub(f[pairs[i]],transform(f[i]))) for i in pairs)
 unique=[(i,j) for i,j in pairs.items() if i<=j];errs=[norm(sub(u[j],transform(u[i]))) for i,j in unique];maxerr=max(errs);index=errs.index(maxerr)
 out.update(applicable=not missing and support_ok and property_error<1e-10 and load_error<1e-6,missing_or_mismatched_members=missing,max_member_property_relative_error=property_error,supports_symmetric=support_ok,load_reflection_error_N=load_error,unique_pairs_including_plane_nodes=len(unique),max_displacement_error_m=maxerr,rms_displacement_error_m=math.sqrt(sum(x*x for x in errs)/len(errs)),relative_displacement_error=maxerr/d['result']['maxDisplacement'],worst_pair=list(unique[index]),pairs=[{'nodes':[i,j],'displacement_i_m':u[i],'displacement_j_m':u[j],'reflection_error_m':err} for (i,j),err in zip(unique,errs)])
 out['status']='Pass' if out['applicable'] and out['relative_displacement_error']<=threshold['symmetry_displacement_relative'] else 'Fail' if out['applicable'] else 'Partial'
 if d['case']=='bridge':
  deck=set(sum(m['topology']['deck'],[]));e=[(norm(sub(u[j],transform(u[i]))),i,j) for i,j in unique if i in deck and j in deck];v,i,j=max(e);out['deck_symmetry']={'max_error_m':v,'relative_to_max_deck_displacement':v/d['result']['maxDeckDisplacement'],'worst_pair':[i,j]}
 return out

runs=[];baselines={};symmetries={};preservation={}
for spec in protocol['runs']:
 d=read(OUT/'runs'/f"{spec['id']}.json");diag=diagnostics(d)
 if d['test']=='baseline':
  baselines[d['case']]=d
  original=read(ROOT/'validation'/f"original-{d['case']}.json")
  authoritative=read(ROOT/'public/cases'/d['case']/'model.json')
  preservation[d['case']]={'matches_preserved_model':d['model']==original['model'],'matches_authoritative_model_json':d['model']==authoritative,'matches_preserved_full_result':d['result']==original['result']}
  symmetries[d['case']]=[reflection_check(d,a) for a in [0,2]]
 entry={k:v for k,v in d.items() if k not in ['model','result']};entry['diagnostics']=diag;entry['full_result_file']=f"runs/{d['id']}.json";runs.append(entry)
byid={d['id']:d for d in runs}
for run in runs:
 b=byid[run['case']+'-baseline'];a,z=run['diagnostics'],b['diagnostics']
 if not a['completed']:continue
 assert run['geometry_topology_support_sha256']==b['geometry_topology_support_sha256']
 a['geometry_topology_support_unchanged']=True
 a['changed_cable_state_member_ids']=sorted(set(a['slack_member_ids'])^set(z['slack_member_ids']))
 a['cable_state_changed_count']=len(a['changed_cable_state_member_ids']);a['cable_state_changed_fraction']=a['cable_state_changed_count']/a['cable_total'];a['substantial_cable_state_change']=a['cable_state_changed_fraction']>=threshold['substantial_cable_state_change_fraction']
 a['relative_changes']={k:(a[k]/z[k]-1 if z.get(k) else None) for k in ['max_displacement_m','max_deck_displacement_m','peak_abs_axial_N','peak_stress_Pa','peak_yield_indicator','peak_abs_incremental_axial_N'] if k in a}
 a['relative_changes']['reaction_resultant']=norm(a['equilibrium']['reaction_force_N'])/norm(z['equilibrium']['reaction_force_N'])-1
 if run['test'] in ['load','stiffness']:
  expected=run['factor'] if run['test']=='load' else 1/run['factor'];a['linear_reference_displacement_ratio']=expected;a['relative_deviation_from_linear_reference']=a['max_displacement_m']/z['max_displacement_m']/expected-1
 elif run['test']=='section' and run['case']=='loop-towers':
  expected=run['factor']**-2;a['linear_reference_displacement_ratio']=expected;a['relative_deviation_from_linear_reference']=a['max_displacement_m']/z['max_displacement_m']/expected-1
# Full-vector comparisons avoid accidentally comparing different peak-member locations.
for run in runs:
 if not run['diagnostics']['completed'] or run['test']=='baseline':continue
 d=read(OUT/run['full_result_file']);b=baselines[run['case']];a=run['diagnostics']
 if run['test'] not in ['load','stiffness','section']:continue
 if run['test']=='section' and run['case']!='loop-towers':continue
 factor=run['factor']
 expected_u=factor if run['test']=='load' else 1/factor if run['test']=='stiffness' else 1/factor**2
 expected_force=factor if run['test']=='load' else 1
 def normalized_error(x,y,f):return norm(sub(x,mul(y,f)))/max(norm(mul(y,f)),1e-30)
 def flat(us):return [v for u in us for v in u]
 def force_vector(d,incremental=False):
  if d['case']=='bridge':return [v['axialForce'] for v in d['result']['members']]
  if d['case']=='loop-towers':return d['result']['force']
  return [v-(d['model']['sections'][e['section']].get('prestress',0) if incremental and e['type']!='frame' else 0) for e,v in zip(d['model']['members'],d['result']['axial'])]
 a['vector_scaling_diagnostics']={'expected_displacement_multiplier':expected_u,'expected_force_multiplier':expected_force,'displacement_L2_relative_error':normalized_error(flat(translations(d)),flat(translations(b)),expected_u),'axial_total_L2_relative_error':normalized_error(force_vector(d),force_vector(b),expected_force),'axial_incremental_L2_relative_error':None if d['case']=='bridge' else normalized_error(force_vector(d,True),force_vector(b,True),expected_force),'reaction_L2_relative_error':normalized_error(flat([r['force'] for r in d['result']['reactions']]),flat([r['force'] for r in b['result']['reactions']]),expected_force),'axial_reference_note':'Bridge prestress-only member-force increments are not separately exported; incremental comparison is unavailable.' if d['case']=='bridge' else 'Pavilion net total axial includes fixed initial tension; only incremental axial is expected to scale with load.' if d['case']=='pavilion' else 'No prestress.', 'reference_only':run['case']!='loop-towers' and not (run['case']=='pavilion' and run['test']=='load')}
rows=[]
def row(case,test,param,base,value,expected,observed,change,status,notes,runid=''):
 if param=='pressure':param+=' (kPa)' if case=='bridge' else ' (Pa)'
 if param=='E':param+=' (GPa)'
 rows.append(dict(Case=case,Test=test,Parameter=param,**{'Baseline value':base,'Perturbed value':value,'Expected physical behavior':expected,'Observed response':observed,'Relative change':change,'Pass / Partial / Fail':status,'Notes':notes,'Run ID':runid}))
for run in runs:
 a=run['diagnostics'];c=run['case'];t=run['test'];b=byid[c+'-baseline']['diagnostics'];notes=[]
 if not a['completed']:
  row(c,t,run['parameter'],run['baseline_value'],run['perturbed_value'],'Converged response','Solver exception',None,'Fail',a['error']['message'],run['id']);continue
 u=a['max_displacement_m'];du=a['relative_changes']['max_displacement_m'];status='Pass';expected='Preserve baseline; solve within original tolerances'
 if t=='load':
  expected='Displacement, reaction and incremental forces increase with positive load; linear scaling if applicable';ok=(u-b['max_displacement_m'])*(run['factor']-1)>=-threshold['monotonic_relative_tolerance']*b['max_displacement_m'];status='Pass' if ok else 'Fail'
 elif t=='stiffness' or t.startswith('section'):
  expected='Increasing stiffness/size reduces displacement; 1/E only if full stiffness scales';ok=(u-b['max_displacement_m'])*(run['factor']-1)<=threshold['monotonic_relative_tolerance']*b['max_displacement_m'];status='Pass' if ok else 'Fail'
 if c=='bridge':
  notes.append('Authored-reference displacement includes prestress equilibration; primaryScale includes arches/root spines/deck; secondaryScale includes braces/cables.')
  if t in ['load','stiffness'] and abs(a['relative_deviation_from_linear_reference'])>threshold['linear_scaling_relative'] and status=='Pass':status='Partial';notes.append('Monotonic, but not linear proportional/inverse scaling: initial stress, corotational cables and active state must be retained.')
  if a['members_above_yield_screening']:notes.append(f"STRENGTH SCREENING CONCERN: {len(a['members_above_yield_screening'])} members have yield indicator >1; peak {a['peak_yield_indicator']:.6g}. Solver remains elastic; this is not a load-scaling failure.")
  if a['cable_mechanisms']:notes.append('Solver reports slack-cable free-motion modes; frame skeleton stable. All-node maximum is state-sensitive.')
 elif c=='pavilion':
  notes.append('Prescribed initial tension 18 kN/net member is not form-found; frame/reaction response is incremental, net axial force includes initial tension.')
  if t=='stiffness' and abs(a['relative_deviation_from_linear_reference'])>threshold['linear_scaling_relative'] and status=='Pass':status='Partial';notes.append('Fixed T0/L geometric tangent does not scale with E, so 1/E is inapplicable to the full tangent.')
  if a['cable_slack_count']:status='Partial' if status=='Pass' else status;notes.append('Negative total net tension flagged without redistribution: tangent applicability concern.')
 if a['substantial_cable_state_change']:notes.append('Substantial cable-state change (>=10% of all cable members).')
 if not a['converged']:status='Fail';notes.append('Convergence criterion not met.')
 if 'relative_deviation_from_linear_reference' in a:notes.append(f"Displacement deviation from linear reference: {a['relative_deviation_from_linear_reference']:.6%}.")
 notes.append(f"Cable slack {a['cable_slack_count']}/{a['cable_total']}; changed vs baseline {a['cable_state_changed_count']}.")
 obs=f"u_max={u*1000:.9g} mm; |R|={norm(a['equilibrium']['reaction_force_N'])/1000:.9g} kN; peak |N|={a['peak_abs_axial_N']/1000:.9g} kN"
 if a['max_deck_displacement_m'] is not None:obs+=f"; deck={a['max_deck_displacement_m']*1000:.9g} mm"
 if a['peak_stress_Pa'] is not None:obs+=f"; stress={a['peak_stress_Pa']/1e6:.9g} MPa"
 if a['peak_yield_indicator'] is not None:obs+=f"; yield indicator={a['peak_yield_indicator']:.9g}"
 row(c,t,run['parameter'],run['baseline_value'] if t!='baseline' else json.dumps(run['parameters'],sort_keys=True),run['perturbed_value'] if t!='baseline' else 'unchanged',expected,obs,json.dumps(a['relative_changes']),status,' '.join(notes),run['id'])
for c in baselines:
 a=byid[c+'-baseline']['diagnostics'];eq=a['equilibrium']
 for kind,unit in [('force','N'),('moment','Nm')]:
  note='Reference-coordinate force-plus-support-moment balance; initial prestress reactions are not supplied.' if c=='pavilion' and kind=='moment' else 'Independently assembled applied nodal loads and returned support reactions.'
  if c=='pavilion' and kind=='moment':note+=' Defect is accounted for by the fixed initial-tension transverse tangent torque. Actual full moment equilibrium concern, not a PCG convergence failure.'
  row(c,'equilibrium-'+kind,'global resultant',0,eq[kind+'_absolute_error_'+unit],f"Relative error <= {threshold['global_'+kind+'_relative']:g}",f"absolute={eq[kind+'_absolute_error_'+unit]:.9g} {unit}; relative={eq[kind+'_relative_error']:.9g}",eq[kind+'_relative_error'],eq[kind+'_status'],note,c+'-baseline')
 for sym in symmetries[c]:
  row(c,'symmetry',sym['plane'],0,sym.get('max_displacement_error_m'),'Mirror-paired displacements when geometry, members, supports and load are symmetric',f"paired {sym['matched_nodes']}/{sym['total_nodes']}; max displacement error={sym.get('max_displacement_error_m','N/A')} m",sym.get('relative_displacement_error'),sym['status'],sym.get('notes','Complete geometry, member properties, supports and load reflection verified.'),c+'-baseline')
 for run in [d for d in runs if d['case']==c]:
  a=run['diagnostics']
  if not a['completed']:continue
  row(c,'convergence',run['id'],byid[c+'-baseline']['diagnostics']['relative_residual'],a['relative_residual'],'Original solver convergence/stop tolerance met',f"converged={a['converged']}; residual={a['relative_residual']:.9g}; iterations={a['solver_iteration_count']}; active-set iterations={a['active_set_iterations']}",None,'Pass' if a['converged'] else 'Fail',f"slack={a['cable_slack_count']}/{a['cable_total']}; changed cables={a['cable_state_changed_count']}; target={a['solver_target']} {a['solver_target_unit']}",run['id'])
for run in runs:
 a=run['diagnostics']
 if a.get('members_above_yield_screening'):
  row(run['case'],'yield-screening','max yield indicator',byid[run['case']+'-baseline']['diagnostics']['peak_yield_indicator'],a['peak_yield_indicator'],'Existing elastic yield screening indicator <=1',f"{len(a['members_above_yield_screening'])} members above 1",a['relative_changes']['peak_yield_indicator'],'Fail','Strength screening concern; no plasticity is modeled. This does not fail the monotonic load-response check.',run['id'])
result=dict(generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),protocol=protocol,baseline_preservation=preservation,source_preservation_file='source-preservation.json',runs=runs,symmetry=symmetries,summary=rows)
(OUT/'physics-sanity-results.json').write_text(json.dumps(result,indent=2)+'\n')
with (OUT/'physics-sanity-summary.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
for d in runs:
 a=d['diagnostics'];print(d['id'],json.dumps({k:a.get(k) for k in ['max_displacement_m','max_deck_displacement_m','peak_abs_axial_N','peak_stress_Pa','peak_yield_indicator','converged','relative_residual','solver_iteration_count','active_set_iterations','cable_slack_count','cable_state_changed_count','cable_mechanisms','minimum_net_total_tension_N']}))
print('Preservation',preservation)
for c in baselines:
 print(c,'equilibrium',byid[c+'-baseline']['diagnostics']['equilibrium'])
 print(c,'symmetry',[{k:v for k,v in s.items() if k!='pairs'} for s in symmetries[c]])
