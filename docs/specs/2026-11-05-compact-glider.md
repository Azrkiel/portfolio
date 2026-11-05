# Compact glider

Approved in chat: a small version of Mirum's adjustable explorer in the existing blue wireframe portfolio, a roughly four-second flight triggered by `fly`, and a shared leaderboard containing pilot aliases, distances and exact specifications.

Controls: span 0.60–1.40 m, root chord 0.10–0.22 m, taper 0.35–1.00 and effective dihedral 3–12 degrees, from Mirum's wing configuration. Keep a polyhedral wing with its break at 55% of half-span, NACA 2412 airfoil, fixed body and conventional tail. Drag still rotates the model. Reset restores the default design.

This is a portfolio simulation, not Mirum's AeroSandbox trim solver. Use a documented parabolic drag estimate at a fixed 10 m launch in still air. Show this limitation beside the controls and leaderboard. Exclude aspect ratios above 14, matching Mirum's structural screening limit; do not claim other feasibility checks.

Freeze each design while flying. The server validates physical inputs and computes distance; the browser cannot submit its own score. An alias identifies an entry, not an authenticated person. Store one entry per alias/design/model version in persistent SQLite, rank by distance, and show the top ten with all four inputs. Never populate invented competitors.

Local practice must work on static hosting. If the API is unavailable, label the flight practice-only and leave the leaderboard offline. Handle failed/slow requests, empty rankings, duplicate launches, invalid aliases, reduced motion, mobile layouts and stored-text injection. Do not retry writes automatically.

Run locally with Node 24, no dependencies or build step. Provide Docker/Fly configuration with a persistent volume; leave deployment to a later user instruction. Preserve existing unrelated work.

Source: https://github.com/Azrkiel/Mirum (MIT). Retain attribution for adapted geometry.
