# Plain

A programming language you write the way you type a sentence — with a 2D and
3D game engine, a website designer, and a video editor built on top of it.

```plain
make score be 0
add 10 to score
show "Score: {score}"

if score is above 5
    show "That is a good score."
otherwise
    show "Keep going."
end
```

No semicolons, no curly braces, no `public static void`. Lines start with a
verb, blocks end with `end`, and indentation is yours to choose. Underneath it
has the things a grown-up language has: your own kinds of thing, actions used
as values, catching problems, and files that pull in other files.

---

## Getting started

You need [Node.js](https://nodejs.org) 18 or newer. Nothing else — Plain has
no dependencies and no build step.

```bash
node bin/plain.js run examples/hello.plain
```

To type `plain` instead of `node bin/plain.js`, link it once:

```bash
npm link
```

Then start something finished and change it:

```bash
plain make game space      # a 2D game with gravity, jumping and coins
plain make world moon      # a 3D world you walk around
plain make site notes      # a website you can design by dragging
plain make video holiday   # a video timeline you can trim and export
```

```bash
plain run <file>     run it in the terminal
plain play <file>    open it in the browser
plain edit <file>    open the designer or the video studio
plain build <file>   write HTML you can publish        (--out folder)
plain check <file>   look for mistakes without running
plain words          list every sentence Plain understands
```

---

## The language in two minutes

```plain
# Names hold values.
make name be "Ada"
make age be 36
show "{name} is {age}"          # text can hold values in {curly braces}

# Questions read like questions.
if age is at least 18
    show "grown up"
otherwise
    show "not yet"
end

# Loops say what they do.
repeat 3 times
    show "again"
end

repeat with n from 1 to 5
    show n times n
end

# Lists count from 1, because that is how people count.
make shopping be a list of "bread", "milk"
add "apples" to shopping
show item 1 of shopping         # bread

for each item in shopping
    show " - " joined with item
end

# Actions of your own read like the sentences that use them.
to greet with person
    give back "Hello, " joined with person
end

show greet with "world"
```

And when a program grows up:

```plain
# Your own kinds of thing, with actions attached.
a kind called Animal
    has name
    has sound be "..."
    to speak
        show "{name of me} says {sound of me}"
    end
end

a kind called Dog based on Animal
    has sound be "woof"
end

make rex be a new Dog with name "Rex"
tell rex to speak                       # Rex says woof

# Catching problems instead of stopping.
try
    show 1 divided by 0
if it fails
    show "I could not do that: {the problem}"
end

# Actions used as values.
to double with n
    give back n times 2
end

show [1, 2, 3] changed by the action double     # [2, 4, 6]

# Other files.
use "helpers.plain"
```

The whole language fits on one page: **[LANGUAGE.md](LANGUAGE.md)**.

---

## Games, in 2D

```plain
start a game called "Catch" sized 640 by 480
set the background to "#141225"
set gravity to 0.6

make basket be a box at 320 , 440 sized 90 by 18 colored "#ffd166"
make star be a circle at 320 , 0 sized 22 colored "#ef476f"

every frame
    if key "left" is held
        move basket left by 9
    end
    keep basket on the screen
    draw "score {score}" at 18 , 16
end

when star touches basket
    add 1 to score
    play a beep at 880
end
```

Sprites, movement, gravity, per-frame code, timers, collisions, keyboard and
mouse, drawing on top, and sound. The same engine runs headless in Node, so
`plain run game.plain --frames 300` simulates 300 frames with no window — which
is how the tests check games.

## Games, in 3D

The same clock, the same keys, the same `every frame` — with a world in it.

```plain
start a world called "Moon Walk" sized 900 by 600
set the sky to "#0b1020"
set world gravity to 0.02

make ground be a floor at 0 , 0 , 0 sized 80 by 80 colored "#2c3a4f"
make hero be a cube at 0 , 1 , 0 sized 1.6 colored "#ffd166"
make prize be a ball at -6 , 1 , -8 sized 1.4 colored "#ef476f"

follow hero with the camera

every frame
    if key "left" is held
        turn hero left by 3
    end
    if key "up" is held
        move hero forward by 0.2
    end
end

when hero touches prize
    add 1 to score
end
```

Cubes, blocks, balls, posts, cones and floors; a camera that follows; gravity
and a ground to land on; `forward` that means the way a thing is facing. It is
drawn with WebGL — one shader, one light, no library — and flat things drawn
with `draw` become a heads-up display over the top.

```bash
plain play examples/world.plain
```

---

## Websites, typed or dragged

```plain
make a website called "Ada's Corner"
set the theme to "dark"

add a title "Ada's Corner"
add a card called "What is this?"
    add text "Every line came from a sentence."
end
add a button "Say hello"
    show a message "Hello from Plain!"
end
```

```bash
plain play examples/site.plain           # see it, with working buttons
plain edit examples/site.plain           # the designer
plain build examples/site.plain --out site
```

`plain edit` opens a designer: the live page on the left, blocks to add on the
right, click anything to change its words, drag the order about, switch themes.
**Save writes it back out as Plain sentences** — the same file you would have
typed by hand, so you can keep working either way.

`plain build` writes ordinary HTML files, one per page, styled and responsive.
The page content is in the HTML itself, so it reads fine with JavaScript off.
The interactive parts need the folder to be *served* (any host, or `plain
play`) — browsers refuse to load modules straight off the disk.

---

## Video

```plain
make a video called "How Plain Works" sized 1280 by 720

add a title "How Plain Works" for 3 seconds
fade the last clip in over 1 seconds

add a clip "holiday.mp4" from 4 to 12 seconds
put the words "the sea" on the last clip

add music "song.mp3"
```

```bash
plain play examples/video.plain          # watch it
plain edit examples/video.plain          # the studio
```

The studio gives a preview, a scrubber, and a timeline you can drag: pull a
clip's edge to change how long it lasts, reorder, retitle, set fades, delete.
Save writes the timeline back as Plain sentences. Export records the picture
track to a `.webm` file.

Honest limits: export uses the browser's own recorder, so it captures the
picture track in real time and does not mix the music in yet. Clips are laid
end to end on one track.

---

## Why it is easy to learn

- **One shape for everything.** Every line is either a plain sentence
  (`add 1 to score`) or one of a dozen control words. There is no separate
  syntax for calling a function, indexing a list, or building an object.
- **Errors are written for people.** `Line 4: I do not know a name called
  "scoer"`, with the line printed underneath and a suggestion of what to try.
- **Lists count from 1** and text is text — no zero-based surprises.
- **Indentation is free.** Blocks end with `end`, so a stray space never
  breaks a program.
- **The vocabulary is discoverable.** `plain words` prints every sentence the
  language knows, including the ones the engines add.
- **The tools write the language.** The designer and the studio save Plain
  sentences, so nothing you drag becomes code you cannot read.

## Extending it

The engines are not special: they register sentences the same way you would.

```js
import { createRuntime } from './src/runtime.js';

const plain = createRuntime();

plain.define('wave at $who', ({ who }, ctx) => ctx.output(`o/ ${who}`));
plain.define('three times ...', (args, ctx) => { for (let i = 0; i < 3; i++) ctx.block(); });
plain.defineValue('double $n', ({ n }) => n * 2);
plain.defineInfix('$a rhymes with $b', ({ a, b }) => a.slice(-2) === b.slice(-2));

plain.run('wave at "world"');
```

`$x` is a value, `#x` is a bare name, `$*x` is a comma separated list, and a
spec ending in `...` takes a block closed by `end`.

## Layout

```
bin/plain.js           the command line tool
bin/templates.js       the finished programs `plain make` writes
src/lexer.js           text   -> tokens
src/parser.js          tokens -> tree (this is where sentences are matched)
src/interp.js          runs the tree; kinds, actions, catching problems
src/phrases.js         the sentence table
src/stdlib.js          the sentences every program has
src/browser.js         running a program in a browser
engines/game/          the 2D game engine
engines/world/         the 3D world engine and its WebGL renderer
engines/web/           the website engine, its HTML writer, and the designer
engines/video/         the video timeline and the studio
examples/              programs to read and run
tests/run-tests.js     144 checks, no framework
```

## Tests

```bash
npm test
```

## Licence

MIT.
