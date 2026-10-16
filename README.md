# RoomReady

Run evidence-led browser audio/device preflight.

## Status

This repository contains the initial product documentation. Application development has not started. There is no runnable application, measured benchmark or deployed service yet.

## Intended use

A remote tutor or workshop presenter discovers microphone or playback problems just before a session. Repeating generic troubleshooting advice wastes time because the next useful test depends on what already happened. RoomReady runs a bounded browser preflight and explains what is measured, what the user confirmed and what remains unknown.

## Planned workflow

State is `PERMISSION_PENDING → TEST_SELECTED → OBSERVED → EXPLAINED → USER_ACTION → RETESTED → READY_WITH_LIMITS | UNRESOLVED`. Browser tools check microphone permission and signal level, clipping, a controlled recording/replay, an output tone confirmed by the user, and latency to RoomReady's own endpoint. The app cannot infer that a speaker is audible merely because playback was requested.

## Development

Start with the behavior and boundaries in [Architecture](docs/architecture.md), then establish the fixtures and acceptance checks in [Verification plan](docs/verification-plan.md). Runtime versions, dependency installation, commands and deployment instructions will be added alongside working code. No installation command is available at this stage.

Keep credentials in local ignored files or the deployment secret store. Do not commit user data, provider tokens or private evaluation records.

## License

Original application code and these documents use the [MIT license](LICENSE). Future dependencies, models, datasets and media retain their own licenses and must be reviewed before inclusion.
