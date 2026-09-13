# Nexus Signal staging preparation

Updated 2026-09-13. **NOT READY FOR STAGING**: local Docker/Linux image build and execution remain unverified because Docker is not installed. No staging resources have been created. Windows Python 3.11 checks are useful evidence, not a substitute for the requested container test.

## Configuration and Stripe

Set APP_ENV=staging and NODE_ENV=production on the backend. Explicit MONGODB_URI, STAGING_DB_NAME, JWT_SECRET, BROKERAGE_ENCRYPTION_KEY, CLIENT_URL, API_URL, ML_SERVICE_URL, ML_API_KEY and CORS_ALLOWED_ORIGINS are required. MONGO_URI must be unset. Startup validates settings before connecting to MongoDB and logs only enabled/disabled categories. Known production service destinations are rejected; no hostname check can prove that an arbitrary endpoint belongs to staging, so resource ownership must also be reviewed.

Default all five controls false: ENABLE_SCHEDULED_JOBS, ENABLE_NOTIFICATIONS, ENABLE_BILLING, ENABLE_BROKERAGE_SYNC, ENABLE_MEDIA_UPLOADS. Invalid boolean spellings fail. Production defaults remain enabled when APP_ENV explicitly identifies production; production will need the newly required configuration before any future rollout. Nothing has been rolled out.

All Stripe catalog variables are **STAGING/SANDBOX VALUE**:

| Tier | Backend monthly | Backend yearly |
|---|---|---|
| Starter | STRIPE_PRICE_STARTER_MONTHLY | STRIPE_PRICE_STARTER_YEARLY |
| Pro | STRIPE_PRICE_PRO_MONTHLY | STRIPE_PRICE_PRO_YEARLY |
| Premium | STRIPE_PRICE_PREMIUM_MONTHLY | STRIPE_PRICE_PREMIUM_YEARLY |
| Elite | STRIPE_PRICE_ELITE_MONTHLY | STRIPE_PRICE_ELITE_YEARLY |

Frontend names are the same eight names with REACT_APP_ prepended. Also configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, REACT_APP_STRIPE_PUBLIC_KEY only when opting into test billing, and set REACT_APP_ENABLE_BILLING=true. Catalogs must be complete and unique. Unknown/missing prices fail; there are no live defaults. Price IDs themselves do not encode live/test mode: the guarded backend requires test credentials outside production, so Stripe rejects prices belonging to a different mode/account. Webhook signatures and event.livemode must match. Checkout, upgrade, legacy payment routes and manual billing scripts use the central catalog/client. Production can supply its existing catalog through environment variables without source changes. No values were retrieved.

BROKERAGE_ENCRYPTION_KEY is **SAME AS PRODUCTION** by explicit user instruction: preserve its existing production value when configuring staging. Do not retrieve, print, rotate, regenerate or put its value in documentation. All other credentials must be staging-specific or unset. See STAGING-ENV-CHECKLIST.md for the source-linked inventory.

## Automatic work inventory

All backend database writes below use the connected MONGODB_URI. The application guard checks the explicit staging database name; it does not establish cluster isolation. A separate Atlas project/cluster/user is mandatory before enabling any work.

| Job | Trigger / starts automatically? | External effects and database writes | Staging default | Control |
|---|---|---|---|---|
| Alert checker | DB startup; every minute / 5 / 15 / 10 minutes; optional initial check | Market data; alert state; notifications | Off | ENABLE_SCHEDULED_JOBS; ENABLE_NOTIFICATIONS at delivery |
| Alert cleanup | Startup registers daily 03:00 cron | Deletes expired alert records | Off | ENABLE_SCHEDULED_JOBS |
| Prediction checker and statistics | DB startup; hourly, daily 02:00; optional initial check | Prices; prediction outcomes, statistics, gamification; notifications | Off | ENABLE_SCHEDULED_JOBS |
| Signal scanner/generator | DB startup; minute 30 hourly; initial 15-second timer | Market/ML requests; new signals in DB | Off | ENABLE_SCHEDULED_JOBS |
| Signal settlement | DB startup; every five minutes; initial 30-second timer | Market data; stop-loss/outcome DB updates; notifications | Off | ENABLE_SCHEDULED_JOBS |
| Price WebSockets and REST fallback | DB/index startup; reconnect timers; REST initial 10 seconds then every five seconds; subscriptions initial five seconds then five minutes | Alpaca/Binance and price providers; subscriptions, alert evaluation/delivery | Off; start is idempotent | ENABLE_SCHEDULED_JOBS |
| Discord schedules | Startup delayed initialization; economic five-minute, weekday 13:00 and daily 21:00 schedules | News/economic providers, Discord messages | Off; bot unavailable in staging | ENABLE_SCHEDULED_JOBS and ENABLE_NOTIFICATIONS; staging boundary |
| Telegram polling/recap | Startup bot; daily 21:00 recap; hourly counters and six-hour caches | Telegram polling/messages and DB reads | Off; bot unavailable in staging | Same two flags and staging boundary |
| Telegram scheduler helpers | Initializers register five-minute and weekday 13:00 jobs; not independently started by current boot path | Telegram/economic notifications | Off even if initializer called | Same two flags and staging boundary |
| X posts/approval bot | Startup daily 21:30 recap; hourly counters, six-hour caches | X/Telegram sends; PendingXPost approval records | Off; unavailable in staging | Same two flags and staging boundary |
| Email/SMS/push | Request or scheduled event; not independent workers | SendGrid/Twilio/web-push; real recipient risk | Off; only explicitly allowlisted email can opt in | ENABLE_NOTIFICATIONS; STAGING_EMAIL_RECIPIENTS |
| Plaid/account synchronization | Request and provider webhook, no independent cron found | Plaid reads/token exchange and DB connection/history updates | Off; sandbox only on opt-in | ENABLE_BROKERAGE_SYNC; PLAID_ENV=sandbox |
| Stripe subscriptions/webhook retries | User request/provider retries, no local retry worker | Stripe billing and subscription DB updates | Off; test mode only on opt-in | ENABLE_BILLING |
| Cloudinary uploads/deletes | User request | Remote media writes/deletes | Off | ENABLE_MEDIA_UPLOADS |
| SSE heartbeats | Connected client request starts heartbeat interval | Connection traffic; no autonomous DB writer | Request scoped; feed startup remains off | ENABLE_SCHEDULED_JOBS controls underlying price feed |
| Provider retry/cache timers | Invoked operations schedule retries/expiry | Repeat the original provider request; not independent startup jobs | Underlying service off where applicable | Scheduler/integration boundaries above |
| MongoDB TTL expiration/indexes | MongoDB/Mongoose-managed | Expiration/index changes in connected DB | Database behavior remains active | Isolated cluster/database/user, not application timer flags |
| ML training API | Authenticated request | Training data requests/model filesystem writes | Hard off in staging, even if runtime flag later changes | APP_ENV=staging; ML_ENABLE_TRAINING=false |
| Offline ML training/retraining scripts | Manual or external cron; no repository boot scheduler | Market requests/model writes; former automatic git push removed | Refuse staging and require explicit enablement | APP_ENV; ML_ENABLE_TRAINING |
| ML prediction/model cache | Request-driven, no refresh worker found | Prediction/provider requests, in-memory model cache and reads from trained_models | Allowed for isolated smoke tests | Explicit ML service credentials; absent models handled gracefully |

No separate Redis worker/queue, live order worker, automatic historical reconciliation, subscription cron or automatic model refresh loop was found. Manual maintenance scripts are not made safe merely by disabling startup jobs: do not run production repair, reconciliation, delete, billing or seeding scripts against staging without reviewing their explicit target and operation. Request-scoped public market reads remain possible and can consume provider quotas.

Staging rejects Telegram, Discord, X, Twilio and VAPID delivery credentials at startup. SendGrid opt-in requires a staging sender, key and exact recipient allowlist; all to/cc/bcc are checked before transport. Use only controlled test inboxes, including 2FA tests. Media opt-in requires an isolated Cloudinary account verified by the operator.

## Brokerage execution safety

Source review found portfolio/paper/copy ledger operations, Plaid synchronization and Kraken private reads, but no actual brokerage order submission/modification/cancellation implementation. No wallet sendTransaction/writeContract/signTransaction call was found in application source. No second TRADING_MODE mechanism was invented. Kraken private transport rejects every non-production call before Axios, and allowlists only Balance, TradesHistory and OpenOrders even in production. Regression tests assert the staging transport never reaches Axios and no order method is exported. Plaid requires sandbox outside production and signed staging webhooks. Never import production account records; do not configure production provider callbacks.

## Frontend dependency repair

Use Node 24 and **npm ci**, without legacy-peer-deps. Root postinstall runs a second locked strict npm ci --include=dev in tooling/. Both .npmrc files explicitly disable legacy peer mode. Build with **npm run build**. Validate both trees with **npm ls --all** and **npm ls --prefix tooling --all**; audit both roots as well.

The old Coinbase CDP Axios override required ^1.18.0 while its lock/install contained 1.16.0. Deliberate lock resolution corrects that discrepancy. The old top-level MetaMask SDK 0.26.5 did not satisfy the wagmi connector's ~0.33.1 peer. SDK now uses ~0.33.1. RainbowKit 2 requires wagmi ^2.9.0, not the previously installed wagmi 3.1.0; wagmi now uses ^2.19.5 with existing hooks/UI preserved. Unused direct React Native async-storage was removed: no app import exists, and the old SDK pulled incompatible mobile peers. This web application does not lose a used storage feature.

Explicit React 18 types avoid React 19 peer selection; Redux 5.0.1 satisfies Recharts while DnD retains its nested Redux 4. Application TypeScript ^5.7.3 satisfies wallet peers. CRA 5.0.1 only accepts TypeScript 3/4, so it is retained in an independent tooling install root with TypeScript 4.9.5, React 18.3.1 and YAML ^2.4.2. No React, router or build-tool migration was performed. The tooling launcher uses the existing CRA scripts. A trial npm workspace still reported cross-workspace override problems and was rejected. Independent roots enforce actual peer contracts instead of masking them. The WebSocket override is scoped to major 8, preserving major 7 consumers. Other original direct dependency ranges are preserved; resolved patch/minor lock changes follow those ranges.

Build settings: REACT_APP_ENV=staging, explicit matching HTTPS REACT_APP_API_URL and REACT_APP_API_BASE_URL ending /api, REACT_APP_ENABLE_BILLING=false, PUBLIC_URL=/. The build validator rejects missing hosted settings and known production API targets. Real staging URLs must replace local validation placeholders before any deploy. Frontend environment values are public. No secret belongs in them. Local API fallbacks now use localhost instead of production; hosted builds must pass validation.

Fresh audit and exact validation results are recorded in STAGING-VALIDATION.md. Do not compare only the application audit with the previous combined CRA tree: both current install roots must be counted. Transitive does not mean safe. Wallet/runtime moderate findings and the retained CRA chain require a separate production decision.

## ML runtime and Docker

Dockerfile is at repository root, based on python:3.11-slim. It installs gcc, g++ and libgomp1, then requirements.txt with pip. It copies application/models/utils/tests explicitly, creates /app/trained_models and runs as appuser. Production trained_models, .env files and node_modules are excluded. Startup is gunicorn on 0.0.0.0:5001 with two workers, four threads and 120-second timeout; /health is the health endpoint. Models are optional at startup and missing artifacts return the existing graceful unavailable behavior. Any future staging model volume must be separate and writable by appuser.

APP_ENV defaults staging in Docker; ML_ENABLE_TRAINING, ML_ALLOW_UNAUTHENTICATED and FLASK_DEBUG default false. Hosted startup requires ML_API_KEY and explicit CORS_ALLOWED_ORIGINS. Staging rejects training/debug/auth bypass and known production origins. Compose now uses GOOGLE_API_KEY, matching Python. No MongoDB client is used by ML.

Attempted docker version and docker build -t nexus-signal-ml:staging-validation .; both failed because docker is not installed. No image or Linux/gunicorn execution is claimed. A locally installed Python 3.11.16 environment installed the exact requirements and passed original regressions, syntax/import checks and new isolated startup/loopback health/missing-model tests. Outbound requests were blocked in the runtime smoke test and only synthetic test models were trained in temporary directories.

Required follow-up on a Docker-capable machine: build the image above, run its bundled unittest suite with disposable test-only settings and no credentials, then start the default gunicorn command with APP_ENV=staging, ML_API_KEY generated solely for this disposable check, and an explicit staging CORS origin. Do not mount production models or any .env file. Map only a loopback host port to 5001. Verify /health, authenticated model/info, missing-model responses, disabled training and container logs; remove that disposable container after verification. This is a remaining check, not completed work.

## Next phase: resources and runbook (not executed)

1. Finish Docker validation before deciding readiness. Review local commit IDs and current validation report.
2. Create a separate Atlas project/cluster with empty staging database and restricted new user; verify ownership/access independently. Set only MONGODB_URI with an explicit path matching STAGING_DB_NAME containing staging. Never copy historical production data or inherit MONGO_URI. There is no required data migration for an empty database; Mongoose may create collections/indexes. Review any optional seed-vault operation separately; do not seed real users or account records.
3. Backend Render service: Node 24, build npm ci --legacy-peer-deps, start npm start, health /health (returns 503 until MongoDB is connected). Configure explicit staging URLs/CORS and keep all five controls false. Do not point a shared production webhook at it.
4. ML Render Docker service: repository root Dockerfile, port 5001, explicit isolated settings, optional staging-only model disk. Prefer private networking with backend-to-ML API-key authentication. Verify actual health before enabling predictions; no model artifacts are required just to start.
5. Frontend static service: Node 24, build npm ci && npm run build, publish build/, SPA rewrite /* to /index.html. Configure explicit public staging API variables before the build. Retain install scripts so tooling lock is installed.
6. Smoke test anonymous/free/paid/admin accounts created only in staging. Verify 2FA, temporary-token restrictions, admin denials, paid signals, private predictions, model isolation, stop-loss outcomes and fee accounting. Check CORS and every frontend route against the staging API. Default-off integrations will intentionally make real delivery/billing/sync unavailable.
7. Only after isolation review, opt into one category at a time: allowlisted staging email for 2FA, Stripe test catalog/webhook, Plaid sandbox, isolated media, then jobs against staging data/providers. Recheck startup flags, provider destinations and DB identity after each change.

Rollback means stop the staging backend first (halts jobs), then staging ML; disable only staging/test webhook registrations and revert only staging artifacts/configuration to the recorded local revision. Preserve logs and the empty/test DB for investigation. Never roll back, delete or mutate production resources as part of this runbook.

## Production safety

Nothing pushed, merged or deployed. Production database and services were not contacted for validation or modified. No production secret was retrieved/rotated; no real trade or Stripe charge was performed. Local package-registry downloads and offline/mock/loopback validation are the only external/local test activity. These local commits are not authorization to deploy them to production.
