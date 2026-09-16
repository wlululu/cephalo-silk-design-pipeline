# Cephalo bridge — hybrid lattice arches and tensile web

This refinement preserves the current V2-based bridge geometry and accessibility while distinguishing the thick primary arch system from its lighter web. The complete source, prebuilt local app, structural JSON, baseline results, GLB/STL exports and validation reports are included.

## Structural interpretation

| System | Representation | Mechanical behavior |
|---|---|---|
| Twin primary arches | Three substantial hollow chords per arch, on the same original curves; assumed diameter grades from 0.85 m at the ends to 1.05 m at the crown | Compression, tension, bending and torsion through elastic frame elements |
| Arch-internal substructure | Triangular diaphragms every 2 m and bracing across all three faces, contained within each arch; previous diamond weave retained | Rigidly joined stabilizing frame members |
| Deck | Existing longitudinal girders and transverse floors; slender under-deck cross ties | Elastic frame grillage with tension-only cross ties; visual surface distributes load but adds no shell stiffness |
| Secondary web | Existing local radial/capture fields, with 35 mm radial, 22 mm capture and 14 mm fine equivalent cable diameters | Pin-ended, geometrically nonlinear tension-only axial elements; zero compression, bending or torsional capacity |
| Flared woven ends | Existing four fan geometries, spines, lattice, deck links and foundations | Connected elastic frame support zones |

Each arch encloses **2.3 m vertical and 1.9 m transverse centerline depth**, plus chord radii. These are built-up lattice arches, not single lines, cosmetic shells or additional solid bands. Only the individual chord/brace stiffness is counted. Section dimensions are assumptions, not measurements from the image. Default model: **762 nodes, 3,155 members, including 554 tension-only cable segments**.

All original V2 arch stations and global dimensions remain. The deck is 14 m wide with a 12 m clear corridor, 5 m reserved headroom and two 18 m level approaches, giving 156 m total deck length. Deck girder/floor and root-frame sections, connectivity, supports and load distributions are retained. Under-deck cross-tie connectivity is retained with lighter 22 mm tension-only sections. No large new loop or global motif is introduced. Crossing lines connect only where they share node IDs.

`system` identifies the five categories above. `hierarchy` retains primary/secondary/tertiary classification. `behavior` distinguishes `bilateral_frame` and `tension_only_cable`. Cable records contain equivalent area, reference prestress and unstressed `restLength`. The JSON is authoritative for analysis.

## Run locally

Unzip, open a terminal inside `cephalo-bridge`, and run:

```bash
python3 scripts/serve-local.py
```

On Windows use `py scripts/serve-local.py`. Open `http://localhost:8000/`. Python 3 serves the included prebuilt app; no npm, API key or remote compute is needed. Keep the terminal open and press Ctrl+C to stop. Do not double-click `index.html`: JavaScript modules and the analysis worker require HTTP.

For source editing with Node.js 22.13+:

```bash
npm ci
npm run dev:portable
```

Open `http://localhost:5173/`. Run `npm run build:portable` and `npm run preview:portable` to build/preview edited source. The Python server prefers the included `standalone/`, so use dev/preview after source changes to avoid viewing the older prebuilt copy.

## Interaction and results

Existing cameras, rotation/zoom, node selection, node loading, deck pressure, point loads, E and section controls, deformed/ghost views and exports remain. Five system highlights and matching colors distinguish the arch chords, arch interior, deck, cables and woven ends.

A cable prestress control sets the assumed reference shortening (80 MPa reference stress by default). This does **not** impose a constant force in every cable. The solver first equilibrates the shortened network against the supporting frame, then applies load in stages. Final cable tensions can differ, and some strands can slacken. `Prestress only` removes applied loading while retaining initial shortening.

The main displacement metric is the maximum **deck** translation; the separate all-node metric also includes web shape adjustment. Both are measured from the authored geometry and include prestress equilibration. Results include taut/slack counts, reactions, axial forces and screening stress ratios. Loading-only displacement would require subtracting a separately exported prestress-only solution at the same settings.

The first nonlinear analysis can take tens of seconds. It runs in a worker, leaving the view interactive. Loading changes can reuse an equilibrated prestress state; changing geometry/materials recomputes it. Changing controls during a solve cancels obsolete work. There is no automatic parameter saving or arbitrary JSON import. Export Model JSON and Results JSON to keep an experiment.

Default 5 kPa main-span pressure with 80 MPa reference prestress gives approximately **36.7 mm maximum deck movement**, **76.9 mm maximum all-node movement** and **8,400 kN upward reaction**. These include prestress equilibration. The default web has 542 taut and 12 slack segments. Use the bundled baseline JSON for full precision.

## Mechanics and limitations

Frames retain the verified six-DOF Euler–Bernoulli formulation (axial, biaxial bending and Saint-Venant torsion), with small-displacement linear kinematics. Cable-only joints have three translations and no rotational stiffness. Cables use the current endpoint separation and an elastic tension-only force law:

`N = EA × max(0, currentLength / restLength − 1)`

Their tangent includes both axial material stiffness and transverse geometric stiffness from tension. They have no artificial bending stiffness. Newton iteration with energy line search solves equilibrium; load steps follow initial prestress equilibration. RCM ordering and equilibrated skyline Cholesky solve the tangent equations. Initial prestress equilibrium uses a 0.02 N free-force residual norm tolerance; loaded stages use max(0.002 N, 1e-9 times the applied load-vector norm). These absolute force tolerances avoid chasing numerical noise in almost slack web modes. The exported relative residual is normalized by the larger norm of applied and internal nodal forces; the absolute residual and tolerances are also exported.

Temporary Hessian shifts can assist iteration across slack states; final residuals use the unmodified physical forces. The supported frame skeleton is checked independently for stability. Exactly inactive cable-only DOFs are omitted algebraically, not assigned physical supports. Slack patches may have local free-motion modes and nonunique unloaded joint positions; these are reported. The resulting equilibrium is not a proof of global buckling stability or a uniquely form-found web.

Steel assumptions: E=200 GPa and nu=0.3; frame yield screening strength 355 MPa, equivalent cable tensile screening strength 1000 MPa. Cable equivalent diameters/strengths do not specify a commercial cable, strand lay or anchorage. Section scaling modifies actual analysis properties. Individual-element Euler ratios apply only to compressive frame members, not cables, and are not built-up arch buckling checks.

Excluded: self-weight and sag within an individual cable segment, approach live loads, frame large rotations/P–delta, material plasticity, local/global buckling solution, fatigue, wind/dynamics, impact, connections and foundation/soil flexibility. The travel envelope and guards are assumed geometry, not verified regulatory or impact performance. This remains a simplified structural concept, not a validated bridge design.

GLB/STL use the same undeformed geometry factory as the app. They contain outer cylinders, a zero-thickness deck and visual guards; tube bores, fabrication details and boolean unions are absent. STL omits line-only infill and uses meters by convention. GLB member metadata records structural systems and behaviors.

## Verification

```bash
node tests/mechanics.mjs
node tests/hybrid.mjs
node tests/v2-preservation.mjs
node tests/exports.mjs
npm run build:portable
```

The checks cover analytical frame benchmarks, nonlinear cable equilibrium, cable slackening/tangent consistency, graph connectivity, symmetry, force balance, material/load response, approach/root preservation and maximum-section travel-envelope clearance. Reports and baseline numbers are in `public/bridge/validation.json`, `hybrid-validation.json`, `v2-preservation.json` and `export-validation.json`.

Both portable and hosted production builds are checked. Browser interactions have not been re-tested in this refinement. `geometry-overview.png` is a diagnostic projection of the authoritative JSON, not a browser screenshot or a numerical measure of image fidelity.

## Source map

- `lib/bridge/model.mjs`: geometry, sections, classification, supports and loads.
- `lib/bridge/geometry.mjs`: shared visualization and export geometry.
- `public/bridge/frame-element.mjs`, `solver.mjs`: verified frame elements and linear solve path.
- `public/bridge/hybrid.mjs`, `worker.mjs`: nonlinear cable/frame solve and browser worker.
- `app/page.tsx`, `BridgeView.tsx`, `globals.css`: interface and 3D viewport.
- `lib/bridge/CanvasRenderer.mjs`: software fallback when WebGL is unavailable.
- `scripts/serve-local.py`, `package-project.py`: local serving and downloadable bundle.
