# RoomReady: verification plan

No tests or evaluations have run. The following are prospective acceptance targets, not results.

## Fixtures and acceptance

12 development scenarios plus 16 held-out cases covering silence, clipping, permission denial, normal input, unconfirmed playback and delayed endpoint response. Compare a fixed troubleshooting wizard with adaptive probe selection. Target correct next-test selection in at least 14/16 cases and zero unsupported ready claims. Report number of probes, user corrections, p50/p95 latency and actual inference cost. Synthetic audio tests measure signal logic; they are not proof of real-world headset compatibility.

## Demonstration to verify

0–20 imminent tutoring session; 20–50 run a microphone check; 50–85 diagnose measured clipping and explain a user adjustment; 85–115 retest; 115–135 show denied-permission/text fallback; 135–150 display a receipt that separates measured, confirmed and unknown facts.

## Result record

For each run, record the source commit, fixture version, runtime/provider versions, actual pass and failure counts, latency, cost where relevant, and limitations. Keep development and held-out inputs separate. Report negative findings; freeze the protocol before inspecting held-out results.

A release requires a functioning end-to-end workflow and a clean-session replay. Documentation, repository creation and HTTP availability alone do not establish application correctness.
