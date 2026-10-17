# Architecture

A TypeScript browser app owns permission-sensitive capture and playback. Express serves the production build, an own-endpoint ping, browser-bound receipt export and a real stateless Streamable HTTP MCP server. SQLite stores structured observations and adjustment history for 24 hours. No audio endpoint exists: raw recordings stay in browser memory.

The browser explicitly asks for consent, obtains microphone permission, samples Web Audio waveform windows over 3.2 seconds and records a local MediaRecorder blob. RMS level, near-clipping fraction and sample counts are client-reported measurements. They are not calibrated hardware diagnostics. A replay answer references the current microphone observation; a new sample invalidates the old replay. Tone playback and audible output are separate facts. Five requests measure only RoomReady, including failures and p50/p95.

Deterministic receipt logic yields UNRESOLVED or READY_WITH_LIMITS. All four current checks must pass. An adjustment invalidates that probe; withdrawing the latest observation never resurrects an earlier positive result. History remains visible. Revision guards and request idempotency protect retries and concurrent tabs.

MCP tools are get_receipt, record_probe, record_adjustment and withdraw_observation. The actual SDK client initializes, discovers tools and executes them over HTTP. The optional Bedrock adviser receives a symptom/current receipt and returns an allowlisted next-probe recommendation with validated evidence citations. It never runs probes or edits results. No successful live inference is claimed.

Cookie capabilities are random, HttpOnly and SameSite=Strict, with Secure in production. Exact origin/host checks, CSP, payload bounds, schema validation and request limits protect API boundaries. SQLite transactions isolate state changes. Model request counters are process-local, so external billing controls are required before paid public exposure. Browser reports remain untrusted measurements even though schemas are validated.

The independent data model and UI are new. Narrow infrastructure adapted from HoldThat is documented in provenance; no task-checklist product logic is shared. See deployment.md for configuration, retention, hosting and release checks.
