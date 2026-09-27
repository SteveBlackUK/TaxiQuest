# Taxi Quest

A first-person RPG in the browser: you ride flying taxis driven by animals and help with their favours. It's plain ES modules and a vendored three.js with no build step, published at https://one-shot-games.com/taxiquest/. The owner's son plays it, so keep jokes silly and cartoonish, with no swearing and nothing gory, even in the bank heist.

## Running and testing

`python3 -m http.server 8000`, then open http://localhost:8000. Opening `index.html` from disk fails because browsers block module imports over `file://`.

URL parameters, read in `src/main.js` and `src/story/story.js`:

| Parameter | Effect |
| --- | --- |
| `?autostart` | Clicks the start button, which also unlocks audio |
| `?chapter=N` | Resets the save and jumps to chapter N (0 prologue, 1 Carl, 2 Sheila, 3 Gary, 4 Lenny, 5 finale); gives Bounce Boots from chapter 3 |
| `?level=N` | With `chapter`, sets all three stats to N and credits to 200 |
| `?autoplay=0.15` | Advances dialogue after that many seconds, picks the first unlocked choice and closes modals |
| `?timescale=3` | Runs the game clock three times faster |
| `?lowfx` | Turns bloom off and renders at a lower resolution |
| `?view=city`, `cab`, `taxi`, `cast`, `portraits` | Debug scenes instead of the story (`cab` takes `&who=sheila` and so on) |

Everything was tested in headless Chromium through Playwright, which works with software WebGL: launch with `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. `window.game` is the whole game, so a test can read `game.state.d` (credits, xp, chapter, ratings, inventory, flags), move the player with `game.foot`, and wait on conditions such as `game.taxi.state.doorTarget === 1`. A useful run per chapter is `?autostart&chapter=N&autoplay=0.15&timescale=3&lowfx`, with scripted input for the minigames, checked for zero `pageerror` events and the expected `game.state.d` at the end. The minigames need real input, so autoplay alone won't finish a chapter.

Headless tests say nothing about frame rate on a real GPU, how the mouse feels, or the audio mix. Say so when reporting a change that affects them.

## Layout

```
index.html        page shell, HUD and dialogue markup, import map
css/style.css     all UI styling
src/main.js       boot, URL parameters, debug views
src/game.js       renderer, bloom, frame loop, systems, portraits, wait/until
src/core/         input, audio synth, UI, save state, textures, geometry helpers, touch controls
src/world/        city layout and generation, sky, traffic, taxi, characters, sky whale
src/play/         ride (autopilot), foot (walking), drive (flying), chase (shooting), dialogue, particles
src/places/       Taxi Rank 7, McSnackers, carnival, bank, chapel, spire; kit.js is the shared builder
src/story/        one async function per chapter, plus hub, common helpers and joyride
vendor/three-r186 three.js r186 with the bloom and output passes
```

## How the pieces fit

The frame loop in `game.js` updates every object passed to `game.addSystem({ update(dt) {} })`. `dt` is multiplied by `timeScale` and by the Tab fast-forward.

Story code is plain async functions. `kit(game)` in `src/story/common.js` returns shortcuts: `say(id, ...lines)`, `choose(id, text, choices)`, `wait(seconds)`, plus `ride`, `foot`, `drive`, `chase`, `st` (state), `ui` and `P` (places). `game.until(() => condition)` waits for a condition. A choice can be gated with `req: { charm: 2 }`, `item: 'floss'` or `cost: 30`, and shows as locked when the player doesn't meet it. `common.js` also has the shared fare beats: `taxiArrives`, `boardAtDock`, `exitTaxi`, `dropAtRank`, `fareComplete` and `giveItem`.

`Ride` flies a cab along streets using a turn-penalised Dijkstra search over intersections, smoothed with Catmull-Rom. The main calls are `goTo(place)`, `depart(place)`, `cruise()`, `moveTo(pos, yaw)`, `hover()`, `teleport(pos, yaw)` and `lookAtWorld(point)`. Cruising height is 72 m (`CRUISE_ALT`).

Places are built with the `Place` class in `src/places/kit.js`, using `box`, `disc`, `interact`, `sign`, `railing` and `addActor`, plus `pad()` for launch pads. `place.freeze()` merges static meshes by material to cut draw calls. Anything animated or toggled later must have `userData.keep = true`, or it gets merged and stops moving. The story hides places more than 640 m from the camera unless they set `alwaysVisible`.

Characters are defined in `CAST` in `src/world/characters.js` and built from primitives with toon materials by `createCharacter(id, { standing })`. Dialogue portraits are rendered from the same models at startup. When a new character's portrait is framed badly, adjust its camera scale in `renderPortraits` in `game.js`.

Saves live in `localStorage` under `taxiquest.save.v1`, with settings under `taxiquest.settings.v1` and a flag `taxiquest.beaten`. Items are listed in `ITEMS` and the XP thresholds in `LEVELS`, both in `src/core/state.js`.

## Keep it working on one-shot-games.com

- Every path stays relative (`src/main.js`, never `/src/main.js`). The game is served from `/taxiquest/`.
- If three.js is upgraded, rename the folder (for example `vendor/three-r190`) and update the import map in `index.html`. The site caches `vendor/<name>-<version>/` folders for a year, so changing files in place would leave players with a mix of old and new code.
- New `localStorage` keys start with `taxiquest.`. Every game on the site shares one origin.
- The deploy workflow uploads only what's listed in `FILES` in `.github/workflows/deploy.yml`. A new top-level folder has to be added there.
- `game.json` is the game's card on the landing page and `thumb.jpg` (1200×630) is its card image and link preview. The `made.model` field is left for the owner to fill in.

Deploying is manual: Actions, then **Deploy to One Shot Games**, then Run workflow. The server side is documented in the one-shot-games repo's SETUP.md.

## Things that went wrong before

- `sign()` defaults to `FrontSide`. Two double-sided signs placed back to back showed mirrored text.
- Near-white unlit materials (eyes, teeth, checker stripes) bloom into glowing blobs. Use slightly darker colours or toon materials.
- The two point lights inside the cab (`src/world/taxi.js`) use decay 0 and intensities under 1. Brighter or decaying lights made a hotspot, and a dome light made a glare spot in the middle of the view.
- Draw calls went from about 1,041 to about 289 through `freeze()`, instanced balloons and distance culling. Check `game.renderer.info.render.calls` after adding scenery.
- The bank lobby is public. Guards only notice the player in restricted areas (`P.isRestricted`) or while carrying loot, so a test that teleports the player can trip the alarm by landing in a guard's view.
- Browsers refuse to re-lock the pointer for about a second after it's released, so `input.js` waits 1.1 s before trying again.
- Touch control visibility in `css/style.css` uses `!important`, because a specificity tie let the buttons show on the title screen.
- The drive course crashed after the last checkpoint until it checked `idx < points.length`.
