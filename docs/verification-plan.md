# Verification record

Verified locally on 17 October 2026 with Node 24.8.0 and pinned dependencies. No public deployment or live model call is claimed.

| Check | Result |
|---|---|
| TypeScript and Vite build | Passed |
| Node tests | 29/29: 16 domain, 5 model contract, 8 server/persistence/MCP |
| Desktop/mobile Chromium | 20/20 scenarios; 50.7-second final full run |
| Synthetic receipt evaluation | 16/16 expected readiness/next-probe outcomes |
| Real local MCP | Initialize, discovery, observation, adjustment, withdrawal and receipt verified |
| SQLite reopen | Persistence, idempotency and deletion passed |
| Linux Docker | Build, health, actual MCP write and restart persistence passed |
| Dependency audit | No vulnerabilities reported during clean install |

Browser tests cover consent, synthetic signal/replay, user-confirmed tone, own-endpoint calls, denied/cancelled capture, changed settings, withdrawal/deletion, HTML escaping and model-unavailable/failure guidance. All synthetic audio/provider inputs are test doubles. Real browser getUserMedia returned NotSupportedError in this host, including with Chromium fake-device flags. No workaround is presented as successful microphone hardware verification. A real Web Audio sine stream exercises downstream recording and analysis. Native audibility requires a person to listen; automated button clicks do not establish it.

The additional 16-case evaluation was frozen before its first run and was not used to tune the domain. It is not the planned independent live-model symptom evaluation. That evaluation, model latency/cost, hardware capture, human listening/usability, real mobile devices, formal accessibility and public HTTPS checks remain outstanding.

Commands are in README; the manual GitHub Actions workflow is prepared, not executed. docs/evaluation.md records the fixture hash, thresholds and limitations. The 49.36-second local captioned synthetic-audio video is a rehearsal; public upload and a consenting hardware walkthrough remain separate release gates.
