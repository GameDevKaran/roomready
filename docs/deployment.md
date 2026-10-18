# Current hosting decision — 18 October 2026

Preferred supporting GCP project: tough-melody-508008-p8 only. The release requires public HTTPS and verified deployed behavior. The tested SQLite/volume package below remains valid for local use. An independently configured GCS adapter is now implemented and tested with local transport doubles; it has not been live-verified or deployed by this milestone. See [cloud persistence](cloud-persistence.md) and [hosting scope](hosting-scope.md). Do not mount SQLite through Storage FUSE. The Compose package below remains a single-host option.

# Run and deploy RoomReady

Node 24 is required. Run `npm ci`, `npm run build`, then `npm start`; open http://127.0.0.1:3220. Local mode performs no model inference. Browser media capture requires HTTPS or localhost and an explicit permission grant. Supported initial target: Chromium desktop; mobile layout is tested by emulation, not physical devices.

Use `.env.example` as a names-only reference. Copy only this app's approved configuration into ignored `.env.local`. `ROOMREADY_DATABASE_PATH` selects SQLite storage. `ROOMREADY_MODEL_PROVIDER=none` is the default. A Bedrock mode needs `AWS_REGION`, `BEDROCK_MODEL_ID` and a scoped standard AWS credential-chain identity. Secrets never enter Vite/browser variables. No runtime account or spending permission is implied by a Codex subscription.

The adviser can only return an allowlisted next-probe recommendation and current evidence citations. No model tool can hear audio or change the receipt. The model receives the current receipt and typed symptom, never raw audio. Its process-local daily cap defaults to 100 requests; it resets on restart and is not a durable financial limit. Configure provider/account limits before exposing paid inference. The SDK allows two attempts and a 15-second request timeout.

`docker build -t roomready:local .` creates a non-root image. Production startup requires an exact HTTPS `ROOMREADY_ORIGIN`. `deploy/compose.yaml` connects the app to Caddy and separate persistent data/certificate volumes. Set `ROOMREADY_DOMAIN` to an approved hostname, point its DNS to the authorized host, then run `docker compose -f deploy/compose.yaml up -d --build`. Account/host/budget must be supplied before this paid/public operation; none has been provisioned.

The app uses a 24-hour HttpOnly/SameSite=Strict cookie (Secure in production), exact origin/host checks, a CSP and camera-disabled permissions policy. Receipt records have an absolute 24-hour expiry, pruned on subsequent database access; restart does not renew expiry. Browser audio blobs stay in memory and are revoked on reload/close/new recording. Clear removes this browser's receipt/history. Clearing cookies loses access to the prior receipt, which then expires. Export before clearing if needed. Backups inherit the operator's retention policy and are outside automatic deletion guarantees.

Release verification: confirm public HTTPS, cookie flags, microphone permission denial/cancellation, a consenting hardware sample and replay, tone confirmation, network-only scope, adjustment/retest, fresh browser isolation, persistence/restart and deletion. Verify no audio upload in network tools. Keep model disabled until a real authorized request and failure are tested. No camera, OS settings, network scan, meeting platform or remote participant is tested.

CI is manual `workflow_dispatch` to avoid assuming private-runner spending approval. Local verification commands are in the README. Roll back by deploying a known image/source revision and preserving the data volume; export any needed receipt before intentional data removal. No destructive cleanup is needed to continue development.
