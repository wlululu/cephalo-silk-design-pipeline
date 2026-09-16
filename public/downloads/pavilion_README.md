# Cephalo — Petal Pavilion

An interactive Three.js reconstruction of the supplied woven-wing pavilion concept. The interpretation preserves four unequal-height sweeping perimeter arches, a fine crossed woven surface, four flared branching support clusters and an open, level floor beneath the canopy.

## Run locally

Python 3 is sufficient to serve the app; no installation or build is required.

```bash
cd cephalo-petal-lab
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000 in a modern browser with WebGL enabled. Use an HTTP server rather than opening index.html directly. Three.js and OrbitControls are bundled locally; the app requires no external CDN or API. Stop the server with Ctrl+C.

Optional developer commands (Node.js with ES module support):

```bash
node export-model.mjs  # regenerate model.json and baseline-results.json
node verify.mjs        # analytical beam benchmark and model checks
```

## Using the app

- Drag to orbit; scroll/pinch to zoom; right-drag to pan. Camera buttons give perspective, front, side and top views.
- Concept shows the dense woven envelope and smooth primary members. Structure reveals the equivalent analysis discretization. Response shows calculated displacement with a 15× display scale.
- Choose gravity, uplift, lateral or one-sided downward loading, then adjust pressure, elastic modulus and member size. Calculations update automatically.
- Color by structural hierarchy, displacement magnitude, or axial force (positive = tension, negative = compression).
- Deformation amplification affects only displayed geometry; all numerical results remain actual SI quantities.
- Toggle woven field, branching supports, undeformed outline and load vectors. Visibility never removes elements from the analysis.
- Export Model JSON includes the baseline topology plus current parameter multipliers. Export Results JSON includes current displacements, axial forces, reactions, applied load, balance, residual and slack count.

## Geometry inferred from the image

No dimensions were provided. The model assumes an approximately 28 × 24 m outer envelope and a maximum arch height of 17.35 m. Four roots are located at the corners of a nominal 24 × 21 m footprint. A parametric anticlastic surface spans four continuous arches of unequal height. The central floor is level and unimpeded by interior columns. Branches flare near the perimeter. The precise concealed geometry, scale and support count are interpretive; this is not photogrammetric recovery. Accessible passages are preserved geometrically, but no accessibility code audit has been performed.

The structural mesh has 197 nodes and 648 members. The finer rendered threads are interpolated over the same surface; they are not separate analysis members. In concept mode the thin parallel arch trim and small ties are visual detailing only; the equivalent primary tube carries their structural role. Smooth rendering interpolates the segmented frame and support geometry. Structure/Response modes display the analysis members directly.

## Structural assumptions

- Units: metres, newtons, pascals, radians. Y is vertical.
- Primary arches, trunks and branches: linear 3D Euler–Bernoulli frame elements, six degrees of freedom per frame node, rigid connections.
- All four foot nodes are fixed in translation and rotation.
- Steel: E = 200 GPa, Poisson ratio = 0.30. Tubes: arch diameter 300 mm / wall 14 mm; trunk 340 / 18 mm; branch 180 / 9 mm.
- Woven field: a coarse equivalent prestressed bar net with three translational degrees of freedom per cable-only node. Equivalent E = 80 GPa, bundle area = 180 mm², prescribed initial tension T0 = 18 kN per net member.
- Each cable tangent block is `EA/L n nᵀ + T0/L (I − n nᵀ)`. Initial tension provides transverse tangent stiffness. Frame stiffness is conventional axial, torsional and biaxial bending stiffness transformed to global coordinates.
- The initial prestressed geometry is prescribed. Initial equilibrium, prestress compatibility and form-finding are NOT solved. Net axial output is T0 plus incremental axial force; frame forces and support reactions are incremental and exclude prestress-state forces.
- Pressure is integrated over the horizontal projected triangular mesh area, divided equally among face nodes. Lateral pressure uses this same projected area for comparison and is not a wind-code loading prescription. Asymmetric loading selects triangles whose centroid has x > 0.
- Gravity means an applied downward pressure. Material density is supplied in model.json but self-weight is not automatically added.
- Member size multiplies tube diameter and wall together, and net area by the square of the multiplier. Elastic modulus scales both materials. Initial tension stays fixed.
- A preconditioned conjugate-gradient solve uses a relative residual target of 1e-7. The UI reports unresolved if the residual exceeds 1e-6.
- Negative total net force is flagged as slack; there is no tension-only active-set redistribution. Results with slack or large movements require a nonlinear analysis. Wrinkling, buckling, large rotations, support settlement, connections and member strength/capacity are not modeled.

These calculations are for interpreting load paths and comparing conceptual parameter changes. They do not establish structural safety, constructability or regulatory compliance.

## Baseline and verification

At 0.30 kPa downward pressure with default section sizes and moduli:

- Applied vertical load: 177.041 kN.
- Maximum displacement: 139.469 mm.
- Relative solver residual: 8.33e-8.
- No predicted slack net members.
- Translational force balance error: less than 0.001 N per axis.

The analytical 4 m cantilever under a 1 kN transverse tip load matches `FL³/(3EI)` and the fixed-end moment. Additional checks cover zero load, proportional load response, all four load cases and the soft/thin and stiff/thick slider extremes (12 scenarios); all converge and balance forces. These are numerical verification checks, not validation against physical measurements. Browser interaction/visual QA was not performed in this environment.

## Files

- `dist/index.html`, `style.css`, `app.js`: interactive interface and renderer.
- `dist/model.js`: parameterized geometry, materials, sections, topology and assumptions.
- `dist/solver.js`: matrix-free frame/net solver.
- `dist/model.json`: editable baseline nodes, members, sections, materials, supports, faces and load cases.
- `dist/baseline-results.json`: baseline response with node/member array order matching model.json.
- `dist/reference.png`: user-provided reference image.
- `dist/vendor/`: local Three.js modules and MIT license.
- `export-model.mjs`, `verify.mjs`: reproducible export and numerical checks.

To change geometry, modify `surface()` or topology in `dist/model.js`, then rerun `node export-model.mjs`. To edit only the JSON and use it in the app, replace `makeModel()` in app.js with an awaited fetch of the edited `model.json`; preserve IDs, array order, grid and branch metadata required by the renderer.
