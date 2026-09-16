# Hybrid bridge — assumptions

1. Single-image interpretation: 120 m main span, 28 m rib crown, 14 m deck, and two 18 m level approach decks. Hidden structure is mirrored across the span center and transverse centerline.

2. The three V2 chord paths and original stations are preserved. Each twin arch is a built-up triangular frame: three hollow chords enclose 2.3 m of vertical centerline depth and 1.9 m of transverse centerline width. Chord outside diameter grades smoothly from 0.85 m at the ends to 1.05 m at the crown. These are assumed sections, not image measurements.

3. Rigid triangular diaphragms and face diagonals at 2 m arch stations stabilize each arch within its existing depth. The original internal diamond weave remains. The arch is analyzed as connected individual chords and braces, with no additional fictitious solid-band stiffness.

4. Four flared root fans extend from the rib ends to broad, discrete foundations 10 m below the deck. Each fan has multiple intersecting strand families with shared mesh nodes, and connects to deck edge girders.

5. The six original V2 side-web panel locations and hubs are retained. Each panel has twelve local spokes rather than six, two existing-scale capture bands with slight radial grading, and fine inter-ring strands. Additional radial branches use tertiary sections; central panels have less fine cross-weave than the shoulders. No global orb, large crescent or new motif is introduced.

6. A continuous 156 m deck surface joins the main span and two level approaches. The protected corridor is 12 m wide with 5 m reserved headroom; these are design assumptions, not regulatory compliance claims.

7. Structural floor members sit below the deck surface. Woven guardrails 1.35 m high run along both deck edges; guardrail meshes are visual nonstructural elements and have no verified vehicle-impact capacity.

8. Primary arches, arch-internal bracing, deck grillage and flared roots use elastic six-DOF frame elements. Side-web members, fine crown ties and under-deck cross ties use geometrically nonlinear, pin-ended, tension-only axial elements: no bending, torsion or compression capacity. Rotations at cable-only joints are omitted, not restrained by hidden supports.

9. Cable equivalent solid diameters are 35 mm radial, 22 mm capture strands and 14 mm fine weave. Assumed initial shortening corresponds to 80 MPa reference prestress by default. The solver first equilibrates this prestress against the frame, then applies the chosen loading; final tension may differ. Cable self-weight, sag between mesh nodes, material nonlinearity and frame large-rotation effects are omitted.

10. Only the root fan foundation nodes and remote approach bearing nodes are restrained. There are no hidden fixed supports at the central bridge deck ends. Foundation compliance and soil are omitted.

11. Assumed steel: E=200 GPa, nu=0.30, fy=355 MPa for frames and 1000 MPa tensile screening strength for equivalent cables. Primary scale controls arch chords/root spines/deck; secondary scale controls braces and cables. No connection or cable anchorage design is provided.

12. Deck pressure acts on the 120 m main span only, at tributary edge nodes; approach live load, self-weight, collision and dynamic effects are excluded. The walking surface distributes load but has no shell stiffness.

Cable equilibrium may leave slack patches with local free-motion modes. These are reported, not stiffened artificially. The supported frame skeleton is checked independently. Displacements are measured from the authored geometry and include prestress equilibration.
