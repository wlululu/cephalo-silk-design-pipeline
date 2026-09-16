"""Run existing solvers unchanged; Python 3 + Node >=22.13; no npm install required."""
import concurrent.futures, hashlib, json, pathlib, subprocess, sys, datetime
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'validation/physics'
# Hash tracked sources in a checkout, or the preserved source manifest in a ZIP.
try:
    source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,stderr=subprocess.DEVNULL).decode().strip()
    source_paths=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
except (subprocess.CalledProcessError,FileNotFoundError):
    source_commit=json.loads((OUT/'protocol.json').read_text())['source_commit']
    source_paths=list(json.loads((OUT/'source-hashes-before.json').read_text()))
def hashes():
    paths=source_paths
    return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths if p and not p.startswith('validation/physics/')}
specs=[]
for case,controls in [('bridge',[('load','pressure',5,[.5,1,2]),('stiffness','E',200,[.5,1,2]),('section-primary','primaryScale',1,[.75,1,1.25]),('section-secondary','secondaryScale',1,[.75,1,1.25])]),('loop-towers',[('load','load',1,[.5,1,2]),('stiffness','stiffness',1,[.5,1,2]),('section','thickness',1,[.75,1,1.25])]),('pavilion',[('load','pressure',300,[.5,1,2]),('stiffness','stiffness',1,[.5,1,2]),('section','thickness',1,[.75,1,1.25])])]:
    specs.append(dict(case=case,id=case+'-baseline',test='baseline',parameter='defaults',factor=1,baseline_value=None,perturbed_value=None,overrides={}))
    for test,parameter,base,factors in controls:
        for factor in factors:
            if factor==1:continue
            specs.append(dict(case=case,id=f'{case}-{test}-{factor:g}',test=test,parameter=parameter,factor=factor,baseline_value=base,perturbed_value=base*factor,overrides={parameter:base*factor}))
protocol={
 'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'source_commit':source_commit,
 'isolation':'One fresh Node process per run; original generator and solver; no solver edits or cache reuse. Factor 1 shares each case baseline.',
 'thresholds':{'global_force_relative':1e-6,'global_moment_relative':1e-6,'linear_scaling_relative':1e-4,'monotonic_relative_tolerance':1e-4,'symmetry_displacement_relative':1e-3,'symmetry_geometry_m':1e-6,'substantial_cable_state_change_fraction':.10},
 'moment_normalization':'Sum of ||r cross F|| and ||applied nodal moment|| over external nodal loads, origin (0,0,0); floor 1 Nm.',
 'force_normalization':'Sum of norms of external nodal load vectors, floor 1 N.',
 'classification':'Pass: stated diagnostic met. Partial: explained formulation/active-state limitation or inapplicability. Fail: failed solve or unexplained numerical/mechanics inconsistency. These are study thresholds, not design acceptance standards.',
 'runs':specs}
OUT.mkdir(parents=True,exist_ok=True);(OUT/'runs').mkdir(exist_ok=True)
if any((OUT/'runs').glob('*.json')) and '--overwrite-study' not in sys.argv:raise SystemExit('Existing study protected. Use --overwrite-study only to rerun validation outputs; source baselines are never overwritten.')
before=hashes();(OUT/'protocol.json').write_text(json.dumps(protocol,indent=2)+'\n');(OUT/'source-hashes-before.json').write_text(json.dumps(before,indent=2)+'\n')
def run(spec):
    result=subprocess.run(['node',str(OUT/'run-one.mjs'),json.dumps(spec)],cwd=ROOT,capture_output=True,text=True)
    print(result.stdout or result.stderr,flush=True)
    if result.returncode:raise RuntimeError(spec['id']+': '+result.stderr)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(run,specs))
after=hashes();assert before==after,'Protected source changed during study'
(OUT/'source-preservation.json').write_text(json.dumps({'unchanged':True,'protected_file_count':len(before),'sha256':after},indent=2)+'\n')
print('All',len(specs),'runs recorded; protected files unchanged.',flush=True)
