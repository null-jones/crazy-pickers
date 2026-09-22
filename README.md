# Crazy Pickers

Fifteen stupid ways to decide who talks first in standup. Each one is a 3D scene
with sound. No build step, no dependencies, no network.

**[Open them →](https://elliej.dev/crazy-pickers/)**

## The pickers

| | | |
|---|---|---|
| 🚗 | **Crash Test Standup** | A car with a name on its plate hits a wall marked DAILY STANDUP, watched by a crowd |
| 🐈 | **Hairball Roulette** | The office cat coughs up a name onto a nice rug |
| 🚽 | **Toilet of Destiny** | Everyone in the bowl; last one floating speaks |
| 🌋 | **Volcano Sacrifice** | Names carved in stone, thrown in. It spits one back |
| 🕹️ | **The Claw Decides** | An arcade claw gripping at 4% of advertised strength |
| 🦈 | **Shark Tank** | The team is on surfboards. Something below has an opinion |
| 🛸 | **Alien Abduction** | Your colleagues are cows. The saucer takes one |
| 🔮 | **Standup Séance** | A ouija planchette spells the name out, letter by letter |
| 🚀 | **Launch Failure** | Everyone gets a rocket. Most will not be fine |
| 📟 | **Microwave Meltdown** | Names in foil, twelve seconds, one legible survivor |
| 🧟 | **Zombie Outbreak** | A supermarket car park is overrun. Last one uninfected has the floor |
| ⚾ | **Foul Ball** | One swing, one fan in the stands, one very sore head |
| 🦖 | **Kaiju Rampage** | A city of named buildings. A lizard from the harbour spares one, then roars at it |
| 🏰 | **Cow Trebuchet** | Named cows flung at a castle. All fall short except the one that goes through the gate |
| 🐦 | **Pigeon Strike** | The team on park benches. Two near misses, one direct hit |

## Names

Edit the roster on the home page, or from the **Names** button in any picker.
It's kept in `localStorage` and shared by every picker.

- **No repeats** is on by default: everyone goes once before anyone goes twice.
  A pick only counts once its animation finishes, so a reload mid-run doesn't
  burn it. The picker pages show how many are still to go.
- `?names=Ada,Grace,Linus` overrides the list for a single page load without
  touching the saved roster or its cycle.
- Duplicate names are collapsed (case-insensitively).

Space or Enter runs a picker, and re-runs it once a result is up. Esc (or a
click outside the card) hides the result so you can look at the scene. Each
picker has a mute toggle and a volume slider; both are remembered.
`prefers-reduced-motion` turns off the camera shake and the slam-in text.

## Running it locally

Open `index.html`.

If you're editing, serve it instead — browsers cache `shared/*.js` hard enough
that changes look like they did nothing. `serve.py` sends `no-store`:

```sh
python3 serve.py     # http://localhost:4173
```

## Layout

```
index.html              home page: 3D background, card grid, roster editor
pickers/*.html          one self-contained scene each
shared/pickers.js       the list of pickers: key, title, colours, blurb
shared/base.css         top bar, GO button, captions, result card, drawer
shared/app.js           Picker.init() — wires that chrome to a picker's run()
shared/roster.js        the shared name list and no-repeat cycle
shared/sfx.js           every sound, synthesised from WebAudio primitives
shared/three-kit.js     stage and render loop, promise tweens, name textures,
                        floating labels, camera shake, chase camera, shader
                        pre-warm, debris and smoke
shared/people.js        low-poly people: idle, run, startle, shamble, cheer,
                        knocked, and a hands-off `pose` mode for scripted moves
assets/                 og.png (link preview) and favicon.png, both generated
tools/og-builder.html   renders the characters into that collage
tools/qa.html           runs every picker and writes contact sheets to qa/
vendor/three.global.js  three.js r160 (MIT)
serve.py                static server that refuses to cache
```

There are no image or audio assets. Sounds are built from oscillators and noise
buffers; every plate, sign and label is drawn into a `<canvas>` at runtime.

## Adding a picker

Copy any file in `pickers/` and add an entry to `shared/pickers.js` — that
gives it a card on the home page and its title and colours. Keep the
`<div class="boot">` loading screen at the top of `<body>`; `Picker.init`
removes it once the scene is built. The page itself is always the same shape:

```js
const st = Kit.stage({ fov: 50 });   // renderer, scene, camera rig, loop
// ...build the scene...

Picker.init({
  key: 'whatever-happens',           // matches shared/pickers.js
  tagline: 'One line, sold to the audience.',
  goLabel: 'Do the thing',
  verdict: n => `${n} goes first.`,
  stinger: () => SFX.gong(),         // the sound when the result appears
  hold: 1100,                        // ms to sit on the payoff before the banner
  prewarm: [materialsMadeLater],     // see below
  run: async (winner, api) => { /* animate; winner is already decided */ },
  reset: () => { /* put the scene back for a second run */ }
});
```

`run()` gets the winner up front, so the animation can cheat outrageously to
land on it. When the promise resolves, the chrome shows the result card and
commits the pick. The result is a lower-third banner, so frame the final shot
with the payoff in the upper two thirds.

Names are the one thing that must always be readable. `Kit.label(st, name)`
gives a floating name tag that never shrinks below a readable size on screen,
with `highlight()`, `dim()` and `retire()` for the story beats. If your scene
lays names out in a ring or a row, derive the spacing from `names.length` —
rosters of twenty happen.

Add `?debug=1` to any picker URL to get the stage as `window.__stage`.

Things that will bite you:

- **Never add or hide a light mid-run.** The light count is baked into every
  shader, so changing it recompiles all of them: that was a one-second freeze
  at the volcano's eruption. Create runtime lights up front at intensity 0 and
  turn them up. Hiding a group hides the lights inside it too, so hide its
  meshes instead. Materials that first appear mid-run (debris, droplets) go in
  `prewarm` so they compile behind the loading screen.
- **Scripted characters need `mode = 'pose'`.** In `idle` the people rig
  re-poses every limb every frame, and will silently erase your animation.
- `st.look(pos, target)` cuts instantly. That's fine inside a tween, but calling
  it from a loop makes the camera hop. Use `Kit.chase(st, { rate })` and
  `cam.to(pos, target)` for anything driven by discrete events.
- Cameras look down `-Z` but `Object3D.lookAt` aims `+Z` at its target, so the
  rig builds its orientation with `Matrix4.lookAt`. If you roll your own and
  every shot points backwards, that's why.

## Checking your work

`tools/qa.html` runs each picker at 1280×720 with a throwaway roster (your
saved one is left alone), grabs a frame every second, and reports console
errors, run length and the worst frame hitch. Contact sheets land in `qa/`.

```sh
python3 serve.py
open "http://localhost:4173/tools/qa.html?auto=1"            # all of them
open "http://localhost:4173/tools/qa.html?only=volcano&names=20"
```

Add `?shim=1` if the page is in a background tab or embedded pane, which
throttle `requestAnimationFrame` and make the timings meaningless.

## Link preview

Slack, Google and the rest read the Open Graph tags on every page, all pointing
at `assets/og.png`. It's a sticker collage rendered from the actual 3D models,
not a screenshot. To regenerate it after changing a character:

```sh
python3 serve.py
open http://localhost:4173/tools/og-builder.html   # press the button
```

The dev server accepts the PNGs back over `POST /__save` and writes them into
`assets/`. Commit the result.

## three.js

`vendor/three.global.js` is three.js r160, MIT, wrapped into a classic script
that sets `window.THREE`. The stock build is ESM, which won't load over
`file://`, and "just open the file" was worth keeping.
