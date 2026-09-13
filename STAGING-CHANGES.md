# Local revisions and exact changed paths

Prepared 2026-09-13. All commits are local; nothing pushed, merged or deployed. Backend staging configuration and integration/job gates share one atomic commit because the startup validator, guarded transports and tests depend on one another. Frontend configuration and dependency repairs are separate commits.

## Nexus-Signal-deploy

Baseline: 347c17efc51fc97eae5776f44e37bdf0fcb78f8b

Tested source HEAD: c8650c1888f780b4ce81a6f3f2a199f25b0c9f66

- c8650c1888f780b4ce81a6f3f2a199f25b0c9f66 Guard staging integrations, jobs and brokerage with explicit Stripe configuration

- [.env.example](C:/Users/2cody/source/repos/Nexus-Signal-deploy/.env.example)
- [DEPENDENCY-NOTES.md](C:/Users/2cody/source/repos/Nexus-Signal-deploy/DEPENDENCY-NOTES.md)
- [STAGING-CHANGES.md](C:/Users/2cody/source/repos/Nexus-Signal-deploy/STAGING-CHANGES.md)
- [STAGING-DEPLOYMENT.md](C:/Users/2cody/source/repos/Nexus-Signal-deploy/STAGING-DEPLOYMENT.md)
- [STAGING-ENV-CHECKLIST.md](C:/Users/2cody/source/repos/Nexus-Signal-deploy/STAGING-ENV-CHECKLIST.md)
- [STAGING-VALIDATION.md](C:/Users/2cody/source/repos/Nexus-Signal-deploy/STAGING-VALIDATION.md)
- [app.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/app.js)
- [config/cloudinaryConfig.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/config/cloudinaryConfig.js)
- [config/runtimeSafety.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/config/runtimeSafety.js)
- [config/stripeClient.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/config/stripeClient.js)
- [config/stripePrices.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/config/stripePrices.js)
- [package.json](C:/Users/2cody/source/repos/Nexus-Signal-deploy/package.json)
- [routes/paymentRoutes.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/routes/paymentRoutes.js)
- [routes/sentimentRoutes.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/routes/sentimentRoutes.js)
- [routes/stripeRoutes.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/routes/stripeRoutes.js)
- [scripts/fix-upgrade-subscriptions.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/scripts/fix-upgrade-subscriptions.js)
- [scripts/lookup-stripe-package-purchases.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/scripts/lookup-stripe-package-purchases.js)
- [services/alertChecker.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/alertChecker.js)
- [services/discordScheduler.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/discordScheduler.js)
- [services/discordService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/discordService.js)
- [services/emailService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/emailService.js)
- [services/krakenService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/krakenService.js)
- [services/plaidService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/plaidService.js)
- [services/predictionChecker.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/predictionChecker.js)
- [services/pushNotificationService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/pushNotificationService.js)
- [services/signalGenerator.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/signalGenerator.js)
- [services/signalResultChecker.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/signalResultChecker.js)
- [services/smsService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/smsService.js)
- [services/telegramBot.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/telegramBot.js)
- [services/telegramScheduler.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/telegramScheduler.js)
- [services/telegramService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/telegramService.js)
- [services/websocketPriceService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/websocketPriceService.js)
- [services/xPosterService.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/services/xPosterService.js)
- [test-email.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/test-email.js)
- [tests/rate-limits.test.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/tests/rate-limits.test.js)
- [tests/staging-safety.test.js](C:/Users/2cody/source/repos/Nexus-Signal-deploy/tests/staging-safety.test.js)

## Nexus-Signal-Frontend-deploy

Baseline: 8fe5c5cb9b41c24eed9a9fb83080b7ae12f22903

Tested source HEAD: 9a286ebc398c4ea9865162086104f2628c55db43

- 9a286ebc398c4ea9865162086104f2628c55db43 Repair strict wallet peers and isolate locked CRA tooling dependencies
- a6d213765e5a6c0fcf9953e779f62c468e18b7da Require explicit hosted API and Stripe catalog configuration

- [.env.example](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/.env.example)
- [.npmrc](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/.npmrc)
- [package-lock.json](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/package-lock.json)
- [package.json](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/package.json)
- [scripts/validate-config.cjs](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/scripts/validate-config.cjs)
- [src/api/axios.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/api/axios.js)
- [src/components/DashboardHero.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/components/DashboardHero.js)
- [src/components/NewsWidget.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/components/NewsWidget.js)
- [src/components/StockDataDisplay.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/components/StockDataDisplay.js)
- [src/components/dev/PriceServiceTester.jsx](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/components/dev/PriceServiceTester.jsx)
- [src/config/stripePrices.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/config/stripePrices.js)
- [src/config/stripePrices.test.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/config/stripePrices.test.js)
- [src/context/ThemeContext.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/context/ThemeContext.js)
- [src/hooks/useLivePrice.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/hooks/useLivePrice.js)
- [src/pages/LandingPageV2.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/pages/LandingPageV2.js)
- [src/pages/LivePerformancePage.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/pages/LivePerformancePage.js)
- [src/pages/PricingPage.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/pages/PricingPage.js)
- [src/pages/ProfileSettingsPage.js](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/src/pages/ProfileSettingsPage.js)
- [tooling/.npmrc](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/tooling/.npmrc)
- [tooling/README.md](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/tooling/README.md)
- [tooling/install.cjs](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/tooling/install.cjs)
- [tooling/package-lock.json](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/tooling/package-lock.json)
- [tooling/package.json](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/tooling/package.json)
- [tooling/run-react-scripts.cjs](C:/Users/2cody/source/repos/Nexus-Signal-Frontend-deploy/tooling/run-react-scripts.cjs)

## Nexus-Signal-ML-deploy

Baseline: 829f027252f7f96d13c17c1911df1f27ba5da3bb

Tested source HEAD: b876b608e2a40060a9832473677eb95c2c823536

- b876b608e2a40060a9832473677eb95c2c823536 Enforce safe ML staging startup and validate Python 3.11 regressions

- [.dockerignore](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/.dockerignore)
- [.env.example](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/.env.example)
- [Dockerfile](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/Dockerfile)
- [app.py](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/app.py)
- [docker-compose.yml](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/docker-compose.yml)
- [scripts/retrain_models.sh](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/scripts/retrain_models.sh)
- [scripts/train_models.py](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/scripts/train_models.py)
- [scripts/train_multi_horizon.py](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/scripts/train_multi_horizon.py)
- [tests/test_regressions.py](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/tests/test_regressions.py)
- [tests/test_runtime_safety.py](C:/Users/2cody/source/repos/Nexus-Signal-ML-deploy/tests/test_runtime_safety.py)

The final backend documentation commit contains this manifest, both staging documents and the validation/advisory report; its SHA is reported separately in the task response. Documentation-only changes follow the tested source HEAD above. Local audit helper scripts, package caches, the Python test environment and logs under C:/Users/2cody/source/repos/nexus-audit are supporting workspace artifacts, not application repository changes.
