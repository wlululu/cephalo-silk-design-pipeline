# Standalone conversion notes

## Outcome and scope

The standalone application is based on integrated source commit `523c18f3865e67b5485ae05d40b70b4378d42b7f`, including the approved Cephalo-Silk interface title. It runs as a conventional Vite/React/browser application. No ChatGPT account, OpenAI runtime, private package registry, server-side application, database, or original hosting service is required. The existing hosted website was not redeployed or modified.

The public LAMM repository and GitHub Pages workflow are **prepared, not published**. The user can choose the repository name without editing asset paths. Production output is `dist/`; the same build was tested at both `/` and `/cephalo-structural-lab/`.

## Compatibility changes

- Replaced both the unused server-oriented Vite configuration and the active lab-specific build configuration with one standard `vite.config.ts`. Relative build assets (`base: './'`) support root and repository-path hosting.
- Added `shared/assetUrl.ts`; changed only asset/download/iframe/worker URL construction in the platform and bridge UI. No model generation, control parameters, analysis scheduling, state-reset logic, rendering geometry or solver logic changed. Removed the bridge component's unused `__PORTABLE__` flag.
- Changed each native case's source-download URL to `../../downloads/...`. Native app, model, solver, worker, event handlers, geometry, styles and bundled Three libraries are unchanged.
- Removed unused ChatGPT auth helpers, Sites hosting manifest/plugin and execution wrappers, Cloudflare/D1 examples and database tooling, and unused Next/Vinext server scaffolding. These were not used by the integrated client-side cases.
- Replaced Python-dependent source packaging and test archive extraction with Node plus `fflate` 0.8.2. The test writes new evidence into `test-output/` instead of replacing the original `validation/integration-report.json`. Source ZIPs are non-recursive; prebuilt files are delivered separately within the outer release.
- Added a dependency-free optional Node static server, preservation/static tests, relative-URL checks, `.nojekyll`, `.nvmrc`, and a GitHub Actions Pages build/test/deploy workflow.
- All retained application dependency versions are unchanged. Only the archive utility `fflate` moved from an indirect 0.7.4 installation to a direct development dependency at 0.8.2. The lockfile resolves exclusively against `registry.npmjs.org`.
- The historical original research archives, case documentation and validation manifests may still mention their original tooling. They remain byte-identical evidence and are not imported as deployment code. Historical research scripts remain records; the supported standalone verification command is `npm test`.

## Dependencies removed from the active package manifest and lockfile

| Package | Previous specification |
|---|---|
| `@cloudflare/vite-plugin` | `1.37.1` |
| `@cloudflare/workers-types` | `4.20260515.1` |
| `@vitejs/plugin-rsc` | `0.5.26` |
| `drizzle-kit` | `0.31.10` |
| `drizzle-orm` | `0.45.2` |
| `eslint` | `9.39.4` |
| `eslint-config-next` | `16.2.6` |
| `next` | `16.2.6` |
| `react-server-dom-webpack` | `19.2.6` |
| `vinext` | `1.0.0-beta.5` |
| `wrangler` | `4.92.0` |

The vendored `build/sites-vite-plugin.ts` (the Sites plugin) and its license were removed with that unused integration. Public React UI libraries, Tailwind styles, Three.js and the original vendored case libraries remain. `next-themes` is a generic React theme utility retained with the UI components; it does not require Next.js, authentication, or hosted services.

## Commands tested

| Command | Result |
|---|---|
| `node --version` / `npm --version` | Node v24.19.0 / npm 11.9.0 |
| `npm install` | Pass; 223 packages installed |
| `npm ci` | Pass; clean lockfile installation |
| `npm run dev` | Pass; HTTP 200 and correct title at `http://127.0.0.1:5173/` |
| `npm run build` | Pass; standard static output in `dist/` plus source download and copied validation records |
| `npm run preview` | Pass; HTTP 200 and correct title at `http://127.0.0.1:4173/` |
| `npm run test:preservation` | Pass; 102 protected files byte-identical |
| `npm run test:integration` | Pass; every full baseline and representative control-change result exactly matches |
| `npm run test:static` | Pass at `/` and `/cephalo-structural-lab/`; all 61 public assets/records, worker MIME types, source archive and validation results checked |
| `npm test` | Pass; all three test suites in sequence |
| `node scripts/serve-static.mjs 4173 /cephalo-structural-lab/ 0.0.0.0` | Pass; production browser checks under a repository path |

Normal user URLs are **http://localhost:5173/** for development, **http://localhost:4173/** for Vite preview, and **http://localhost:8000/** for the optional Node static server. `127.0.0.1` is the equivalent tested loopback address. Production deployment publishes the contents of `dist/`.

The initial attempt to expose Vite directly on `0.0.0.0` hit this execution environment's restricted network-interface syscall; normal loopback dev/preview commands passed. Remote browser access required the environment's existing preview transport (`sites-preview start` / `sites-preview stop`), used only for testing. During startup a temporary local dev-command override invoked the standalone static server, then the original package file was restored before final builds. No preview transport code, credential, private hostname, runtime profile or configuration is shipped in the application. This limitation does not affect the tested standalone loopback or Node static-server paths.

The build emits the existing large-JavaScript-chunk advisory (Three.js plus the bridge app, approximately 936 kB before gzip). No code splitting or rendering changes were introduced for this deployment task. npm also printed an environment-level `http-proxy` configuration warning; this setting is not present in the shipped `.npmrc`.

## Scientific preservation evidence

All 102 entries in `reproducibility/preserved-files.json` match the integrated source bytes. This covers scientific sources, authoritative JSON, solver modules and workers, rendering geometry, shared styles/rendering adapters, original archives, results and every existing validation file. The small bridge UI and native entry files excluded from that manifest changed only as explicitly listed above.

| Case | Full baseline / perturbed result comparison | Baseline maximum displacement | Node relative residual |
|---|---|---|---|
| Bridge | Exact / exact | 76.8779380859019 mm all nodes; 36.74593686122058 mm deck | 4.52837511751583e-13 |
| Loop Towers | Exact / exact | 23.095865369389422 mm | 8.311376212620624e-9 |
| Woven-Wing Pavilion | Exact / exact | 139.4686375173227 mm | 8.333677045218403e-8 |

Representative original-versus-standalone solver checks use bridge pressure 2.5 kPa, towers transverse wind with load factor 1.2, and pavilion Uplift at 450 Pa. Full result objects, not just the table's displacement values, are compared. No numerical result was edited to achieve these matches. This is a deployment-equivalence check; the completed physics study was preserved and not rerun or reclassified.

## Browser coverage

All three original-concept thumbnails and geometry views loaded under the repository prefix. Each case's parameter control triggered its existing solver and produced a converged result. Geometry/Structure/Response modes, representative Front/Fit camera controls and response color legends were exercised. Returning to each case restored its own baseline parameter values and results, without inheriting the previous case's state.

| Case | Browser parameter change | Observed response after recalculation |
|---|---|---|
| Bridge | Pressure 5 → 4.5 kPa | Deck displacement 36.7 → 31.8 mm; reaction 8,400 → 7,560 kN; Converged |
| Loop Towers | Load multiplier 1 → 1.1 | Displacement 23.1 → 25.4 mm; peak axial force 10,020 → 11,022 kN; 34/46 cables slack; Converged |
| Pavilion | Pressure 300 → 325 Pa | Displacement 139.5 → 151.1 mm; resultant 177.0 → 191.8 kN; Converged |

These browser values are rounded UI readings, separate from the exact programmatic comparisons. Tower residuals differ slightly between browser and Node engines, as before; full equivalence was established within the same Node runtime. Browser WebGL is disabled in this environment, so visual checks used the **existing software-rendering fallback**. GPU rasterization was not directly verified. Expected WebGL-creation errors and browser-extension metadata errors were observed; the cases and their solvers completed successfully. Browser download bytes were not captured; original assets and source-download bytes were checked by the static tests.

Evidence: `reproducibility/verification/integration-report.json`, `static-report.json`, `local-server-checks.json`, and `browser-checks.json`. No hosted GitHub Actions run was executed because no destination repository was supplied; deployment compatibility was tested locally with the same static path structure.

## Complete source-file change inventory

The inventory compares the standalone source against the exact integrated source commit above. Generated `node_modules/`, `dist/` and `test-output/` are excluded. Every source file modified, added or removed is listed here and in `reproducibility/file-changes.json`.

### Modified / replaced

- `.gitignore`
- `README.md`
- `cases/bridge/BridgeCase.tsx`
- `main.tsx`
- `package-lock.json`
- `package.json`
- `public/cases/loop-towers/entry.js`
- `public/cases/pavilion/entry.js`
- `shared/ConceptCard.tsx`
- `shared/Platform.tsx`
- `tests/integration.mjs`
- `tsconfig.json`
- `vite.config.ts`

### Removed

- `.openai/hosting.json`
- `app/chatgpt-auth.ts`
- `app/layout.tsx`
- `build/sites-vite-plugin.LICENSE`
- `build/sites-vite-plugin.ts`
- `cloudflare-env.d.ts`
- `db/index.ts`
- `db/schema.ts`
- `drizzle.config.ts`
- `drizzle/meta/_journal.json`
- `eslint.config.mjs`
- `examples/d1/app/api/notes/route.ts`
- `examples/d1/db/schema.ts`
- `next.config.ts`
- `portable/index.html`
- `portable/main.tsx`
- `scripts/build-verified.sh`
- `scripts/execution-profile.mjs`
- `scripts/install-ci.mjs`
- `scripts/install-ci.sh`
- `scripts/package-project.py`
- `scripts/package-release.py`
- `scripts/run-framework.mjs`
- `scripts/sites-env.mjs`
- `scripts/sites-env.sh`
- `vite.lab.config.ts`
- `vite.portable.config.ts`

### Added

- `.github/workflows/pages.yml`
- `.nvmrc`
- `CONVERSION_NOTES.md`
- `public/.nojekyll`
- `reproducibility/file-changes.json`
- `reproducibility/preserved-files.json`
- `reproducibility/verification/browser-checks.json`
- `reproducibility/verification/integration-report.json`
- `reproducibility/verification/local-server-checks.json`
- `reproducibility/verification/static-report.json`
- `scripts/package-research.mjs`
- `scripts/serve-static.mjs`
- `shared/assetUrl.ts`
- `tests/preservation.mjs`
- `tests/static.mjs`

