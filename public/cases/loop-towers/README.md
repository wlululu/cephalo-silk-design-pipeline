# Cephalo · Loop Towers

A Three.js reconstruction of the supplied bioinspired building image, with a reproducible 3D elastic lattice solver. The building is the sole focus; landscape and city context are omitted.

## Run locally

Extract `source.zip`, open a terminal in the extracted directory, then run:

```bash
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000 in a browser with WebGL enabled. Do not open index.html directly: module imports and the analysis worker require HTTP. Three.js 0.170.0 and OrbitControls are included locally; no npm installation, API keys, GPU server or remote assets are required. Node.js is only needed for the optional numerical verification:

```bash
node tests/verify.mjs
```

## Inferred structural interpretation

- **Two distinct inhabited towers:** approximately 140 m and 152 m tall, with 3.8 m floor spacing, tapering elliptical terraced envelopes and braced equivalent cores. These dimensions are assumed, not measured from the source.
- **Inclined upper crown:** an oval loop, centered approximately at x = −3 m, y = 123 m, rotated 27.5° from an upright ellipse. Its major and minor radii are 46 m and 27 m. Its plane also changes depth slightly. Four-chord triangulated box geometry provides an interpretable approximation to flexure and torsion.
- **Sweeping lower cradle:** a continuous U-shaped box member from the left tower shoulder, down around the central void and back to the right shoulder. The low point is approximately 25 m above grade.
- **Suspended web:** a hierarchy of slender tension-only fan members between the crown and tower levels, plus sparse crossing chords within the crown. Straight chord idealizations replace the unresolved cable curvature in the source.
- **Transfer zones:** short equivalent struts tie crown and cradle cross-sections to tower core levels. These inferred connections turn the visual concept into a supported structural graph.
- **Circulation:** ground entrances and a level concourse, lift cores, two conceptual stair shafts per tower, and level terrace access. Steep crown/cradle elements are not walkways. The circulation overlay depicts the undeformed circulation concept. Stair landings, lift sizing, guardrail details, egress distances and accessibility compliance are not resolved.

Single-image reconstruction cannot uniquely determine depth, dimensions, floor plans, rear geometry or connections. The model preserves the visible defining relationships but does not claim to recover a unique original building.

## Interactive use

Drag to orbit, scroll to zoom and right-drag to pan. Use Perspective, Front, Side and Plan for repeatable viewpoints. The focused viewport also accepts arrow keys to orbit/raise/lower the view and +/− to zoom.

- **Building** displays smooth loops, terraced slabs, glazing and suspended web members.
- **Structure** reveals 460 nodes and 2,208 equivalent members, including loop shear diagonals and tower core bracing. Gold base symbols indicate restrained translations.
- **Response** colors the lattice by member-end mean displacement magnitude, signed axial force or signed axial stress. Gray web members are slack. Displacement legend maximum is the maximum nodal displacement. Signed quantities use a symmetric ± maximum absolute scale. Colors rescale to each solution, so consult numeric values when comparing cases.
- Click a visible member to inspect its group, idealization, area, force and stress.
- Deformation scale affects display only. Metrics always report actual, unamplified response. Animation cycles smoothly between undeformed and amplified deformed geometry; it is not a dynamic simulation.
- Lift/stair/route highlighting is an undeformed architectural overlay. Floor envelopes follow interpolated tower translations; they are not mechanically solved shell elements.

## Mechanics

Coordinates and results use metres, newtons and pascals, with y vertical. Each node has three translations. Eight tower base nodes are fixed in all translations. Core chords use E = 32 GPa concrete; steel lattice, transfer and web members use E = 200 GPa.

A member with length L, axial area A, modulus E and unit direction n contributes the axial stiffness EA/L times the outer product of [−n, n]. The assembled equilibrium system is solved with diagonally preconditioned conjugate gradients (relative residual target 1e−8, at most 6,000 iterations per active-set solve). Tension-only web members are removed when their extension is negative and can reactivate when their extension becomes positive. At most 35 active-set iterations are allowed; nonconvergence is exposed in the interface and results.

Ring bending and torsion, and core bending/shear, emerge from separated chords and triangulation. Individual elements carry axial force only; there are no beam rotational degrees of freedom. Reported stresses refer to equivalent lattice areas, not peak stresses in an engineered shell or reinforced-concrete section.

No cable pretension or cable geometric stiffness is included. The primary lattice remains stable with slack cable members. No self-weight is recalculated from density; applied gravity is the explicit illustrative load set below.

### Load cases and parameters

Gravity is always included. Each non-base tower core node receives 750 kN downward, representing aggregated tributary floors. Each crown and cradle node receives 22 kN downward as lumped dead load. Total default gravity is 79,832 kN. Neither value is derived from a design code or validated occupancy program.

Transverse or depth wind adds 65 kN in +x or +z at each non-base tower node (6,240 kN total). The load multiplier scales both gravity and selected wind simultaneously.

- Stiffness multiplier scales every modulus E.
- Thickness multiplier t scales each equivalent member area by t². It also scales displayed lattice member radii; architectural shell dimensions and floor thickness stay fixed. It is a solid/equivalent cross-section scale, not a shell wall-thickness law.
- Load multiplier scales the fixed applied load vectors. Changing thickness does not change gravity.

The model excludes foundation/soil behavior, dynamics, buckling, P–delta, connection design, concrete cracking, member strength, floor diaphragm/shell response and design-code checks. It is a conceptual load-path experiment, not evidence of capacity, safety, permit readiness or accessibility compliance.

## Files and exports

- `dist/index.html`, `style.css`, `app.js`: interface and Three.js scene.
- `dist/model.js`: parametric geometry, nodes, member connectivity, supports, sections and loads.
- `dist/model.json`: default machine-readable model, including all load cases and assumptions.
- `dist/solver.js`, `worker.js`: solver and off-main-thread execution.
- `dist/vendor/`: vendored Three.js, OrbitControls and MIT license.
- `dist/reference.png`: user-supplied original concept.
- `tests/verify.mjs`: equilibrium, fixed-support, zero-load, stiffness-scaling and directional load checks.

The **Model JSON** button exports the current model with scaled E, areas and the selected scaled load vectors. These values are already scaled: do not multiply them by the recorded parameters again. The static `dist/model.json` contains unscaled base values and all load cases. **Results JSON** exports actual nodal displacements, member forces/stresses, cable active flags, reactions, summed applied force, force-balance errors, convergence and the parameters used.

To run the solver programmatically with Node.js:

```js
import { makeModel, defaults } from './dist/model.js';
import { solve } from './dist/solver.js';
const results = solve(makeModel(), { ...defaults, case: 'wind' });
console.log(results.maxDisplacement); // metres
```

## Numerical verification

For the default model, checked in Node.js:

| Case | Maximum displacement | Solve status |
| --- | ---: | --- |
| Gravity | 23.10 mm | Converged |
| Gravity + transverse wind | 93.27 mm | Converged |
| Gravity + depth wind | 115.33 mm | Converged |

Total force imbalance is below 0.04 N in each coordinate in these checks. Doubling all moduli halves displacement; base translations remain zero; zero loading gives zero displacement. A separate two-node analytical test checks EA/L extension, load sharing in tension and zero cable force under compression. These checks verify implementation consistency, not structural realism or engineering adequacy. No browser-based visual or interaction testing was performed in this build.
