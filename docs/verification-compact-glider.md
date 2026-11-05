# Compact glider verification

- `node --test`: 8 tests passed. Covers Mirum-derived polyhedral geometry, deterministic scoring and physical input limits; real HTTP tests cover server-computed scores, duplicate entries, ranking and persistence across server restart, rejected forged scores/cross-origin writes, body/rate limits and static-file isolation.
- `node --check main.js`, `node --check glider-model.js`, `node --check server.js`: passed.
- Playwright/Chromium: desktop sliders update geometry and estimates; console `fly` launches the selected design; concurrent launches are blocked; controls recover at touchdown; real API entries show their exact specifications. Paper theme, reset, invalid aspect ratio, mobile width, reduced motion and offline mode passed with no page errors.
- A mobile regression check first reproduced a touchdown result below the viewport, then passed after scrolling the result into view. The desktop canvas was reduced to keep the controls compact.
- Offline regression covered a static server's HTTP 501 response. An actual Python HTTP server also completed a local practice flight without a shared API.
- Review: score and range logic is shared between browser and server; server rejects client-supplied distances. SQL uses bound parameters; aliases use text nodes in the table and escaped console output. Public serving is restricted to an asset allowlist; database/source files are not served. Requests, leaderboard retention and write rate are bounded. Aliases remain accountless and unverified, as labelled in the UI.
- Cleanup: removed the obsolete spin-only command API and duplicate resize handler; retained Mirum's MIT notice. Removed the three entries created by browser QA from the local preview database.
- `fly config validate --config fly.toml`: passed. Docker image build was not run because the Docker Desktop engine is stopped. Nothing was deployed.

Browser screenshots and the local smoke script are under gitignored `test-results/`. The preview is http://127.0.0.1:8000, run by `node server.js`. Production will need the documented persistent volume and one machine, or a shared database before scaling.
