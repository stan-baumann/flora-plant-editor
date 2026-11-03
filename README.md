# Flora Plant Editor

**English** · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md)

A standalone web app for designing plants for [Flora](https://github.com/jaseknighter/flora) on monome norns, by drawing them.
You draw the shape and the app writes the L-system for you: axiom, rules, growth stages and melody.
It shows a norns preview, plays the melody and exports a ready-to-use `.flora` file.

It is plain HTML, CSS and JavaScript: `index.html` plus the `css/` and `js/` folders. There is nothing to install or build, and it works offline.

## Quick start

1. Open `index.html` in a current browser (Chrome, Edge, Firefox or Safari), e.g. by double-clicking it.
2. With **✏️ Draw**, drag a line from the red start point. It snaps to the directions of the chosen angle.
3. Pick **Symmetry** (e.g. 6-fold) and **Mirror** to build a snowflake from a single arm.
4. Press **▶ Play** to hear the melody, and use the **Show up to generation** slider to watch the plant grow.
5. Click **Save (.flora)** and copy the file to your norns (see [Using the plant on norns](#using-the-plant-on-norns)).

Use the 🌐 menu in the top right to switch between English, German, Spanish and French.

## Hosting on the web

The app is a static page with `index.html` as its entry point, so any web server or static host can serve it
(e.g. GitHub Pages, Netlify or your own server). Upload `index.html` together with the `css/` and `js/` folders; the README files are optional.
There is no server-side code, and the app loads nothing from other servers.

- **HTTPS** is recommended: there the app copies with the browser's clipboard interface. On plain HTTP it falls back to an older copy method; everything else works the same.
- What the app remembers is stored in each visitor's own browser, separately for every web address.

## Project structure

| Path | Contents |
|---|---|
| `index.html` | Page layout, entry point |
| `css/style.css` | Styles (dark theme, layout) |
| `js/i18n.js` | Translations (en, de, es, fr) and `t()` |
| `js/flora-core.js` | Flora simulation (L-system, turtle, pitch), `.flora` format and the compiler from drawing to code – no user-interface code |
| `js/examples.js` | The ten built-in snowflakes |
| `js/app.js` | User interface: state, editor, preview, sound, files and export |

The scripts are loaded as plain scripts (not ES modules) in this order, so the app also runs when `index.html` is opened directly from disk.

## Features

### Drawing
- **Grid:** angles of 30°, 45°, 60° and 90°. Lines snap to the allowed directions and are split into turtle steps.
- **Symmetry:** 2- to 12-fold, depending on the angle.
- **Mirror:** adds every new line mirrored across the vertical axis.
- **Line types:**
  - ♪ **Note** (`F`): draws and plays a note.
  - — **Line** (`G`): draws with a rest.
  - ┄ **Jump** (`f`): moves invisibly, e.g. from the centre to a ring.
- **Tools:** Draw, Select, Apply (type and generation), Erase. Undo/redo with Ctrl+Z / Ctrl+Y.
- **Navigation:** mouse wheel zooms, right mouse button pans.

### Growth
- **Generations:** every line has a generation, shown by its colour. Generation 0 is there right away, higher ones grow in one after another.
- **Rules:** the app turns this into rules automatically. Later parts sit behind helper letters that grow one stage per generation.
- **Slider:** “Show up to generation” shows each stage in the editor, in the preview and in the melody.

### Melody
- **Pitches:** each note line shows the scale step (1–24) that Flora would play there.
- **Fixed pitch:** select a note line with **↖ Select** and set a **fixed pitch**. The code then gets shape-neutral symbols (`[]`, `+-`, `|---`) that set exactly that step.
- **Symmetry copies** always sound like the drawn arm.
- **Same notes:** with this option, mirror images play the same notes as their original.
- **Playback** in the browser with a choice of scale, root note, Flora's *note scalar* and note length. The note being played lights up in the drawing and in the preview.

### Code
- **Live code:** axiom, rules, angle, step length, start point and generations are shown next to the drawing and update live.
- **Editing by hand:** you can edit the code yourself. The drawing is then no longer linked, and the app tells you so.
- **Build drawing from code:** turns the lines of any code (e.g. an example) into a drawing.
- **Warnings:** a table shows characters, notes and rests for each generation. The app warns about sentences longer than 300 characters, notes outside the scale and invalid rules.

### Export
- **`.flora` file:** for Flora's nursery. The drawing is stored in the file as a Lua comment, so loading the file restores the drawing exactly. Flora ignores the comment.
- **maiden command:** creates the file directly on the norns.
- **Catalog entry:** for `lib/gardens/garden_catalog_default.lua`.
- **Examples:** ten snowflakes come built in, available under **Load example…**.

## Using the plant on norns

1. Copy the `.flora` file to `dust/data/flora/nursery/` on your norns.
   - Windows: `\\norns.local\dust` in Explorer (user `we`).
   - macOS: Finder → Go → Connect to Server → `smb://norns.local/dust`.
   - Or paste the **maiden command** into the maiden REPL. It creates the file for you.
2. In Flora: **K1 → PARAMETERS → EDIT → GARDENING → ADD PLANT TO GARDEN** and choose the file.
3. On the plant page, hold **K1** and turn **E2** to find the plant. **K2 / K3** step through its generations.

## How the app imitates Flora

The preview and the melody follow Flora's own code (`lib/l_system.lua`, `lib/turtle.lua`, `lib/plant_sounds.lua`):

- **Rules:** single letters. Each generation is cut to 300 characters (`MAX_SENTENCE_LENGTH`).
- **Turtle symbols:** `F` draws and plays a note, `G` draws with a rest, `f` moves without drawing, `+`/`-` turn by the angle, `|` turns 180°, `[`/`]` save and restore position and heading.
- **Pitch:**
  - `+` and `-` change the pitch by `ceil(note scalar × angle in radians)` scale steps. With the default note scalar of 3 that is +4/−3 at 60° and +2/−1 at 30°.
  - `]` resets the pitch to step 12 of 24, because `[` saves no pitch in Flora.
- **Display:** Flora shows plant 1 shifted 32 px to the left. The preview does the same and also shows plant 2 dimmed.

## Limitations

- **Sound:** the browser sound is only an approximation of Flora's engine.
- **Scale numbers:** they are assumed to follow the order of norns' `MusicUtil` (5 = Dorian).
- **Lines that disappear while growing**, e.g. a tip that moves outward, cannot be shown in a drawing. Imported code of this kind keeps only its final shape.
- **Character limit:** larger drawings, high symmetry and many fixed pitches cost characters. Watch the 300-character limit in the generation table.
- **Saving in the browser:** the app remembers your work in the browser, but only when the page is opened normally (not in embedded preview windows). For anything you want to keep, save a `.flora` file.

## Self-test

Open the browser console and run `floraSelfTest()`. It turns each of the ten built-in snowflakes into a drawing, generates code from it again, and checks that the final shape is identical.
