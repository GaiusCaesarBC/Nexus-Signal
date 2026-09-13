# Final local validation — 2026-09-13

Status: **NOT READY FOR STAGING**. Docker is unavailable; the Python 3.11 Linux container has not been built or run. No infrastructure was created or deployed.

## Results

| Repository/check | Result |
|---|---|
| Backend npm test | 21/21 PASS, 0 failures (original 13 plus eight staging tests) |
| Backend JavaScript syntax | 189/189 PASS, 0 failures |
| Backend fresh npm audit | 0 total / critical / high / moderate / low |
| Frontend npm ci | PASS, strict peers; postinstall also performs locked tooling npm ci |
| Frontend npm ls --all | PASS, exit 0 |
| Frontend npm ls --prefix tooling --all | PASS, exit 0 |
| Frontend npm test -- --watchAll=false --runInBand, CI=true | 8/8 PASS across three suites, 0 failures (original six plus two configuration tests) |
| Frontend npm run build on Node 24.19.0 / npm 11.17.0 | PASS; warnings remain for bundle size/deprecated tooling; build used staging-api.invalid placeholders and is not a deployable configured artifact |
| ML unittest discovery on Python 3.11.16 | 11/11 PASS, 0 failures (original eight plus three runtime-safety tests) |
| ML Python syntax / imports | 11/11 PASS / 7/7 PASS |
| ML isolated loopback /health | PASS, HTTP 200; empty model directory; outbound provider requests blocked |
| ML authenticated model info / missing models / training refusal | PASS; missing real models handled gracefully |
| ML Docker image build | BLOCKED: docker command not installed |
| ML Linux gunicorn startup / container health | NOT RUN; Windows Werkzeug smoke is not container verification |

Backend suites cover 2FA and temporary-token restrictions, admin/paid/private authorization, login routes/rate limits, signal stop-loss and backtest accounting, plus Stripe, scheduler, brokerage, email and media boundaries. Frontend retains ProtectedRoute and signal-model regressions. ML retains isolation, artifact separation, training-data leakage and authentication regressions. The earlier ad-hoc nexus-audit/checks scripts target old *-main snapshots and are diagnostic probes, not the current regression suites; they were not treated as validation of the repaired repositories.

Evidence files live in C:/Users/2cody/source/repos/nexus-audit/: phase2-backend-tests.log, phase2-backend-audit.json, phase2-frontend-ci.log, phase2-final-root-tree.txt, phase2-final-tooling-tree.txt, phase2-frontend-tests.log, phase2-frontend-build.log, phase2-frontend-audit.json, phase2-tooling-audit.json, phase2-ml-final.log and phase2-ml-check.log. These logs contain no production credentials. Intermediate dependency-resolution failures are retained separately; the final commands above passed.

## Fresh frontend advisory accounting

| Install root | Total affected package entries | Critical | High | Moderate | Low |
|---|---:|---:|---:|---:|---:|
| Application | 27 | 0 | 3 | 24 | 0 |
| Independent CRA tooling | 13 | 0 | 8 | 5 | 0 |
| Sum across both install roots | 40 | 0 | 11 | 29 | 0 |

These are npm affected-package counts, not 40 unique CVEs; inherited/meta-vulnerabilities and names across roots may overlap. The previous 27/12-high count came from a different combined dependency tree and must not be compared only to the new application count. No npm audit fix --force was used. The vulnerable WebSocket 8 instance was deliberately patched; version-scoped overrides preserve WebSocket 7 consumers. The remaining high entries are all tooling dependencies, but they are not assumed safe just because they are transitive.

## Every remaining HIGH entry

| Package/version | Chain; direct/transitive | Exposure and reachability evidence | Fix/migration and production decision |
|---|---|---|---|
| puppeteer-core 24.43.1 | Direct dev dependency -> @puppeteer/browsers -> extract-zip | Manual scripts/generate-og-image.js launches installed Chrome; not imported by application source or standard build. Archive extraction not invoked in that script. | npm offers major 25.10.0; validate image-generation script on that major separately. Does not independently block static staging; production build exception only while untrusted archives/downloads are excluded. |
| @puppeteer/browsers 2.13.2 | Transitive through puppeteer-core | Same archive-extraction chain; build/developer host exposure, not browser runtime | Same Puppeteer major migration; same conditional production decision. |
| extract-zip 2.0.1 | Transitive through @puppeteer/browsers | Malicious archive symlink can write outside target; no app extraction path found | No patched extract-zip release listed for current advisory; replace chain via offered Puppeteer major. Treat archive ingestion as production/build blocker if introduced. |
| react-scripts 5.0.1 | Direct in tooling root; parent of SVGR/Workbox/CSS/dev-server chains | Build/development tool. Static deployment must publish build/ only, never expose the dev server | npm suggests react-scripts 0.0.0, not a viable repair. Requires a supported build-tool/plugin migration or carefully tested targeted replacements. Production tooling exception/review required; no browser-runtime high established by this parent entry. |
| @svgr/webpack 5.5.0 | react-scripts -> @svgr/webpack -> plugin-svgo -> svgo; transitive | Build-time SVG transformation; no server-side user upload sanitization with SVGO found | Modern compatible SVGR/SVGO configuration requires migration beyond CRA's pinned chain. Accept only trusted repository SVG inputs; untrusted SVG ingestion blocks production pending sanitization. |
| @svgr/plugin-svgo 5.5.0 | Transitive through @svgr/webpack | Same SVG transformation exposure | Same migration and production condition. |
| svgo 1.3.2 | Transitive through @svgr/plugin-svgo | removeScripts bypasses can preserve executable content. Optimizing an SVG is not a sanitizer. Runtime app does not import this package | Fix line >=2.8.4 for these advisories; forcing major into SVGR 5 is not a verified compatible fix. Upgrade SVGR/toolchain with tests. Separate postcss-svgo SVGO 2.8.4 is already patched. |
| workbox-webpack-plugin 6.6.0 | react-scripts -> workbox-webpack-plugin -> workbox-build; transitive | Build-only; no serviceWorkerRegistration invocation found in source | New compatible Workbox/toolchain removes old Terser plugin chain. Production exception requires trusted build inputs and no exposed build execution. |
| workbox-build 6.6.0 | Transitive through workbox-webpack-plugin -> rollup-plugin-terser | Build-only service-worker generation machinery | Same Workbox/toolchain migration and condition. |
| rollup-plugin-terser 7.0.2 | Transitive through workbox-build -> serialize-javascript 4.0.0 | Build worker serialization; old deprecated plugin | Replace with maintained compatible Terser plugin through toolchain migration; do not blindly override serialization across major contracts. |
| serialize-javascript 4.0.0 and 6.0.2 | Transitive via rollup-plugin-terser and css-minimizer-webpack-plugin | Build-time serialization can allow code injection via malicious object methods; CSS minification remains on normal build path. No runtime app import found; malicious build inputs remain a supply-chain risk | >=7.0.3 fixes listed RCE, >=7.0.5 also addresses listed CPU DoS. Consumers require compatibility work. Production build must not serialize attacker-controlled objects; exception or migration required. |

Advisory primary records: [extract-zip arbitrary writes](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3), [SVGO executable links](https://github.com/advisories/GHSA-w27v-7q3p-w38r), [serialize-javascript RCE](https://github.com/advisories/GHSA-5c6j-r48x-rmvq), [serialize-javascript CPU exhaustion](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v). Versions/chains/fix suggestions above are from the fresh local npm audit and both committed lockfiles. Reachability assessments are source-review inferences, not proof that arbitrary future inputs are safe.

Wallet/router moderate findings remain in the runtime graph and must not be described as build-only. They need separate production triage. This task establishes staging install consistency, not a blanket production security approval. None of these retained tooling findings independently blocks isolated static staging under the restrictions above; Docker validation is the remaining code/runtime gate.

## Local revisions and changed files

See STAGING-CHANGES.md for exact absolute paths grouped by repository and the tested source commit IDs. The documentation commit that contains that manifest is reported in the task response; a commit cannot embed its own SHA without changing it.
