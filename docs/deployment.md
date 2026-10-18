# Deployment handoff

Status: the public source repository is [DavidG214/ping](https://github.com/DavidG214/ping). No verified public application deployment yet. No paid service has been enabled.

## Required access

- GitHub publication uses `DavidG214/ping`; the user requested proceeding with release on October 18.
- A Neon account and PostgreSQL project for fictional demo data.
- A Render account with access to that GitHub repository.

Never paste database URLs, tokens or passwords into chat or commit them. Enter secrets in the hosting dashboard or ignored local environment file.

## Publish the repository after review

The reviewed implementation is in `C:\Users\guerr\Projects\ping-tablet`; the original `ping` directory is preserved. This copy now has its own Git repository. Before staging anything, check `git rev-parse --show-toplevel`: it must resolve to this exact project directory, not a parent directory. Inspect `.gitignore` and the staged file list to ensure `.env`, dependencies, local database files and generated private artifacts are excluded.

From that verified project repository, after final checks and publication authorization:

```sh
git add .
git diff --cached --stat
git commit -m "Build PING fictional contact-request demo"
git push origin main
```

These are commands for a reviewed update, not permission to overwrite remote history. Include screenshots and decision/AI logs. Verify public access and the actual GitHub Actions result after pushing.

## Neon

1. Create a Free PostgreSQL project for this fictional demo. Select a region close to the Render service.
2. Copy the connection URL from the dashboard into Render's `DATABASE_URL`. Use TLS; prefer certificate-verifying `sslmode=verify-full` when configuring node-postgres.
3. Do not reuse the local development password, session secret or PIN pepper. Keep test databases separate.
4. The deploy applies checked-in migrations. No app records are stored on the web server filesystem. Shelter seed rows are in the first migration; each demo workspace seeds its own private fictional records.

## Render

Create a Web Service connected to the reviewed GitHub repository and the intended branch. Import `render.yaml` or configure:

| Setting          | Value                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Runtime          | Node                                                                                          |
| Plan             | Free; do not upgrade or add billing without authorization                                     |
| Node version     | `24.16.0`                                                                                     |
| Build            | `npm ci --include=dev && npm run build`                                                       |
| Start            | `npm run db:migrate && npm start`                                                             |
| Health check     | `/api/health`                                                                                 |
| `NODE_ENV`       | `production`                                                                                  |
| `DEMO_MODE`      | `true`                                                                                        |
| `DATABASE_URL`   | Neon secret                                                                                   |
| `SESSION_SECRET` | Independently generated random secret, 32+ characters                                         |
| `PIN_PEPPER`     | Different independently generated random secret, 32+ characters                               |
| `APP_ORIGIN`     | Exact assigned HTTPS origin, such as the real `https://…onrender.com`, without trailing slash |

Render supplies `PORT`. Generate secrets securely in the dashboard; never put them in the public blueprint. Changing `PIN_PEPPER` makes existing PIN hashes unusable; for fictional data, deliberately reset expired scenarios rather than pretend they survived the change.

Startup fails if migrations fail or the database demo marker disagrees with `DEMO_MODE`. Keep migrations backward-compatible for rolling restarts. Never use the test runner against the demo database.

## Verify before submission

1. Open the exact deployment URL in a private browser window with no existing account.
2. Verify `/api/health`, start an isolated demo, and complete staff B → Jordan → Alex.
3. Check reply-only data has no recipient shelter, then separately consent to location.
4. Refresh and restart the web service; database records must persist. Reauthentication may be required, but data must not reset.
5. Test a second independent browser context and reset one scenario; the other must survive.
6. Check mobile layout, shared-device logout/back navigation, map attribution and list fallback.
7. Check GitHub Actions and audit logs without logging message bodies or credentials.
8. Add only observed URL, screenshots and actual verification results to README/docs.

## Limitations and fallback

Official docs checked October 16, 2026: [Render Free](https://render.com/docs/free) sleeps after 15 idle minutes, can take about a minute to wake, and has ephemeral local storage and usage limits. [Neon Free](https://neon.com/pricing) currently has no fixed expiry but storage/compute/transfer limits and idle compute suspension. No free plan is assumed to provide guaranteed long-term uptime. Recheck dashboard quotas before submission; do not create keepalive traffic to bypass sleep.

Free Render PostgreSQL expires after 30 days, so do not silently substitute it for Neon. If access is unavailable, the local app and deployment configuration remain usable; the public-link submission requirement remains incomplete. No fabricated link or temporary local URL should be presented as a public deployment.
