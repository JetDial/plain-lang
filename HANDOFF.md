# Where this got to

One long session, three repositories, written down so none of it has to be
rediscovered. Everything below was measured or run, not assumed.

---

## The three repositories

| | |
|---|---|
| **`C:\Users\user\Coding lang`** | the language, engines, translator, course (`main`) |
| **`C:\Users\user\skyward-server`** | the game server, in Plain (`master`) |
| **`C:\Users\user\skyward-client`** | the browser half, in Plain (`master`) |

All three private on GitHub under JetDial. 420 checks pass
(`node tests/run-tests.js`).

## Four tools, written in Plain

Not demonstrations - things you would use, written in the language they are
for. Each writes its output **as Plain**, so there is no file format to agree
on and nothing to import.

```bash
plain play examples/level-editor.plain    # click to place, S writes the level
plain play examples/sprite-editor.plain   # paint 16x16, S writes the picture
plain play examples/film-editor.plain     # a timeline, S writes the film
plain play examples/site-builder.plain    # a page, S writes the site
```

## Opening it

```bash
plain desk        # everything in this folder, in one page
plain learn       # the course
plain run airdoor.plain      # the game: both protocols on 3040
plain play client.plain      # the browser half
```

---

## What the language gained

**Drawing and games:** the view (a camera, so a game can be bigger than its
window) · scenes · bursts, slides, frame time · groups (one lot of things
meeting another) · arcs · shake · centred text · facing and fading ·
pictures, including one frame out of a sheet · a sound kit that needs no
files.

**3D:** shadows, a coloured sun, a lamp with a place, haze · picking (what is
under the mouse) · a first person camera.

**The language itself:** bytes · asking without waiting · toolkits (calling C
through WebAssembly) · room (memory with a size and no address) · days ·
sets · list slicing and pages · sorting by a field · checking its own work ·
`the key pressed` · warnings for names that are already words.

**Video:** crossfades, speed, splitting, drifting, colour.
**Web:** rows, cards, buttons, page descriptions.

Every one of those is in `LANGUAGE.md` and taught in the course.

## What the game gained

Three modes (free-for-all, capture the flag, last-one-flying with a closing
ring) · airmash's flight model, fire rates and energy costs to the digit ·
powerups with their real rules · repel · terrain that eats missiles and
bounces planes · solid walls · aces · three chat channels · spectating with
following · spendable upgrades · flag dropping · a front screen · and a
client whose screen carries the same furniture as theirs.

**And a second door speaking airmash's binary protocol, both directions** —
see `INTEROP.md` for exactly what crosses it and what does not.

---

## Still open, in the order worth taking

1. **3D textures**, then shadows cast, then loading a model. The most asked
   for and most visibly missing: a world of flat colours reads as a diagram.

   Looked at, not started, because it is bigger than it sounds. The meshes in
   `engines/world/render.js` carry positions and normals and **no texture
   coordinates at all**, so this is four jobs rather than one:

   - texture coordinates on `cubeMesh`, `sphereMesh`, `cylinderMesh` and
     `coneMesh`, or - much less work and nearly as good for built-in shapes -
     work them out in the shader from the world position and the normal,
     which needs no change to the meshes at all
   - a `sampler2D` in the fragment shader, and a flag for bodies without one
   - loading a picture into a GL texture, one per source, kept like the 2D
     side keeps its pictures
   - one sentence: `cover $body with the picture $source`

   Do the shader-side coordinates first. It is the version that can be tried
   in an afternoon, and if it looks right there is no reason to touch the
   meshes.
3. **Struct layout** — the only performance item the measurements support.
   See `PERFORMANCE.md`, which also says why cloning and field lookup were
   measured and rejected, so neither gets retried on how the code looks.
4. Generators as lazy lists · workers · the embedded runtime.
5. `drop` seen working end to end.
6. Airmash's remaining screen: country flags, crowns, level badges, ping,
   mute and settings, `FROM Server` messages.
7. Public-server things: moderation, accounts, votemute.

---

## What this session actually taught

**Names that are already words caused more bugs than anything else.** `key`,
`keys`, `kind`, `gap`, `clip`, `row`, `kept`, `next`, `show`, `from`, `note`.
None of them fail loudly. `keys of thing` quietly stops being your field and
becomes the names inside a thing, which is how a missile packet came to
report "no keys pressed" while the plane was visibly flying. `plain check`
now warns, **and I overrode that warning three times and was wrong every
time.** Treat it as a stop.

**An argument at the end of a line swallows the rest of it.** `if clearof
with hill and base and (...) is no` asks a different question than it reads
as. That one cost an entire sky of terrain — every hill silently rejected,
nothing failing. Work the answer onto a name of its own first.

**Watching beats reading.** Three problems were found from video frames that
reading their source never would have: the missile smoke is a cone rather
than a line, the name label sat on top of the aircraft, and their front menu
existed at all. There is an ffmpeg at
`C:\Program Files\SteelSeries\GG\apps\moments\ffmpeg.exe` — turn a recording
into frames and look at them.

**Check the source, not your memory.** I claimed airmash's minimap hides the
enemy team. It does not. I claimed three missiles a shot was theirs; it is
their inferno powerup. Both were corrected by opening the file.

**Measure before optimising.** Removing clones made things *slower*; a faster
field lookup changed nothing. Both are written down in `PERFORMANCE.md` with
their numbers so the next person does not spend a day on either.

**Restart the server before believing the test.** One result was reported
from a process that had never picked up the change.

**"repeat with n from 1 to 0" counts DOWN.** It does not do nothing - it
runs with n as 1 and then as 0, and item 0 of a list is nothing. That broke
the film editor for an hour and looked exactly like a shadowed name, which
is why guessing at a cause is worse than spending two minutes proving one:
one four-line program settled it.
