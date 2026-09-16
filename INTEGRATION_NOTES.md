# Integration notes

## Scope

Integrated the three supplied projects without model regeneration. The original bridge geometry/model builders and all three mechanics implementations are unchanged. Default and representative changed-parameter results exactly match the original modules. Original archives are retained intact in `public/downloads/`.

## Compatibility and interface changes

1. **Module locations and asset paths.** Bridge UI imports now resolve to `cases/bridge/`; its worker/data URLs use `/cases/bridge/`. Its solver and worker source are unchanged. The two plain-JavaScript apps retain their local relative import/worker paths and separate vendored Three.js versions.
2. **Independent lifecycle.** Hash navigation mounts/unmounts the bridge or a native-case iframe. Switching cases resets to the destination's own defaults; no model, parameter or solver state is shared.
3. **Shared presentation.** A single header/navigation and shared navy/cyan/gray stylesheet replace the original outer layouts. The DOM adapter moves existing controls without duplicating their IDs or replacing their physical meanings. The bridge keeps its existing slider/switch/select primitives. All source download paths point to actual retained archives. On localhost, the header indicates that source is already included, avoiding a recursive release-download link.
4. **Representation behavior.** Geometry selects undeformed hierarchy/form; Structure selects the original structural display; Response selects existing response visualization. Returning to Geometry clears display deformation and stops tower animation. Case-specific coloring, region and visibility controls remain accessible. No solver setting is changed by selecting a representation.
5. **Concept traceability.** Supplied reference attachments are displayed consistently as thumbnails with enlargement dialogs. Original project reference assets are also retained.
6. **Software-rendering fallback.** The testing browser cannot create WebGL contexts. The bridge already had a fallback. Loop Towers and the pavilion now prefer WebGL but fall back to software projection of their existing Three scenes. Each retains its own Three version. The fallback reads scene transforms/geometry/materials only; it never accesses or changes models or solvers. It supports the towers' instanced members and existing response coloring. Software shading is approximate.
7. **Pavilion presentation and inspection.** Colors for arches, supports, weave and the existing ground surface were aligned with the shared palette. A numeric member selector reads existing connectivity/classification and axial-force results. Fit model invokes its original Perspective camera preset. There are no new physical elements, loads or calculations.
8. **Run/build compatibility.** A Vite entry builds the integrated static app. The original dependency versions and resolved lockfile entries are retained; only project metadata/scripts changed. Executable bits lost in ZIP extraction were restored on setup shell scripts. The local Python server serves the integrated `dist/` output. All root dev/build/preview aliases target the integrated Vite entry, including the portable aliases. The build generates the complete downloadable release in `dist/downloads/`, keeping generated archives out of source history.

## Numerical preservation

`validation/integration-report.json` records SHA-256 file comparisons and complete-result comparisons. All default generated model objects match the supplied JSON snapshots. All default and representative modified-control outputs exactly match the original modules in the same Node.js runtime:

- Bridge: baseline and deck pressure 2.5 kPa.
- Loop Towers: baseline and transverse wind at load multiplier 1.2.
- Pavilion: baseline and uplift pressure 450 Pa.

No tolerances, frame/cable assumptions, prestress definitions, constitutive laws, material values, supports or load cases were changed. No new capacity, wind-code or cross-case comparative claims are made.

## Rendering/test limits

The cloud browser has WebGL disabled, so GPU rendering could not be directly exercised. Software-rendered views and the original analysis pathways were exercised instead. Existing GPU scene construction remains intact. `validation/browser-checks.md` records the completed UI workflows and this limitation.

## Data authority

Default structural snapshots: `public/cases/{bridge,loop-towers,pavilion}/model.json`. Active experiments use their case-specific generated model and parameters; use the native exports to retain these conventions. Bridge GLB/STL and original validation outputs remain unchanged. No missing export format was synthesized.
