# Kevin Jiang — Portfolio

**Theme: "The Messenger Between Atoms & Agents."** Hermes carried messages between worlds. This site
casts Kevin as the go-between for physical engineering (CAD, gliders, detonation engines) and AI agents
(XVANT, Mirum, Intent).

- **Look:** single-ink electric blue with thin condensed display type (Antonio), mono body text
  (IBM Plex Mono), sunburst engravings and film grain. Press `i` or the ◐ icon to switch to blue ink on paper.
- **Hero art:** an adjustable **polyhedral glider**, adapted from [Mirum](https://github.com/Azrkiel/Mirum).
  Drag to rotate; change wingspan, root chord, taper and effective dihedral below the canvas.
- **Flight lab:** click **Fly glider** or run `fly` in the console for a four-second flight. An optional
  public alias (default `Anonymous`) and the frozen design are logged to the shared leaderboard.
  `leaderboard` opens the top ten, including each wing's specifications. Reduced motion skips travel.
- **Agent console:** press `~`, `` ` `` or `Ctrl/⌘ K` (or click *Open Console*). Try `help`, `ls`,
  `open mirum`, `wins`, `research`, `fly`, `sudo hire kevin`.
- Sections follow an agent's anatomy: Ⅰ Memory · Ⅱ Skills · Ⅲ Dispatches · Ⅳ Research · Ⅴ Trail · Ⅵ Summon.

No framework, dependencies or build step. The browser uses HTML/CSS/Canvas; the optional Node server
adds shared rankings with SQLite. `glider-model.js` is used by both browser and server.

## Run locally

Requires **Node 24 or newer**.

```powershell
node server.js
```

Open **http://127.0.0.1:8000**. Scores persist in `data/flights.sqlite` (gitignored).
Set `PORT`, `HOST` or `GLIDER_DB_PATH` to override the defaults. With the Node server running,
different visitors to the same server share a flight log. The local preview's log is separate from production.

```powershell
node --test
```

Tests cover geometry, score validation, storage across restart, ranking/deduplication, HTTP limits
and private-file isolation. No browser packages are needed for these tests.

## Flight estimate

All ranked flights use the same 10 m launch height, still air, fixed body/conventional tail and NACA 2412 wing.
Span (0.60–1.40 m), root chord (0.10–0.22 m), taper (0.35–1.00) and effective dihedral (3–12°) follow
Mirum's parameter ranges. Its polyhedral center is flat; the outer 45% rises to the effective tip height.
Aspect ratios above 14 are excluded. Other structural/stability checks are not performed.

The compact model uses a parabolic drag polar: `CD = 0.035 + CL² / (π × e × AR)`, with
`e = 0.82 × (1 - 0.2 × (taper - 0.5)²) × cos(dihedral)²`, and best-glide `CL` capped at 0.85.
Distance is `10 × L/D`, rounded to 0.1 m. Mass is `0.110 kg + 0.30 kg/m² × wing area`.
These are educational estimates, **not Mirum's AeroSandbox trim analysis, CFD, or measured flights**.
The four-second animation compresses flight time and its progress display is illustrative.

The server computes scores from validated specifications and rejects submitted distances. Aliases are
accountless and are not verified identities. An identical alias/design appears once (case-insensitive alias).
Rankings are versioned as `compact-v1`; at most 5,000 entries are retained and the top ten are displayed.
Submissions are limited to 20 per minute per remote address. Request bodies are limited to 2 KB.

## Hosting

**Static / GitHub Pages:** the portfolio and practice animation work with any static server, including
`python -m http.server 8000`. The UI labels flights practice-only when no API exists. A shared leaderboard
requires the Node server; GitHub Pages alone cannot save rankings. Failed/uncertain network writes are
not retried automatically.

**Fly.io:** the included Dockerfile runs the Node server on port 8080. `fly.toml` mounts a persistent
`glider_data` volume at `/data`. Before a future deployment, create the volume in the app's region:

```powershell
fly volumes create glider_data --region iad --size 1 --app kevinportfolio
fly deploy --ha=false
```

Use **one machine**: SQLite lives on that machine's volume, not a shared replicated database. Scaling to
multiple machines requires a shared database. Back up the volume before replacing it. These instructions
configure a future deployment; implementing the demo does not deploy it.

Geometry attribution and the Mirum MIT notice are in `assets/MIRUM-LICENSE.txt`.

## Editing content

All copy lives in `index.html`. Console answers live in the `projects` and `commands` objects in `main.js`.
The resume is served from `assets/Kevin-Jiang-Resume.pdf`.
