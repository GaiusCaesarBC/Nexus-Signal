# Staging environment checklist

Updated 2026-09-13 America/New_York. Names and safe configuration instructions only; no deployed secret files were read. This is a code inventory, not confirmation that any Render variable is configured.

**Status: NOT READY FOR STAGING.** The only unvalidated runtime target is Docker/Linux; see STAGING-DEPLOYMENT.md for exact results. No secrets were rotated. All credentials must be staging-specific except the brokerage encryption key expressly required below. Frontend build variables are public. New settings and controls are listed explicitly below.

## Backend

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific AI calls; staging account with spending limit. | `.env.example:18`, `routes/chatRoutes.js:12`, `routes/marketReportsRoutes.js:12` |
| `API_URL` | Backend | STAGING SERVICE URL | Staging backend origin WITHOUT /api; internal Discord calls append paths. | `.env.example:5`, `services/discordService.js:263`, `services/discordService.js:699` (and other consumers) |
| `APP_ENV` | Backend / ML | STAGING/SANDBOX VALUE | staging. Backend hosted startup requires an explicit environment and NODE_ENV=production; ML Docker defaults staging. | runtimeSafety.js / .env.example |
| `CLIENT_URL` | Backend | STAGING SERVICE URL | REQUIRED staging frontend HTTPS origin, without /api; Stripe success/cancel/portal redirects. | `.env.example:86`, `routes/paymentRoutes.js:50` |
| `CORS_ALLOWED_ORIGINS` | Backend | STAGING SERVICE URL | Exact staging origins, comma-separated; no wildcard. Production origins are no longer implicitly allowed. | `.env.example:3`, `app.js:736`, `config/runtimeSafety.js:69` (and other consumers) |
| `ENABLE_BILLING` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Opt-in requires test secret, webhook secret and all eight configured prices. Every Stripe client operation rechecks this boundary. | runtimeSafety.js / .env.example |
| `ENABLE_MEDIA_UPLOADS` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Gates Cloudinary uploader methods including upload streams and deletes. Enable only with an isolated staging Cloudinary account. | runtimeSafety.js / .env.example |
| `ENABLE_NOTIFICATIONS` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Staging opt-in permits allowlisted SendGrid email only; bots, SMS and push remain blocked. | runtimeSafety.js / .env.example |
| `ENABLE_SCHEDULED_JOBS` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Controls all scanner/checker/scheduler starts and websocket startup. Opt in only after DB/provider isolation. | runtimeSafety.js / .env.example |
| `LOG_TO_FILE` | Backend | STAGING/SANDBOX VALUE | false; use stdout on Render. | `utils/logger.js:71` |
| `LOGS_DIR` | Backend | OPTIONAL | Only with file logging; do not share production log storage. | `utils/logger.js:72` |
| `NODE_ENV` | Backend | STAGING/SANDBOX VALUE | Use production for HTTPS secure cookies and production behavior; this does not isolate integrations. | `.env.example:2`, `app.js:15`, `app.js:745` (and other consumers) |
| `OPENAI_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific AI calls; staging project with spending limit. | `.env.example:19`, `routes/aiInsightsRoutes.js:26` |
| `PORT` | Backend | STAGING/SANDBOX VALUE | Backend: Render-assigned port (fallback 5000). ML Docker listens at 5001; set PORT=5001 for consistency. | `.env.example:4`, `index.js:12`, `index.js:13` (and other consumers) |
| `SNOWTRACE_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:64`, `routes/walletRoutes.js:40` |
| `STAGING_DB_NAME` | Backend | STAGING/SANDBOX VALUE | nexus_signal_staging proposed. URI path must match exactly and contain staging; operator must separately verify isolated Atlas project/cluster/user. | runtimeSafety.js / .env.example |
| `TWITTER_BEARER_TOKEN` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/twitterSentimentService.js:10` |

## Frontend

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `CHROME_PATH` | Frontend | OPTIONAL | Local OG-image utility only; not needed for Render build. | `scripts/generate-og-image.js:12` |
| `NODE_ENV` | Frontend | STAGING/SANDBOX VALUE | Use production for HTTPS secure cookies and production behavior; this does not isolate integrations. | `src/components/ErrorBoundary.js:180`, `src/components/TradingChart/TradingChart.js:632` |
| `PUBLIC_URL` | Frontend | UNKNOWN — NEEDS REVIEW | Review source consumer before configuring. | `.env.example:16` |
| `REACT_APP_API_BASE_URL` | Frontend | STAGING SERVICE URL | Set equal to REACT_APP_API_URL at build time for legacy consumers. | `.env.example:15`, `src/components/AIChatWidget.js:18`, `src/components/SignalNotification.js:10` (and other consumers) |
| `REACT_APP_API_URL` | Frontend | STAGING SERVICE URL | REQUIRED at build time: staging backend HTTPS origin + /api. Old duplicate-/api consumers now normalize the suffix; verify deployed route smoke tests. | `.env.example:2`, `src/api/axios.js:42`, `src/api/axios.js:43` (and other consumers) |
| `REACT_APP_ENABLE_BILLING` | Frontend | STAGING/SANDBOX VALUE | false default. true requires test publishable key and complete unique catalog at build time. | runtimeSafety.js / .env.example |
| `REACT_APP_ENV` | Frontend | STAGING/SANDBOX VALUE | staging; build rejects missing environment, missing service URLs and known production API destinations. | runtimeSafety.js / .env.example |
| `REACT_APP_GA_TRACKING_ID` | Frontend | UNKNOWN — NEEDS REVIEW | Example/Compose-only name, no matching runtime consumer found. Do not provision blindly. See actual runtime names and per-user Kraken storage. | `.env.example:11` |
| `REACT_APP_WALLETCONNECT_PROJECT_ID` | Frontend | OPTIONAL | Omit for initial staging. If enabled use a staging project/origin and unfunded test wallet; current chain list is mainnet, not testnets. Omission is not an injected-wallet kill switch. | `.env.example:8`, `src/config/wagmi.js:17`, `src/index.js:23` |

## ML service

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `APP_ENV` | Backend / ML | STAGING/SANDBOX VALUE | staging. Backend hosted startup requires an explicit environment and NODE_ENV=production; ML Docker defaults staging. | runtimeSafety.js / .env.example |
| `CORS_ALLOWED_ORIGINS` | ML service | STAGING SERVICE URL | Exact staging origins, comma-separated; no wildcard. Production origins are no longer implicitly allowed. | `.env.example:5`, `app.py:30`, `app.py:32` (and other consumers) |
| `FLASK_DEBUG` | ML service | STAGING/SANDBOX VALUE | false. Docker runs gunicorn, not Flask debug server. | `.env.example:17`, `app.py:28`, `app.py:511` |
| `FLASK_ENV` | ML service | STAGING/SANDBOX VALUE | production; application auth explicitly checks this. | `.env.example:3`, `app.py:23`, `app.py:44` (and other consumers) |
| `GOOGLE_API_KEY` | ML service | NEW STAGING SECRET | Optional Gemini insights key; examples and Compose now use the correct GOOGLE_API_KEY name. | `.env.example:13`, `docker-compose.yml:20`, `utils/ai_insights.py:12` |
| `ML_ALLOW_UNAUTHENTICATED` | ML service | STAGING/SANDBOX VALUE | false. Keep API authentication mandatory. | `.env.example:9`, `app.py:28`, `app.py:43` |
| `ML_API_KEY` | Backend | NEW STAGING SECRET | REQUIRED shared only between staging backend and staging ML; never expose in REACT_APP variables. | `.env.example:32`, `config/runtimeSafety.js:68`, `routes/predictionsRoutes.js:282` (and other consumers) |
| `ML_API_KEY` | ML service | NEW STAGING SECRET | REQUIRED shared only between staging backend and staging ML; never expose in REACT_APP variables. | `.env.example:2`, `app.py:42`, `docker-compose.yml:19` (and other consumers) |
| `ML_ENABLE_TRAINING` | ML service | STAGING/SANDBOX VALUE | false. Staging serving API rejects true at startup and forbids training routes regardless of later changes. | `.env.example:8`, `app.py:26`, `app.py:66` (and other consumers) |
| `ML_SERVICE_URL` | Backend | STAGING SERVICE URL | REQUIRED explicit staging ML origin, without /api or trailing slash. No production fallback remains. | `.env.example:31`, `controllers/cryptoController.js:15`, `routes/predictionsRoutes.js:281` (and other consumers) |
| `PORT` | ML service | STAGING/SANDBOX VALUE | Backend: Render-assigned port (fallback 5000). ML Docker listens at 5001; set PORT=5001 for consistency. | `.env.example:4`, `app.py:510` |

## Database

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `MONGO_URI` | Backend | NEW STAGING SECRET | UNSET for hosted startup: validateRuntime rejects this inherited alias. Manual legacy scripts must never inherit it. | `config/db.js:5`, `config/runtimeSafety.js:66`, `scripts/debugUserData.js:10` (and other consumers) |
| `MONGODB_URI` | Backend | NEW STAGING SECRET | REQUIRED. Credential-bearing URI for a new, empty staging-only MongoDB database and restricted database user. app.js uses this name. | `.env.example:8`, `app.js:16`, `app.js:418` (and other consumers) |

## Authentication

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `ADMIN_USER_IDS` | Backend | STAGING/SANDBOX VALUE | Only test admin IDs from the new staging database. | `.env.example:78`, `middleware/adminMiddleware.js:3`, `tests/security.test.js:39` (and other consumers) |
| `API_KEY_SECRET` | Backend | NEW STAGING SECRET | Recommended staging HMAC key for API keys; falls back to JWT_SECRET if absent. | `routes/apibacktestRoutes.js:66` |
| `JWT_SECRET` | Backend | NEW STAGING SECRET | REQUIRED independent staging signing key; rejects production tokens. | `.env.example:11`, `middleware/authMiddleware.js:15`, `routes/apibacktestRoutes.js:66` (and other consumers) |
| `X_API_KEY_SECRET` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/xPosterService.js:26`, `services/xPosterService.js:72` |

## Brokerage integrations

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `BROKERAGE_ENCRYPTION_KEY` | Backend | SAME AS PRODUCTION SECRET | Preserve existing production value when configuring staging. Never generate a replacement, display it, or copy it into documentation. | `.env.example:82`, `models/BrokerageConnection.js:7` |
| `ENABLE_BROKERAGE_SYNC` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Staging opt-in permits Plaid sandbox only. Private Kraken remains forbidden in staging. | runtimeSafety.js / .env.example |
| `KRAKEN_API_KEY` | Backend | UNKNOWN — NEEDS REVIEW | Example/Compose-only name, no matching runtime consumer found. Do not provision blindly. See actual runtime names and per-user Kraken storage. | `.env.example:55` |
| `KRAKEN_PRIVATE_KEY` | Backend | UNKNOWN — NEEDS REVIEW | Example/Compose-only name, no matching runtime consumer found. Do not provision blindly. See actual runtime names and per-user Kraken storage. | `.env.example:56` |

## Plaid

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `PLAID_CLIENT_ID` | Backend | STAGING/SANDBOX VALUE | Staging/sandbox application identifier. | `.env.example:50`, `services/plaidService.js:99` |
| `PLAID_ENV` | Backend | STAGING/SANDBOX VALUE | Explicit sandbox; never production. | `.env.example:52`, `app.js:324`, `config/runtimeSafety.js:21` (and other consumers) |
| `PLAID_REDIRECT_URI` | Backend | STAGING SERVICE URL | Approved staging redirect URI registered with Plaid. | `services/plaidService.js:139`, `services/plaidService.js:140` |
| `PLAID_SECRET` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:51`, `services/plaidService.js:100` |
| `PLAID_WEBHOOK_URL` | Backend | STAGING SERVICE URL | Staging backend /api/brokerage/plaid/webhook; staging now requires signatures. ENABLE_BROKERAGE_SYNC defaults false. | `services/plaidService.js:133`, `services/plaidService.js:134` |

## Stripe

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `REACT_APP_STRIPE_PRICE_ELITE_MONTHLY` | Frontend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `.env.example:23`, `src/config/stripePrices.js:5` |
| `REACT_APP_STRIPE_PRICE_ELITE_YEARLY` | Frontend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `.env.example:24`, `src/config/stripePrices.js:5` |
| `REACT_APP_STRIPE_PRICE_PREMIUM_MONTHLY` | Frontend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `.env.example:21`, `src/config/stripePrices.js:4` |
| `REACT_APP_STRIPE_PRICE_PREMIUM_YEARLY` | Frontend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `.env.example:22`, `src/config/stripePrices.js:4` |
| `REACT_APP_STRIPE_PRICE_PRO_MONTHLY` | Frontend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `.env.example:19`, `src/config/stripePrices.js:3` |
| `REACT_APP_STRIPE_PRICE_PRO_YEARLY` | Frontend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `.env.example:20`, `src/config/stripePrices.js:3` |
| `REACT_APP_STRIPE_PRICE_STARTER_MONTHLY` | Frontend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `.env.example:17`, `src/config/stripePrices.js:2` |
| `REACT_APP_STRIPE_PRICE_STARTER_YEARLY` | Frontend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `.env.example:18`, `src/config/stripePrices.js:2` |
| `REACT_APP_STRIPE_PUBLIC_KEY` | Frontend | STAGING/SANDBOX VALUE | Public Stripe TEST publishable key. Used only with REACT_APP_ENABLE_BILLING=true and complete build-time catalog. | `.env.example:5`, `src/context/StripeContext.js:5` |
| `STRIPE_PRICE_ELITE_MONTHLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. | runtimeSafety.js / .env.example |
| `STRIPE_PRICE_ELITE_YEARLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. | runtimeSafety.js / .env.example |
| `STRIPE_PRICE_PREMIUM_MONTHLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. | runtimeSafety.js / .env.example |
| `STRIPE_PRICE_PREMIUM_YEARLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. | runtimeSafety.js / .env.example |
| `STRIPE_PRICE_PRO` | Backend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `app.js:581` |
| `STRIPE_PRICE_PRO_MONTHLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. | runtimeSafety.js / .env.example |
| `STRIPE_PRICE_PRO_YEARLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. | runtimeSafety.js / .env.example |
| `STRIPE_PRICE_STARTER` | Backend | STAGING/SANDBOX VALUE | Matching Stripe TEST catalog price ID; configure all eight tier/interval names when billing is enabled. No live fallback. | `app.js:580` |
| `STRIPE_PRICE_STARTER_MONTHLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. | runtimeSafety.js / .env.example |
| `STRIPE_PRICE_STARTER_YEARLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. | runtimeSafety.js / .env.example |
| `STRIPE_SECRET_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:14`, `config/runtimeSafety.js:19`, `config/runtimeSafety.js:79` (and other consumers) |
| `STRIPE_WEBHOOK_SECRET` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:15`, `app.js:202`, `app.js:210` (and other consumers) |

## Email

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `EMAIL_FROM` | Backend | STAGING/SANDBOX VALUE | Required verified staging sender when email is enabled; recipients must be in STAGING_EMAIL_RECIPIENTS. | `.env.example:93`, `services/emailService.js:10`, `test-email.js:9` |
| `SENDGRID_API_KEY` | Backend | NEW STAGING SECRET | Needed for email 2FA tests; separate restricted sender/account and controlled test recipients. Missing key makes email 2FA fail. Staging also requires ENABLE_NOTIFICATIONS=true, EMAIL_FROM and STAGING_EMAIL_RECIPIENTS allowlist. | `.env.example:22`, `services/emailService.js:6`, `services/emailService.js:7` (and other consumers) |
| `SENDGRID_FROM_EMAIL` | Backend | UNKNOWN — NEEDS REVIEW | Example/Compose-only name, no matching runtime consumer found. Do not provision blindly. See actual runtime names and per-user Kraken storage. | `.env.example:23` |
| `STAGING_EMAIL_RECIPIENTS` | Backend | STAGING/SANDBOX VALUE | Comma-separated exact controlled email addresses; all to/cc/bcc must match before SendGrid is called. No production user list. | runtimeSafety.js / .env.example |
| `TWILIO_ACCOUNT_SID` | Backend | STAGING/SANDBOX VALUE | Separate test/trial account; omit SMS setup initially. | `.env.example:26`, `services/smsService.js:9`, `services/smsService.js:11` |
| `TWILIO_AUTH_TOKEN` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:27`, `services/smsService.js:9`, `services/smsService.js:12` |
| `TWILIO_PHONE_NUMBER` | Backend | STAGING/SANDBOX VALUE | Staging sender; test/verified recipient only. | `.env.example:28`, `services/smsService.js:16` |

## Market-data providers

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `ALPACA_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `routes/transactionsRoutes.js:219`, `services/websocketPriceService.js:11` |
| `ALPACA_SECRET_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `routes/transactionsRoutes.js:220`, `services/websocketPriceService.js:12` |
| `ALPACA_WS_URL` | Backend | STAGING SERVICE URL | Approved market-data websocket only; not a trading endpoint. Use staging-scoped data credentials. | `services/websocketPriceService.js:13` |
| `ALPHA_VANTAGE_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:35`, `controllers/marketDataController.js:4`, `controllers/predictionController.js:8` (and other consumers) |
| `ALPHA_VANTAGE_API_KEY` | ML service | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:11`, `docker-compose.yml:21`, `utils/market_data.py:15` |
| `ALPHA_VANTAGE_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/priceService.js:10` |
| `ARBISCAN_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:62`, `routes/walletRoutes.js:30` |
| `BASESCAN_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:65`, `routes/walletRoutes.js:45` |
| `BSCSCAN_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:60`, `routes/walletRoutes.js:20` |
| `COINGECKO_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:41`, `controllers/cryptoController.js:19`, `controllers/marketDataController.js:5` (and other consumers) |
| `COINGECKO_API_KEY` | ML service | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:12`, `docker-compose.yml:22`, `utils/market_data.py:16` |
| `COINGECKO_BASE_URL` | Backend | STAGING SERVICE URL | Approved provider data API matching staging key entitlement; ML separately hardcodes Pro API. | `controllers/cryptoController.js:21`, `routes/cryptoRoutes.js:18`, `routes/portfolioRoutes.js:672` (and other consumers) |
| `COINMARKETCAP_API_KEY` | Backend | UNKNOWN — NEEDS REVIEW | Example/Compose-only name, no matching runtime consumer found. Do not provision blindly. See actual runtime names and per-user Kraken storage. | `.env.example:42` |
| `CRYPTO_COMPARE_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `controllers/predictionController.js:9` |
| `ETHERSCAN_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:59`, `routes/walletRoutes.js:15` |
| `FINNHUB_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:36`, `controllers/predictionController.js:7`, `routes/chartRoutes.js:1355` (and other consumers) |
| `FINNHUB_API_KEY` | ML service | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `utils/sentiment_data.py:177` |
| `FMP_API_KEY` | Backend | UNKNOWN — NEEDS REVIEW | Example/Compose-only name, no matching runtime consumer found. Do not provision blindly. See actual runtime names and per-user Kraken storage. | `.env.example:38` |
| `HELIUS_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `routes/walletRoutes.js:837` |
| `NEWS_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/sentimentService.js:7` |
| `OPTIMISTIC_ETHERSCAN_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:63`, `routes/walletRoutes.js:35` |
| `PANCAKESWAP_V3_SUBGRAPH_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `routes/searchRoutes.js:14`, `services/priceService.js:13` |
| `POLYGON_API_KEY` | Backend | UNKNOWN — NEEDS REVIEW | Example/Compose-only name, no matching runtime consumer found. Do not provision blindly. See actual runtime names and per-user Kraken storage. | `.env.example:37` |
| `POLYGONSCAN_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:61`, `routes/walletRoutes.js:25` |
| `QUIVER_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/whaleService.js:11`, `test-all-whale-apis.js:13` |
| `SEC_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/whaleService.js:10`, `test-all-whale-apis.js:11` |
| `SOLSCAN_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:66`, `routes/walletRoutes.js:51` |
| `THE_GRAPH_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `routes/searchRoutes.js:13`, `services/priceService.js:12` |
| `WHALE_ALERT_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/whaleService.js:8`, `test-all-whale-apis.js:12` |

## Model storage/delivery and other storage

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `CLOUDINARY_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:46`, `config/cloudinaryConfig.js:21` |
| `CLOUDINARY_API_SECRET` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:47`, `config/cloudinaryConfig.js:22` |
| `CLOUDINARY_CLOUD_NAME` | Backend | STAGING/SANDBOX VALUE | Separate staging cloud/account for avatar uploads; not ML model storage. | `.env.example:45`, `config/cloudinaryConfig.js:20` |

## Scheduled/background jobs and notifications

| Variable | Service | Classification | Staging instruction | Source evidence |
|---|---|---|---|---|
| `CHECK_ALERTS_ON_STARTUP` | Backend | STAGING/SANDBOX VALUE | false. Only suppresses initial run; ENABLE_SCHEDULED_JOBS=false now suppresses all scheduler entry points. | `services/alertChecker.js:958` |
| `CHECK_PREDICTIONS_ON_STARTUP` | Backend | STAGING/SANDBOX VALUE | false. Only suppresses initial run; ENABLE_SCHEDULED_JOBS=false now suppresses all scheduler entry points. | `services/predictionChecker.js:508` |
| `DISCORD_ANNOUNCEMENTS_CHANNEL_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `services/discordService.js:1481` |
| `DISCORD_BOT_TOKEN` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:73`, `scripts/registerDiscordCommands.js:7`, `services/discordService.js:16` |
| `DISCORD_CLIENT_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `.env.example:74`, `routes/discordRoutes.js:191`, `scripts/registerDiscordCommands.js:8` (and other consumers) |
| `DISCORD_GUILD_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `routes/discordRoutes.js:299`, `scripts/registerDiscordCommands.js:9`, `services/discordService.js:133` (and other consumers) |
| `DISCORD_MEMBER_ROLE_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `services/discordService.js:1193` |
| `DISCORD_PREMIUM_ROLE_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `routes/discordRoutes.js:300`, `services/discordService.js:1268` |
| `DISCORD_PREMIUM_SIGNAL_CHANNEL_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `services/discordService.js:1267` |
| `DISCORD_RESULTS_CHANNEL_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `routes/discordRoutes.js:298`, `services/discordService.js:1266` |
| `DISCORD_SIGNAL_CHANNEL_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `routes/discordRoutes.js:297`, `services/discordService.js:1265` |
| `DISCORD_WELCOME_CHANNEL_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `services/discordService.js:1192` |
| `DISCORD_WHALE_CHANNEL_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `services/discordService.js:1482` |
| `TELEGRAM_ADMIN_IDS` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `services/telegramService.js:12`, `services/telegramService.js:13` |
| `TELEGRAM_ADMIN_USER_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `services/xPosterService.js:13` |
| `TELEGRAM_BOT_TOKEN` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `.env.example:69`, `services/telegramBot.js:356`, `services/telegramService.js:20` |
| `TELEGRAM_BOT_USERNAME` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `routes/telegramRoutes.js:27`, `routes/telegramRoutes.js:175` |
| `TELEGRAM_CHANNEL_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `.env.example:70`, `services/telegramBot.js:357` |
| `TELEGRAM_GROUP_ID` | Backend | STAGING/SANDBOX VALUE | Only separate staging resource IDs; optional if integration disabled. Never production recipients/roles/channels. | `services/telegramBot.js:358` |
| `USE_MOCK_PREDICTIONS` | Backend | STAGING/SANDBOX VALUE | true only for explicit synthetic signal smoke tests; not a global integration/job kill switch. | `routes/predictionsRoutes.js:284` |
| `VAPID_PRIVATE_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/pushNotificationService.js:8` |
| `VAPID_PUBLIC_KEY` | Backend | STAGING/SANDBOX VALUE | Public half of separate staging push pair; optional with push disabled. | `services/pushNotificationService.js:7` |
| `VAPID_SUBJECT` | Backend | STAGING/SANDBOX VALUE | Staging contact URI; optional with push disabled. | `services/pushNotificationService.js:9` |
| `X_ACCESS_TOKEN` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/xPosterService.js:27`, `services/xPosterService.js:73` |
| `X_ACCESS_TOKEN_SECRET` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/xPosterService.js:28`, `services/xPosterService.js:74` |
| `X_API_KEY` | Backend | NEW STAGING SECRET | Feature-specific staging credential; omit until integration is explicitly enabled. No production credential reuse. | `services/xPosterService.js:25`, `services/xPosterService.js:71` |
| `X_AUTO_POST_ENABLED` | Backend | STAGING/SANDBOX VALUE | false; defaults enabled. Also omit all X credentials. | `services/xPosterService.js:11` |
| `X_REQUIRE_TELEGRAM_APPROVAL` | Backend | STAGING/SANDBOX VALUE | true; not a substitute for disabling X. | `services/xPosterService.js:12` |

## Webhooks

Stripe: use a new staging endpoint `/api/stripe/webhook`, its own `STRIPE_WEBHOOK_SECRET`, and test events only. Raw body is registered before JSON parsing. Plaid: `PLAID_WEBHOOK_URL` must target staging `/api/brokerage/plaid/webhook`; never register staging handlers on production integrations. Staging rejects unsigned payloads; ENABLE_BROKERAGE_SYNC defaults false. Discord/Telegram use separate bots/resources or remain disabled.

## Host/build settings (not runtime source variables)

| Variable | Classification | Instruction |
|---|---|---|
| `NODE_VERSION` | STAGING/SANDBOX VALUE | Render Node 24.x; validation used 24.19.0. Backend package has no engine pin. |
| `PUBLIC_URL` | STAGING/SANDBOX VALUE | `/` for a root-hosted static site, overriding production `homepage`. |
| `DISABLE_ESLINT_PLUGIN` | STAGING/SANDBOX VALUE | `true` is already set by package build script; build does not validate lint. |
| `CI` | OPTIONAL | `true` for noninteractive tests. Build warnings can fail a CI=true build; review separately. |
| `PYTHONDONTWRITEBYTECODE` | STAGING/SANDBOX VALUE | `1`, already in Dockerfile. |
| `PYTHONUNBUFFERED` | STAGING/SANDBOX VALUE | `1`, already in Dockerfile. |

## Storage and service exclusions

No Redis, external queue, or SQL service is configured. Mongoose/MongoDB is backend storage. ML loads local `trained_models/7d`, `30d`, `90d`, with fallback to `trained_models`; there is no model-directory environment variable. Use only an approved isolated staging artifact set. Cloudinary is separate avatar storage. No production database exports, brokerage connections, Stripe customer IDs, push subscriptions, phone numbers, or messaging recipients may be copied into staging.

## Authoritative staging controls and catalog

All flags default false outside APP_ENV=production; invalid boolean spellings are errors. The brokerage encryption key is the sole intentionally shared production secret and is never retrieved by this task.

| Variable | Service | Classification | Required behavior |
|---|---|---|---|
| `ENABLE_MEDIA_UPLOADS` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Gates Cloudinary uploader methods including upload streams and deletes. Enable only with an isolated staging Cloudinary account. |
| `APP_ENV` | Backend / ML | STAGING/SANDBOX VALUE | staging. Backend hosted startup requires an explicit environment and NODE_ENV=production; ML Docker defaults staging. |
| `STAGING_DB_NAME` | Backend | STAGING/SANDBOX VALUE | nexus_signal_staging proposed. URI path must match exactly and contain staging; operator must separately verify isolated Atlas project/cluster/user. |
| `ENABLE_SCHEDULED_JOBS` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Controls all scanner/checker/scheduler starts and websocket startup. Opt in only after DB/provider isolation. |
| `ENABLE_NOTIFICATIONS` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Staging opt-in permits allowlisted SendGrid email only; bots, SMS and push remain blocked. |
| `ENABLE_BILLING` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Opt-in requires test secret, webhook secret and all eight configured prices. Every Stripe client operation rechecks this boundary. |
| `ENABLE_BROKERAGE_SYNC` | Backend | STAGING/SANDBOX VALUE | false by default outside production. Staging opt-in permits Plaid sandbox only. Private Kraken remains forbidden in staging. |
| `STAGING_EMAIL_RECIPIENTS` | Backend | STAGING/SANDBOX VALUE | Comma-separated exact controlled email addresses; all to/cc/bcc must match before SendGrid is called. No production user list. |
| `REACT_APP_ENV` | Frontend | STAGING/SANDBOX VALUE | staging; build rejects missing environment, missing service URLs and known production API destinations. |
| `REACT_APP_ENABLE_BILLING` | Frontend | STAGING/SANDBOX VALUE | false default. true requires test publishable key and complete unique catalog at build time. |
| `STRIPE_PRICE_STARTER_MONTHLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. |
| `STRIPE_PRICE_STARTER_YEARLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. |
| `STRIPE_PRICE_PRO_MONTHLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. |
| `STRIPE_PRICE_PRO_YEARLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. |
| `STRIPE_PRICE_PREMIUM_MONTHLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. |
| `STRIPE_PRICE_PREMIUM_YEARLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. |
| `STRIPE_PRICE_ELITE_MONTHLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. |
| `STRIPE_PRICE_ELITE_YEARLY` | Backend | STAGING/SANDBOX VALUE | Required with ENABLE_BILLING=true; corresponding Stripe test catalog price. No legacy alias or live fallback. |

Frontend prices use the same eight names prefixed with `REACT_APP_`; each is STAGING/SANDBOX VALUE, matches the corresponding backend test price and is public build configuration. Production uses its existing catalog through those variables; nothing is retrieved or configured automatically.

In staging leave TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN, X_API_KEY, X_ACCESS_TOKEN, TWILIO_AUTH_TOKEN and VAPID_PRIVATE_KEY unset; startup rejects them even if notification flags are false. Kraken credentials are per-user records, not a safe alternative environment variable. Do not import production records.

No TRADING_MODE variable was invented: no order execution API exists; the Kraken private transport now rejects all non-production calls and allowlists read-only endpoint names even in production.
