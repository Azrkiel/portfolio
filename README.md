# Kevin Jiang — Portfolio

**Theme: "The Messenger Between Atoms & Agents."** Hermes carried messages between worlds. This site
casts Kevin as the go-between for physical engineering (CAD, gliders, detonation engines) and AI agents
(XVANT, Mirum, Intent).

- **Look:** single-ink electric blue with thin condensed display type (Antonio), mono body text
  (IBM Plex Mono), sunburst engravings and film grain. Press `i` or the ◐ icon to switch to blue ink on paper.
- **Hero art:** a procedurally drawn wireframe of a **polyhedral glider wing** (NACA-style ribs, 3° → 15°
  dihedral break, washout). It comes from Kevin's generative-design research, where polyhedral wings led on
  glide ratio (11.9 vs 10.8). You can drag to rotate it.
- **Agent console:** press `~`, `` ` `` or `Ctrl/⌘ K` (or click *Open Console*). Try `help`, `ls`,
  `open mirum`, `wins`, `research`, `fly`, `sudo hire kevin`.
- **Broadcast player:** a mini browser window at the top of Dispatches that cycles through projects like a
  playlist. Live apps (SignLine, Speak Up, Intent) load inside it on demand, Venn and Benchwarmers play their
  YouTube demos, and the ⧉ button pops it out into a draggable floating mini-player. Edit the `items` list in
  `main.js` to change what plays. Console: `play <name>`, `popout`.
- Sections follow an agent's anatomy: Ⅰ Memory · Ⅱ Skills · Ⅲ Dispatches · Ⅳ Research · Ⅴ Trail · Ⅵ Summon.

There is no framework and no build step: `index.html`, `styles.css` and `main.js` are the whole site.

## Run locally

```bash
python3 -m http.server 8000
```

## Deploy (GitHub Pages)

Settings → Pages → Source: *Deploy from a branch* → pick this branch, folder `/ (root)`.

## Editing content

All copy lives in `index.html`. Console answers live in the `projects` and `commands` objects in `main.js`.
The resume is served from `assets/Kevin-Jiang-Resume.pdf`.
