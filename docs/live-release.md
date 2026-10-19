# Public release evidence — October 19, 2026

- URL: https://roomready-kc4mxxrtbq-uc.a.run.app
- Source: https://github.com/GameDevKaran/roomready (MIT)
- Deployed application commit: `9b8b71b0eac56dd8a0d1b3340e23126f47758a91`
- Ready revision: `roomready-00003-fb6`
- Image digest: `sha256:fcd9ef43e719d4f5274fbf873f671f47f5d26c0ccf8b389248519e5bc7f23b27`
- Runtime: Cloud Run, one maximum instance, zero minimum instances, 1 vCPU/512 MiB; dedicated identity and private GCS session bucket in `tough-melody-508008-p8`.

Live private checks initialized the real MCP endpoint and listed its four tools. Five real endpoint timings were saved through MCP; retry deduplication, adjustment invalidation, stale revision rejection, browser isolation, hostile-origin rejection and Secure/HttpOnly/SameSite cookie flags passed. Evidence and adjustments survived replacement of the running Cloud Run revision. Export and deletion then passed.

Anonymous public browser checks exercised consent, signal analysis/recording/replay, tone playback and confirmations, five actual HTTPS endpoint requests, actual MCP persistence, receipt export, reload, adjustment/retest and explicit browser clearing. Desktop and mobile screenshots were visually inspected. The audio input was an explicitly labeled synthetic Web Audio stream and confirmations were scripted. No raw audio upload was observed. These checks do not prove physical microphone capture or human audibility.

The real public connection check returned five replies with median 344 ms and p95 349 ms. The receipt correctly remained `UNRESOLVED` under its 300 ms threshold. Results concern this endpoint and this observation, not Zoom, Teams, bandwidth or another participant. No live Bedrock inference or native Alexa integration is claimed. Provider-outage checks use local test doubles.

Reproduce using `scripts/verify-live.ts prepare`, then a genuinely different ready revision and `restart`, then `public`. The verifier uses the ignored deployment journal; private checks accept `ROOMREADY_VERIFY_ID_TOKEN` only through the process environment and never save it. The `public` phase rejects an identity token. Run with `node --import tsx` from the repository root. Detailed operator reports, screenshots and raw browser WebM are in ignored `.local/live`; the WebM is test evidence, not a narrated submission video.

Remaining user checks: consented physical microphone capture and listening on the intended demo device; final submission media and manual Devpost submission. No Devpost account access or submission was performed.
