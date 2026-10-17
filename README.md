# RoomReady

A calmer browser soundcheck before a lesson, workshop or conversation.

RoomReady measures a consented microphone sample, asks you to listen to its replay, plays a quiet test tone and times five requests to its own endpoint. It separates browser measurements from user confirmations. Changes require retesting; earlier observations remain in history. Export a readiness receipt that states its limits.

This is an Alexa+ experience simulation with real local MCP tools, not a native Alexa or Zoom/Teams integration. Raw audio stays in the browser. Model guidance is optional and disabled by default. Live Bedrock, physical microphone compatibility and public hosting are not yet verified.

## Run

Requires Node 24.

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3220. Microphone capture needs localhost or HTTPS, explicit recording consent and browser permission. Text controls remain available if input access fails. `.env.example` documents optional app-specific settings.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:e2e
node --import tsx scripts/evaluate.ts
```

29 Node tests and 20 desktop/mobile browser tests passed. Sixteen frozen synthetic receipt scenarios passed. Browser audio tests inject an explicitly named synthetic Web Audio stream because this automated environment rejects getUserMedia with NotSupportedError. Actual analysis, recording/replay, tone, HTTP/MCP and receipt logic execute; these tests do not prove hardware capture or human audibility.

## Operation and limits

[Architecture](docs/architecture.md) · [Verification](docs/verification-plan.md) · [Evaluation](docs/evaluation.md) · [Deployment](docs/deployment.md) · [Provenance](docs/provenance.md) · [Demo](docs/demo.md)

The receipt is bound to one browser and expires after 24 hours. Audio recordings are memory-only and disappear on reload or close. No camera, operating-system changes, network scanning, meeting-service quality or other participant is checked. A passing level is not proof of intelligible speech; replay and output require explicit user confirmation.

[MIT](LICENSE) for app code; dependencies retain their own licenses. Narrow infrastructure reuse is disclosed in provenance. RoomReady has its own domain, interface, repository and deployment configuration.
