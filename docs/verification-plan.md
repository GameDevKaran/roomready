# Verification record

Original application verified locally on 17 October 2026; cloud-persistence compatibility and all existing application tests rechecked on 18 October with Node 24.8.0 and pinned dependencies. No public deployment or live model call is claimed.

| Check | Result |
|---|---|
| TypeScript and Vite build | Passed |
| Node tests | 42/42: 16 domain, 5 model contract, 9 original server/persistence/MCP, 9 object-store/HTTP/admission, 2 SDK transport, 1 production-startup guard |
| Desktop/mobile Chromium | 22/22 scenarios; final full run approximately one minute |
| Synthetic receipt evaluation | 16/16 expected readiness/next-probe outcomes |
| Real local MCP | Initialize, discovery, observation, adjustment, withdrawal and receipt verified |
| SQLite reopen | Persistence, idempotency and deletion passed |
| Linux Docker, original local-volume release | Prior build, health, actual MCP write and restart persistence passed; current cloud-adapter image still requires release verification |
| Dependency audit | No vulnerabilities reported during clean install |

Browser tests cover consent, synthetic signal/replay, user-confirmed tone, own-endpoint calls, denied/cancelled capture, changed settings, withdrawal/deletion, HTML escaping and model-unavailable/failure guidance. All synthetic audio/provider inputs are test doubles. Real browser getUserMedia returned NotSupportedError in this host, including with Chromium fake-device flags. No workaround is presented as successful microphone hardware verification. A real Web Audio sine stream exercises downstream recording and analysis. Native audibility requires a person to listen; automated button clicks do not establish it.

Session replacement regression: every mutation, deletion and model request identifies its session, in addition to revision checks where applicable. Stale playback answers cannot become evidence for a replacement soundcheck. REST, MCP and desktop/mobile regression tests passed.

The additional 16-case evaluation was frozen before its first run and was not used to tune the domain. It is not the planned independent live-model symptom evaluation. That evaluation, model latency/cost, hardware capture, human listening/usability, real mobile devices, formal accessibility and public HTTPS checks remain outstanding.

The 18 October cloud adapter uses an explicit local object-store double for CAS/expiry/concurrency/failure tests and the real Google Storage SDK against a localhost HTTP double for exact generation and request-precondition checks. No provider credentials are used by those tests. Fixed 24-hour expiry, same-session atomic retries, stale deletion, replacement cleanup, sanitized outages, bounded cookie-rotation admission and Cloud Run/HTTPS startup failures passed. Public persistence and live GCS remain unverified. Narrow transport reuse and its source commit are recorded in provenance.md.

Commands are in README; the manual GitHub Actions workflow is prepared, not executed. docs/evaluation.md records the fixture hash, thresholds and limitations. The 49.36-second local captioned synthetic-audio video is a rehearsal; public upload and a consenting hardware walkthrough remain separate release gates.
