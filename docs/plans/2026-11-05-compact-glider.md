# Compact glider implementation

Goal: let portfolio visitors adjust a wing, fly a short estimated flight and compare saved designs.

Architecture: share a dependency-free model between browser and Node so geometry inputs and score rules agree. Node validates flight requests, calculates scores and stores bounded rankings in SQLite. The existing canvas and console remain the UI entry points, with a compact controls panel and expandable leaderboard.

Tech stack: existing HTML/CSS/Canvas/JavaScript, Node 24 HTTP and SQLite, node:test, browser smoke checks.

## Files

- `glider-model.js`: ranges, default inputs, strict validation, polyhedral station geometry and approximate flight calculation.
- `server.js`: static asset allowlist, flight API, leaderboard storage, request limits and HTTP error handling.
- `tests/glider.test.js`, `tests/server.test.js`: scoring/geometry invariants and real HTTP/storage tests.
- `main.js`, `index.html`, `styles.css`: adjustable wireframe, flight animation, UI states and console commands.
- `Dockerfile`, `fly.toml`, `.dockerignore`, `.gitignore`, `README.md`, `assets/MIRUM-LICENSE.txt`: local/deployment setup and attribution.

```text
slider input -> validate -> rebuild wireframe -> ready
                     | invalid -> explain, disable launch
fly -> freeze spec + alias -> POST /api/flights -> validate -> compute -> SQLite
                                | invalid -> restore controls, explain
                                | network failure -> practice estimate (no ranking)
                                | success -> short animation -> distance -> GET top 10
                                                                       | empty -> invite first flight
                                                                       | failure -> offline + retry
```

## Steps

- [x] Write model tests for Mirum's effective tip angle, SI wing area, deterministic distance at 10 m and rejected out-of-range/nonfinite/unknown inputs. Run `node --test tests/glider.test.js`; expect a missing-module failure before implementing the shared model, then passing assertions.
- [x] Write real HTTP tests for server-authoritative scoring, strict request validation, deduplication, persistent ranking order, static asset isolation and bounded requests. Run `node --test tests/server.test.js`; expect missing server module, then pass after implementing `createPortfolioServer({dbPath, rateLimit})` and the HTTP routes.
- [x] Add four labelled range inputs, alias input, reset/launch buttons, live estimate and expandable ranking table. Connect input events to `GliderModel.wingStation()` and the existing canvas. Freeze the selected spec during each flight and restore all controls in `finally`.
- [x] Replace console `fly` with the same launch function used by the button; add `leaderboard`. Animate the current wireframe on the hero canvas for four seconds, show progress, scroll it into view and restore the resting view afterward. Reduced motion completes without travel.
- [x] Document `node server.js`, practice-only static hosting, score assumptions and Fly volume creation. Update the existing container to serve the API on port 8080; configure its volume without deploying.
- [x] Run `node --test`, syntax checks and real browser smoke checks at desktop/mobile sizes. Exercise slider changes, launch/repeated launch, rankings, paper theme, reset, offline mode and reduced motion. Inspect the diff for unsafe serving, unescaped aliases, persistence problems and misleading score claims.

The user has already requested implementation in this session; continue directly after this plan.
