# Sources and reuse

RoomReady is an independent browser AV preflight, not a renamed task checklist. Its evidence schemas, signal analysis, replay linkage, adjustment/retest rules, receipt, probes and interface were newly implemented for this repository.

Narrow infrastructure was adapted from [HoldThat commit 557def91](https://github.com/GameDevKaran/holdthat/tree/557def91d3d38b903d409f0649a1a4b67ceb3d23), MIT: pinned package/build configuration, Docker/Caddy packaging, manual CI workflow, HTTP origin/cookie safeguards, SQLite transaction/idempotency pattern and test-runner process ownership. Configuration names, ports, data lifecycle and tool schemas are independent. No HoldThat task reducer, product frontend, template or task workflow was reused.

AI coding agents substantially assisted design, coding, tests, documentation and synthetic demo recording. No human review or real-device testing is inferred.

Implementation references, reviewed 17 October 2026:

- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia): explicit permission and secure-context requirements.
- [MDN waveform sampling](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData): browser PCM observations; these do not identify speakers or certify intelligibility.
- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder): local browser recording lifecycle.
- [MCP TypeScript server SDK](https://ts.sdk.modelcontextprotocol.io/server): real Streamable HTTP transport.

Third-party dependencies retain their own licenses. App code and generated sine tone are MIT. Synthetic tests use no private recordings or external datasets.
