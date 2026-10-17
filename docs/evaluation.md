# Synthetic receipt evaluation

The frozen `evaluation/scenarios.json` matched expected readiness and next-probe results in **16/16** cases on 17 October 2026. SHA256: `57a422c4d509cd528d04f48e6068a04331bfca5c7e752ec928782f0630c4673d`. All per-case outputs are in `evaluation/results.json`. Reproduce with `node --import tsx scripts/evaluate.ts`.

Cases include denied, quiet and clipped input; missing/negative/unknown playback confirmation; missing, slow and failed endpoint requests; all passing observations; and changes requiring retesting. This is post-implementation synthetic coverage, frozen before its first run. It is not an independent model-selection holdout or hardware study. No implementation was tuned after this evaluation.

Separate unit fixtures compute silence, clipping and sine-wave RMS; browser fixtures inject a clearly named synthetic Web Audio stream. Actual browser analyser, MediaRecorder, replay, tone generation, HTTP and MCP still execute. The automated host's getUserMedia returned NotSupportedError even with Chromium fake-device flags; no successful hardware capture is claimed. Permission denial and pending-request cancellation are explicit doubles.

The original 12-development/16-held-out conversational comparison requires a live model and separately authored symptom/evidence scenarios. It remains unrun. No claim of 14/16 model accuracy, model latency/cost or superiority over a commercial wizard is made. Measured endpoint p50/p95 describes only that five-request session to RoomReady. The -45 dBFS quiet and 1% near-clipping thresholds are engineering heuristics, not calibrated hardware specifications or clinical measurements.
