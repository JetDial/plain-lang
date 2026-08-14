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

(Not on npm yet. The package is ready — `npm pack` builds a working tarball —
but publishing is yours to run: `npm publish`. The name `plain-lang` was
already taken, so package.json says `plainlang`.)

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
plain learn          open the course: 11 lessons and 6 projects
plain run <file>     run it in the terminal            (--fast to go quicker)
plain play <file>    open it in the browser
plain edit <file>    open the designer or the video studio
plain build <file>   write HTML you can publish        (--out folder)
plain translate <f>  write it in nine other languages    (--to php)
plain fmt <file>     tidy the indenting                (--check to just look)
plain get <url>      fetch a part into this folder     (plain parts to list)
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

# Things worth keeping when the program stops.
make best be remembered "best score" or 0
remember score as "best score" if it is bigger

write "hello" to file "notes.txt"
show lines of file "notes.txt"
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
mouse, drawing on top, and sound (`play the sound "jump.wav"`, `play music
"tune.mp3"`). Shapes come built in — box, circle, star, heart, triangle,
diamond, arrow, ring — so a game looks like a game before you have any
artwork, plus sprite sheets when you do (`with 4 by 2 frames`, `animate hero
at 10 frames a second`). The same engine runs headless in Node, so
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
Save writes the timeline back as Plain sentences. Words and pictures can also
be laid over the clips on a second track, at whatever time you like.

Two ways out: **Export** plays the film into the browser's recorder with the
music and clip sound **mixed in** (takes as long as the film), and **Export
fast** encodes every frame itself and writes the `.webm` by hand — much
quicker, no sound. The muxer is `engines/video/webm.js`, about 200 lines, no
library.

---

## The internet

```plain
fetch "https://api.github.com/repos/nodejs/node" as a thing into repo
show "node has {stargazers_count of repo} stars"

when someone visits "/"
    answer with "<h1>Hello from Plain</h1>"
end

when someone visits "/add"
    answer with "{(number of asked for \"a\") plus (number of asked for \"b\")}"
end

start serving on port 3000
```

Fetching **waits** for its answer, because that is what "fetch this and then
use it" means. Serving is the other way round: the program finishes and the
server carries on answering. A route can read `asked for "a"`, `what they
sent` and `how they asked`, and can fetch things of its own mid-request.

`examples/website-server.plain` is a working one — a visitor counter that
survives restarts, a page that adds two numbers, and a page that fetches a
line of wisdom from GitHub:

```bash
plain run examples/website-server.plain     # then open localhost:3000
```

Both need a terminal: a page cannot be made to wait, nor open a port of its
own, so in a browser Plain says so instead of half-working.

## Going faster

```bash
plain run brain.plain --fast
```

Translates to JavaScript and runs that instead of walking the tree. The
neural network above goes from **1.20s to 0.20s**.

---

## Learning it

```bash
plain learn
```

Ten lessons and six projects, in the browser, with a real editor. Every step
is checked by **running what you wrote** and looking at what it did — not by
comparing your text to an answer. The editor colours code as you type, using
Plain's own lexer, so it can never disagree with the language. Get it wrong and you get a hint, not a red
cross:

> *Holding right should move the basket: `if key "right" is held ... end`*

The lessons cover showing things, names, text, questions, loops, lists,
things, actions, kinds and catching problems. Then you build:

| Project | What you make | What it teaches |
|---|---|---|
| A quiz that marks itself | A three-question quiz with a score | lists, things, loops, actions |
| A website about you | Two pages, a card, a working button | the website engine |
| Catch the falling star | A playable 2D game | frames, keys, touching |
| A world in three dimensions | A 3D world you walk around | the world engine |
| A title sequence | A film with fades and captions | the video engine |
| Read it in another language | Your own program in JS and Python | how it all maps over |

Plus a lesson on keeping things after the program stops, so a high score can
actually survive.

Games and websites you write in the lesson run **live in the page** — the game
on a canvas you can play with the arrow keys, the site in a preview frame.
Progress is kept in your browser, and `plain learn --list` prints the syllabus
in the terminal.

Every lesson and project step has a worked answer in `tests/course-tests.js`
that the test suite runs for real, so a broken lesson fails the build rather
than the learner.

## Translating it

```bash
plain translate mine.plain --to python
plain translate mine.plain --to all --out translated
```

The same program, written out in **JavaScript**, **TypeScript**, **Python**,
**Ruby**, **PHP**, **Java**, **C#**, **Go** or **Lua** — real loops, real classes, real functions, with your names kept and a
small set of helpers for the few places where Plain means something particular
(lists that count from 1, text that joins with anything, refusing to divide by
zero).

```plain
to double with n
    give back n times 2
end
show [1, 2, 3] changed by the action double
```

becomes, in Python:

```python
def double(n):
    return (plain_number(n) * plain_number(2))

print(plain_text(plain_changed_by([1, 2, 3], double)))
```

The test suite takes ten programs, translates each into **all nine**
languages, runs every result, and insists all ten print exactly the same
thing. If a language's tool is missing from the machine, that language is
skipped and the run says so rather than pretending.

Sentences that belong to an engine (games, worlds, websites, videos) do not
translate, and the translator says so with the line numbers rather than
writing something that half works.

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
- **Mistakes come all at once.** `plain check` lists every problem in the
  file, not just the first one.
- **Sharing is small and safe.** A part is Plain source in one file, fetched
  only when you ask for it, and fingerprinted so you can see when it changes.
- **It is not a dead end.** `plain translate` writes your program out in
  JavaScript, Python, C# or Lua, so what you learn here carries over.
- **The tools write the language.** The designer and the studio save Plain
  sentences, so nothing you drag becomes code you cannot read.
- **It is not a dead end.**  writes your program out in
  JavaScript or Python, so what you learn here carries over.

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
src/translate/        Plain -> JavaScript, Python, C# and Lua
src/format.js         plain fmt
engines/store/        remembering things, and reading and writing files
engines/learn/        the course: lessons, projects and their checks
tests/fake-dom.js      a small stand-in browser, so the pages can be tested
engines/net/          fetching, and answering as a web server
bin/parts.js          fetching and recording parts other people wrote
tests/run-tests.js     305 checks, no framework, nine languages executed
```

## Tests

```bash
npm test
```

## Licence

MIT.
