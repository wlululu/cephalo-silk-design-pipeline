"""Independent artifact QA. Verifies evidence, not that every physics test passes."""
import csv,hashlib,json,math,pathlib
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[1]
read=lambda p:json.loads(p.read_text())
r=read(OUT/'physics-sanity-results.json');before=read(OUT/'source-hashes-before.json');checks=[]
for p,h in before.items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h,p+' changed'
checks.append(f'{len(before)} protected source/baseline/export files retain their SHA-256 hashes')
assert len(r['runs'])==23 and len({d['id'] for d in r['runs']})==23
assert len(list((OUT/'runs').glob('*.json')))==23
for c,p in r['baseline_preservation'].items():assert all(p.values()),c
checks.append('All three complete baselines exactly match original model/result records and authoritative model.json files')
for run in r['runs']:
 d=read(OUT/run['full_result_file']);a=run['diagnostics'];m=d['model'];s=d['result'];c=d['case']
 assert d['completed'] and a['converged'] and a['geometry_topology_support_unchanged']
 assert a['equilibrium']['independently_assembled_loads_match_solver']
 assert math.isclose(a['max_displacement_m'],a['independent_max_displacement_m'],rel_tol=1e-13)
 total=[sum(v['force'][i] for v in s['reactions']) for i in range(3)]
 assert total==a['equilibrium']['reaction_force_N']
 if c=='bridge':
  assert not s['cableMechanisms'] and s['frameMinScaledPivot']>0
  assert len(s['nonlinearHistory'])==5 and all(not h.get('cached',False) for h in s['nonlinearHistory'])
  assert all(h['residualNorm']<(s['initialEquilibriumTolerance_N'] if h['loadFactor']==0 else s['loadEquilibriumTolerance_N']) for h in s['nonlinearHistory'])
 if c=='loop-towers':
  assert a['independent_relative_force_residual']<1e-8
  for e in m['members']:
   if e['type']!='tension-only':continue
   i,j=e['nodes'];delta=[m['nodes'][j]['position'][k]-m['nodes'][i]['position'][k] for k in range(3)];L=math.sqrt(sum(v*v for v in delta));ext=sum(delta[k]/L*(s['u'][3*j+k]-s['u'][3*i+k]) for k in range(3))
   assert ext>=-1e-10 if s['active'][e['id']] else ext<=1e-10
  if d['test'] in ['load','stiffness','section']:
   v=a['vector_scaling_diagnostics'];assert v['displacement_L2_relative_error']<1e-8 and v['axial_total_L2_relative_error']<1e-8 and v['reaction_L2_relative_error']<1e-8
 if c=='pavilion' and d['test']=='load':
  v=a['vector_scaling_diagnostics'];assert v['displacement_L2_relative_error']<1e-12 and v['axial_incremental_L2_relative_error']<1e-12 and v['reaction_L2_relative_error']<1e-12
checks.append('All 23 records have complete model/results, independently matching displacement maxima and support sums, and accepted original convergence diagnostics')
checks.append('Bridge runs have uncached five-stage histories; tower active states and independently reassembled residuals agree; linear vector-scaling claims verified')
byid={d['id']:d for d in r['runs']}
assert byid['pavilion-baseline']['diagnostics']['equilibrium']['moment_status']=='Fail'
assert byid['pavilion-load-2']['diagnostics']['cable_slack_count']==4
assert byid['pavilion-load-2']['diagnostics']['minimum_net_total_tension_N']<0
assert len(byid['bridge-load-2']['diagnostics']['members_above_yield_screening'])==4
for c in ['bridge','loop-towers','pavilion']:
 ds=[d for d in r['runs'] if d['case']==c];b=byid[c+'-baseline']
 for test in {d['test'] for d in ds}-{'baseline'}:
  sweep=sorted([d for d in ds if d['test']==test]+[dict(b,factor=1)],key=lambda d:d['factor']);u=[d['diagnostics']['max_displacement_m'] for d in sweep]
  assert u[0]<u[1]<u[2] if test=='load' else u[0]>u[1]>u[2]
checks.append('Every perturbation sweep is strictly monotonic in the expected direction; pavilion moment/slack and bridge yield concerns remain explicitly recorded')
with (OUT/'physics-sanity-summary.csv').open() as f:rows=list(csv.DictReader(f))
assert len(rows)==len(r['summary'])
assert len([x for x in rows if x['Test']=='convergence'])==23
assert len([x for x in rows if x['Pass / Partial / Fail']=='Fail'])==2
text=(OUT/'physics-sanity-report.md').read_text()
for run in r['runs']:assert run['id'] in text
# Ensure Markdown tables have stable column counts and no unrendered placeholders.
count=None
for line in text.splitlines():
 if line.startswith('| '):
  n=line.count('|')
  if count is None:count=n
  assert n==count,line
 else:count=None
assert 'TODO' not in text and 'undefined' not in text
checks.append(f'CSV ({len(rows)} rows), JSON and Markdown are consistent; all 23 run IDs present and table columns well formed')
(OUT/'verification.json').write_text(json.dumps({'artifact_qa_passed':True,'checks':checks,'note':'Successful artifact QA does not change the recorded failed moment/yield checks or partial applicability findings.'},indent=2)+'\n')
print('\n'.join(checks))
