# Crazy Pickers

Ten stupid ways to decide who talks first in standup. Each one is a 3D scene
with sound. No build step, no dependencies, no network.

**[Open them →](https://null-jones.github.io/crazy-pickers/)**

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

## Names

Edit the roster on the home page, or from the **Names** button in any picker.
It's kept in `localStorage` and shared by all ten.

- **No repeats** is on by default: everyone goes once before anyone goes twice.
- `?names=Ada,Grace,Linus` overrides the list for a single page load.

Space or Enter runs a picker (and re-runs it once a result is up). Esc closes
the result. Sound is on by default, with a mute toggle in each picker.

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
shared/base.css         top bar, GO button, captions, result card, drawer
shared/app.js           Picker.init() — wires that chrome to a picker's run()
shared/roster.js        the shared name list and no-repeat cycle
shared/sfx.js           every sound, synthesised from WebAudio primitives
shared/three-kit.js     stage and render loop, promise tweens, name textures,
                        camera shake, chase camera, debris and smoke
vendor/three.global.js  three.js r160 (MIT)
serve.py                static server that refuses to cache
```

There are no image or audio assets. Sounds are built from oscillators and noise
buffers; every plate, sign and label is drawn into a `<canvas>` at runtime.

## Adding a picker

Copy any file in `pickers/` and add it to the `PICKERS` array in `index.html`.
The shape is always:

```js
const st = Kit.stage({ fov: 50 });   // renderer, scene, camera rig, loop
// ...build the scene...

Picker.init({
  title: 'Whatever Happens',
  accent: '#ff2e6d',
  tagline: 'One line, sold to the audience.',
  goLabel: 'Do the thing',
  verdict: n => `${n} goes first.`,
  run: async (winner, api) => { /* animate; winner is already decided */ },
  reset: () => { /* put the scene back for a second run */ }
});
```

`run()` gets the winner up front, so the animation can cheat outrageously to
land on it. When the promise resolves, the chrome shows the result card.

Two things that will bite you:

- `st.look(pos, target)` cuts instantly. That's fine inside a tween, but calling
  it from a loop makes the camera hop. Use `Kit.chase(st, { rate })` and
  `cam.to(pos, target)` for anything driven by discrete events.
- Cameras look down `-Z` but `Object3D.lookAt` aims `+Z` at its target, so the
  rig builds its orientation with `Matrix4.lookAt`. If you roll your own and
  every shot points backwards, that's why.

## three.js

`vendor/three.global.js` is three.js r160, MIT, wrapped into a classic script
that sets `window.THREE`. The stock build is ESM, which won't load over
`file://`, and "just open the file" was worth keeping.
