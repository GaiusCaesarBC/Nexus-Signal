# Dependency maintenance

Use npm and the committed package-lock.json: `npm ci --legacy-peer-deps`.
The staging Render build command must be `npm ci --legacy-peer-deps`.
Production configuration changes require a separate, explicitly authorized release.
The obsolete Yarn lockfile was removed because Yarn does not enforce npm overrides.

The security repair removes unused Nodemailer and pins patched compatible dependency
lines through npm overrides: qs 6.16+, Undici 7.29+, and UUID 11.1.1+ under
@cypress/request. Telegram stays on its existing 0.67 API; version 2 is a rewrite.
The request library's UUID v4 call was checked against the replacement API without
network traffic. Node must satisfy Undici's minimum version (20.18.1).

After updates: run npm audit and npm test. A zero-advisory result applies to the
installed dependency tree at scan time, not the application's overall security.
