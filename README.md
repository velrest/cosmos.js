Feeld the cosmic energy

# cosmos.js

<img src="logo.svg" alt="cosmos.js logo" width="96" />

A plain JS data framework where your data lives on real stars. The real sky above you decides what you can read, your cosmic energy decides what you can do, and everything you save arrives late.

**GitHub page:** https://velrest.github.io/cosmos.js/

**Source:** https://github.com/velrest/cosmos.js

**This is not real security.** Every rule runs in the browser, and anyone can bypass them with devtools, a fake location, or edited storage. Use it for fun.

## Usage

There are no dependencies and no build step.

```js
import { initializeCosmos, onCosmicShift, gazeIntoStar, sendEnergyToStar } from "./src/index.js";

await initializeCosmos({ Sirius: [{ name: "Ada" }] });

onCosmicShift(() => {
  const people = gazeIntoStar("Sirius");
  document.querySelector("#people").innerHTML = people
    ? `<ul>${people.map((p) => `<li>${p.name}</li>`).join("")}</ul>`
    : "";
});

sendEnergyToStar("Sirius", [{ name: "Ada" }, { name: "Grace" }]); // Needs Aware or higher, then arrives about 300ms later
```

## API

| Function | What it does |
|---|---|
| `await initializeCosmos(initialData, options)` | Starts everything and injects the energy prompt. `initialData` is as old as the Big Bang, so it's visible immediately. |
| `gazeIntoStar(star)` | Live data of one star |
| `gazeIntoStar()` | Live data of a random unnamed star |
| `gazeIntoConstellation(constellation)` | Live data of the stars in a constellation, by name or code |
| `gazeIntoSky()` | Live data of all readable stars that hold data |
| `scanHeavens()` | All stars in the sky at your location, data or not, brightest first. Each has `name`, `ra`, `dec`, `mag`, `ly`, `con`, `readable`, which says if your level can read it, and `travelMs`, how long a save takes to arrive at your current energy. |
| `sendEnergyToStar(star, data)` | Sends data to a star, and returns what you can currently see |
| `sendEnergyToStar(data)` | Sends data to a random unnamed star |
| `sendEnergyToConstellations({ Orion: { Rigel: data } })` | Sends data to many stars |
| `gazeIntoSelf()` | Your energy, from 0 to 100 |
| `renderCosmicPlane(element)` | Shows the admin star map in an element, for Ascended users only. Clicking a star shows its stored data and saves on their way. Returns a stop function. |
| `channelLocation()` | The location in use, `{ lat, lon, source }`, where `source` is `simulated`, `real`, or `fallback` |
| `pierceVeil()` | For Ascended users: all stars in your sky with `altitude`, `azimuth`, `holdsData`, and `pendingCount`, plus the sun's position |
| `pierceStarVeil(star)` | For Ascended users: one visible star's stored data, with saves on their way and when they arrive |
| `onCosmicShift(callback)` | Runs the callback now and after each change you could see. Returns a stop function. |

Blocked calls return `undefined`. An empty readable star returns `{}`. Star data must be a JSON object or array.

Options for `initializeCosmos`:

- `simulatedLocation: { lat, lon }` replaces your real location.
- `fallbackLocation: { lat, lon }` is used only while no real location is known, whether current or saved from an earlier visit. It isn't saved.
- `revealFates: true` marks each sign's fate in the prompt, for testing.
- `ascendedPrompts: true` lets Ascended users open the prompt themselves, so they can lower their energy, for testing.

Live objects update by themselves, but nested values are copies. `sirius.meta.x` is always current, while a held `const meta = sirius.meta` isn't. A held object also keeps the type it was read with, so read again if a star switches between object and array.

Unnamed stars have IDs such as `HYG 12345`, which `gazeIntoSky()` shows and `gazeIntoStar()` accepts.

## Rules

A star is readable only while it's above your horizon and at least 15° from the sun.

| Level | Energy | See | Edit |
|---|---|---|---|
| Blinded | 0 to 9 | Nothing | Nothing |
| Hazed | 10 to 24 | Brightest stars | Nothing |
| Unconnected | 25 to 49 | Everything | Nothing |
| Aware | 50 to 74 | Everything | Brightest stars |
| Connected | 75 to 100 | Everything | Everything |
| Ascended | 75 to 100, plus 3 right picks in a row | Everything | Everything, plus the star map |

"Everything" means everything in your current sky. "Brightest" means magnitude 1.5 or brighter. New users start at 35 energy.

The ✦ button shows 3 star signs at random: one right (+15), one bad (-10), and one neutral (-2). Anything but a right pick resets your streak and loses Ascended. Ascended users can't ask for a prompt. They get one every 30 minutes, with 60 seconds to answer.

Data travels at energyspeed. At 35 energy, Proxima Centauri takes 100ms, Sirius about 320ms, Betelgeuse about 5 minutes, and stars 5,000 light years or farther take 3 hours. At 100 energy, data is 4x faster. At 0 energy, it's about 2x slower.

## Demo

Run `python3 -m http.server` or any other static server in the project folder, then open `/demo/`. Browsers block `demo/index.html` when it's opened directly from disk, but `gist/index.html` works that way. A test mode toggle, on by default, controls the demo's testing features: each sign shows its fate, Ascended users can still open the prompt to lower their energy, and a small globe picks your simulated location. With it off, the demo behaves like a real app: it uses your real location, and the globe only shows it.

To host it as a gist, run `node scripts/forge-gist.js` and put the files from `gist/` in a gist. Gists don't serve pages themselves, so open `index.html` through a gist viewer such as [githack](https://raw.githack.com/).

## Tests

```sh
npm test
npm run test:browser
```

The browser tests need `chromium` on your `PATH`.

## License

Copyright (C) 2026 Jonas Cosandey. Licensed under the [GNU General Public License v3.0](LICENSE).

The star catalog comes from the HYG Database, and the land outlines from Natural Earth. See [NOTICE.md](NOTICE.md) for their credits and licenses.
