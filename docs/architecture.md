# RoomReady: architecture

Proposed design; no components have been implemented.

State is `PERMISSION_PENDING → TEST_SELECTED → OBSERVED → EXPLAINED → USER_ACTION → RETESTED → READY_WITH_LIMITS | UNRESOLVED`. Browser tools check microphone permission and signal level, clipping, a controlled recording/replay, an output tone confirmed by the user, and latency to RoomReady's own endpoint. The app cannot infer that a speaker is audible merely because playback was requested.

A labelled **Alexa+ simulation** asks questions, interprets the observations and selects the next allowlisted probe. An authorized Amazon Bedrock text model handles ambiguous symptom descriptions and synthesizes a short evidence-linked action. Deterministic code owns measurements and readiness conditions. If microphone input is broken, visible controls and text let the user complete the diagnostic flow; the app must not enter an endless “please speak” loop.

Use TypeScript, Web Audio/media APIs, a small HTTPS diagnostic service, structured tool schemas and ephemeral session records. No native Alexa hardware or Zoom API access is assumed. The minimal product tests one browser/device pair with four probes, one correction/retest loop and a downloadable readiness receipt. Exclude network scanning, OS automation, recording other applications, biometric voice analysis and broad IT support. Own the test tone and collect only consenting test audio; default retention is session-only.

## Failure handling and data boundaries

Preserve original inputs and make unavailable evidence explicit. Provider failures must return a visible unresolved state. Decisions that change user or provider state need the confirmation specified above. Record source versions and operation identifiers without exposing credentials.

## Implementation record

Add pinned dependencies, actual component boundaries and operational instructions when the first working slice exists. Document departures from this design with their reason; do not describe planned integrations as verified.
