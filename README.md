# Taxi Quest

A first-person RPG for the browser about riding flying taxis in Neo-Serengeti, a neon sky city where every cab driver is a wild animal and every one of them needs a favor.

You arrive with 20 credits and a suitcase of socks. Doris the tortoise runs dispatch at Taxi Rank 7. Hail a cab, help the driver, get rated, earn tips and XP, level up, repeat.

## The fares

1. **Carl the Crocodile: One Snappy Meal, Hold the Regrets.** Carl hasn't eaten in forty years and the McSnackers robot screams whenever it sees his teeth, so you order for him. Memorize his order during the ride, click it on the drive-thru menu board, stop the Toy-O-Tron on the Robo-Gerald, then catch the food the robot throws at your window (and don't catch the hot sauce).
2. **Sheila the Kangaroo: Where's Kevin?** Her joey bounced out of her pouch at the Zero-G Carnival. Chase him across floating platforms in low gravity, ride the launch pads and carousel, and lure him with Space Floss. He gets tired if you keep after him. Other kids are not Kevin.
3. **Gary the Gorilla: The Big Banana Job.** Rob the Galactic Reserve Bank. The lobby is public, so act natural; everywhere else is staff only. Sneak past SecuriBots, find the vault keycard (or charm the teller into giving you the code), crouch under the lasers, grab the money bags and maybe the golden banana, then get back out past the guards with the loot. If the alarm trips you have about a minute. Then lean out the window and throw bananas at police drones during the getaway.
4. **Lenny the Sloth: Asleep at the Wheel.** Lenny is late for his own wedding and falls asleep mid-sentence. The cab nose-dives, you grab the wheel and fly a checkpoint course through the street canyons to the Cloud Chapel. Then catch the bouquet.
5. **The finale.** The robot-cat mayor is banning animal cabs at midnight. The whole gang picks you up in one taxi (Lenny rides on the roof). Survive a RoboCab dogfight (you can throw Kevin; he insists), climb the RoboCab Spire past laser sweepers to pull three override levers, then argue the mayor down using your stats, the items you collected, and the drivers who liked you.

After the ending you can take joyrides around the city and collect credit rings.

## RPG bits

- **Stats**: Charm, Nerve and Reflex. Level-ups give you a point to spend. Charm opens dialogue options and raises tips, Nerve makes guards slower to spot you, Reflex widens catch windows and speeds you up.
- **Stars**: each driver rates you 1 to 5 based on how the favor went and how you treated them. Ratings affect tips and who backs you up in the finale.
- **Items**: things you pick up along the way (Robo-Gerald, Bounce Boots, the golden banana, a wedding bouquet) come back later.
- **Vend-o-Matic**: spend tips on Space Floss and stat items at the rank.
- Progress saves automatically to your browser at the start of each fare.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look around, aim, steer when flying |
| W A S D | Walk, or fly when you're driving |
| Shift | Sprint, or boost when flying |
| Space / C | Jump / crouch, or fly up / down |
| E | Interact, advance dialogue |
| 1-4 | Pick dialogue choices |
| Left click | Throw, catch, press buttons |
| Right click | Throw Space Floss (or Kevin) |
| Tab (hold) | Fast-forward a ride once the talking is done |
| Esc | Pause |

On phones and tablets an on-screen stick and buttons appear: drag the right side of the screen to look, and tap to throw, catch or advance dialogue. Sound is fully synthesized, so turn it on.

## Running it

There is no build step. It's a static site with ES modules and a vendored copy of three.js, so any static file server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` straight from disk won't work because browsers block ES module imports over `file://`.

To host it on GitHub Pages, go to the repo's Settings, then Pages, choose "Deploy from a branch", pick the branch the game is on and the `/ (root)` folder, and save. The site appears at `https://<user>.github.io/TaxiQuest/` a minute or two later. Free GitHub accounts can only do this for public repos. The empty `.nojekyll` file tells Pages to serve the files as they are without running Jekyll.

## How it's built

- **three.js r186** (vendored in `vendor/three`), with UnrealBloom for the neon glow. The Graphics setting in the pause menu turns bloom off for slower machines.
- **The city** is procedural: a 14 by 14 block grid of instanced towers drawn with a custom window shader, merged neon sign atlases, 400 flying cars, searchlights, billboards and a sky dome.
- **Characters** are built from primitives with toon shading, and their dialogue portraits are rendered from the same models at startup.
- **Audio** is all WebAudio synthesis: a small step sequencer plays a different track per scene, and every honk, blip and banana splat is generated on the fly.
- **Autopilot** routes cabs through the street grid with a turn-penalized Dijkstra search and Catmull-Rom smoothing, so they stay inside the street canyons.
- **Story scripts** are plain async functions (`await say(...)`, `await ride.goTo(place)`), one file per fare in `src/story/`.

```
index.html          page shell, HUD and dialogue markup
css/style.css       UI styling
src/main.js         boot
src/game.js         renderer, loop, portraits
src/core/           input, audio synth, UI, RPG state, texture helpers
src/world/          city, sky, traffic, taxi, characters, grid layout
src/play/           ride (autopilot), foot (FPS), drive (flying), chase (shooter), dialogue, particles
src/places/         Taxi Rank 7, McSnackers, carnival, bank, chapel, spire
src/story/          hub, prologue, each fare, finale, joyride
```

URL parameters for testing: `?chapter=N` jumps to a fare (0 to 5), `?level=3` sets all stats to 3, `?autostart` skips the click-to-start screen.
