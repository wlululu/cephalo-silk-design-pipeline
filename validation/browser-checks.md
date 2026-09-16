# Browser integration checks

Completed 10 September 2026 in the managed Chrome browser at a desktop viewport.

- All three case views render the existing 3D scenes with original concept thumbnails, shared representation/camera controls, right-side experiment panels and four response metrics. Screenshots were visually inspected.
- All three baseline analyses complete: Bridge 36.7 mm deck displacement / 8,400 kN reaction; Loop Towers 23.1 mm; Pavilion 139.5 mm.
- Geometry, Structure and Response modes, Front/Side/Top/Fit camera controls, and concept enlargement/close were exercised in every case.
- Bridge: axial response coloring, node-number inspection and deck pressure adjustment to 4.5 kPa were exercised. The modified solve converged, displaying 31.8 mm deck displacement and 7,560 kN vertical reaction.
- Loop Towers: transverse wind, stiffness and thickness slider changes, force coloring and animation were exercised. Returning to Geometry stopped display deformation. The changed experiment converged (80.6 mm in the tested combination).
- Pavilion: uplift, pressure/stiffness/size changes, axial coloring, load vectors and member-number inspection were exercised. The changed experiment converged (140.8 mm in the tested combination).

- Reset restored the pavilion baseline. Navigation from modified tower/bridge experiments opened the destination at its own baseline. Browser Back returned Loop Towers to gravity, load multiplier 1 and 23.1 mm, with no carried-over state.
- Model and Results export buttons were clicked in all three cases. No application errors were logged for the native-case export actions. Automated capture of downloaded bytes remains unverified as noted below.

## Testing limits

This browser cannot create WebGL contexts. Visual checks used software projection of the existing Three.js scenes. GPU shading/rendering and mobile-device behavior were not directly tested. The fallback does not change geometry or mechanics.

The browser automation download-event capture timed out. Export-button actions and their source pathways were inspected, but browser-downloaded bytes are not claimed as verified. Preserved static JSON, GLB/STL and validation files are independently covered by SHA-256 comparisons. The complete release ZIP is checked for archive integrity and required runnable files.

Numerical comparisons are recorded separately in `integration-report.json`: 31 unchanged files and six complete result matches (baseline plus representative parameter change for every case). These checks establish integration preservation, not new physical validation.
