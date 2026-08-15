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

All three private on GitHub under JetDial. 436 checks pass
(`node tests/run-tests.js`).

## Four tools, written in Plain

Not demonstrations - things you would use, written in the language they are
for. Each writes its output **as Plain**, so there is no file format to agree
on and nothing to import.

```bash
plain play examples/level-editor    # click to place, S writes the level
plain play examples/sprite-editor   # paint 16x16, S writes the picture
plain play examples/film-editor     # a timeline, S writes the film
plain play examples/site-builder    # a page, S writes the site
```

And one world to look at rather than use:

```bash
plain play examples/skins.plain           # pictures on things, in 3D
```

A program can be a **folder** too: the door is `main.plain`, everything else
arrives through `use`, and pictures and models live beside them. `plain new
game` makes one; stonefall and all four tools are shaped like this now.

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

**3D:** a coloured sun, a lamp with a place, haze · picking (what is under
the mouse) · a first person camera · **pictures on things**, projected in
the shader from three directions so the shapes need no texture corners ·
**shadows cast by things**, a real depth pass from the sun, off unless asked
for (`let the sun cast shadows`).

**Other human languages:** a program saying `en español` or `en français` on
its first line is written in that language, whole. Token-level translation
in `src/languages.js`, longest match first ("por cada" → "for each",
"no es" → "is not"), names left alone, any English word still working. A
language is a dictionary, not code.

**Models:** `make statue be a model "stone.obj" at ... sized 3` - wavefront
obj, triangulated, centred and scaled into the unit box, flat normals worked
out when the file names none, fetched once however many things wear it, and
not drawn at all until it arrives. Stonefall's standing stone is one.

**The flagship:** `examples/stonefall` - a folder project now - a textured,
shadowed 3D game
in one file: three patrolling wardens, seven relics, hearts, sprint and
breath, a lamp-lit gate, title, win and loss. Played end to end in a real
browser by driving frames.

**The language itself:** bytes · asking without waiting · toolkits (calling C
through WebAssembly) · room (memory with a size and no address) · days ·
sets · list slicing and pages · sorting by a field · checking its own work ·
`the key pressed` · warnings for names that are already words.

**Video:** crossfades, speed, splitting, drifting, colour.
**Web:** rows, cards, buttons, page descriptions.

Every one of those is in `LANGUAGE.md` and taught in the course.

**Pictures, inside them:** `the colour at $x , $y of the picture` ·
`the width/height of the picture` · `save $colours as the picture $file
sized $w by $h` - a real PNG codec in the terminal, the canvas in a
browser, round-tripped in the suite by a Plain program reading back the
checkerboard it wrote.

## What the game gained

Three modes (free-for-all, capture the flag, last-one-flying with a closing
ring) · airmash's flight model, fire rates and energy costs to the digit ·
powerups with their real rules · repel · terrain that eats missiles and
bounces planes · solid walls · aces · three chat channels · spectating with
following · spendable upgrades · flag dropping · a front screen · and a
client whose screen carries the same furniture as theirs.

Their ping loop: PING every five seconds to binary clients, the PONG
timed, PING_RESULT told back - measured at 1534 ms against a stand-in that
dawdled on purpose. The crown on whoever leads, and FROM Server marking
what the server itself says.

**And a second door speaking airmash's binary protocol, both directions** —
see `INTEROP.md` for exactly what crosses it and what does not.

---

## Still open, in the order worth taking

1. **Struct layout - done.** Things-with-fields went from 129x off
   hand-written Rust (on a field-dense loop) to 1.05x: a proven list of
   one kind becomes a Vec of a real struct. `PERFORMANCE.md` has the
   numbers and the shape of the proof.
2. **Generators as lazy lists · workers · the embedded runtime** - the
   remaining language items, each a real piece of design work.
3. **Skyward's old names - done.** All twenty-one renamed scope by scope;
   the game-run gate caught three breaks the parse check could not see
   (a straggler line past a range, a phrase caught by a local's rename,
   an interpolation inside a string). Zero warnings, zero errors now.
4. **The Unity project's one open piece** - wrapping-map collisions (ghost
   objects in the broadphase). A different repository, the hottest loop in
   that server, and by its own handoff note it deserves a full session.
3. Generators as lazy lists · workers · the embedded runtime.
4. Airmash's remaining screen: country flags, crowns, level badges, ping,
   mute and settings, `FROM Server` messages.
5. Public-server things: moderation, accounts, votemute.

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

**The day rustc arrived, four bugs surfaced.** The Rust backend "passed"
for months while no Rust compiler, C compiler or Lua were on the machine to
try what it wrote. The first real compile found unboxed counters handed out
as boxed Values, "take 1 from n" writing a Value into an f64 - and "next"
inside the fast counting loop emitting a continue that jumped over the
increment at the bottom: not a wrong answer, a program that never ends. The
increment now sits at the top of a loop{}. A test that skips quietly is a
test that does not exist; all eleven targets now build and run in the suite.

**"repeat with n from 1 to 0" counts DOWN.** It does not do nothing - it
runs with n as 1 and then as 0, and item 0 of a list is nothing. That broke
the film editor for an hour and looked exactly like a shadowed name, which
is why guessing at a cause is worse than spending two minutes proving one:
one four-line program settled it.
