# Plain

A programming language you write the way you type a sentence — plus a game
engine and a website engine built on top of it.

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
verb, blocks end with `end`, and indentation is yours to choose.

---

## Getting started

You need [Node.js](https://nodejs.org) 18 or newer. Nothing else — Plain has
no dependencies.

```bash
node bin/plain.js run examples/hello.plain
```

To type `plain` instead of `node bin/plain.js`, link it once:

```bash
npm link
```

Then:

```bash
plain new mine.plain     # start a new program
plain run mine.plain     # run it in the terminal
plain play mine.plain    # open a game or website in the browser
plain build mine.plain   # write HTML files you can publish
plain check mine.plain   # look for mistakes without running it
plain words              # list every sentence Plain understands
```

---

## The language in ninety seconds

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
show length of shopping         # 3

for each item in shopping
    show " - " joined with item
end

# Things hold named values.
make player be { name: "Ada", health: 100 }
set the health of player to 80
show health of player

# Actions of your own read like the sentences that use them.
to greet with person
    give back "Hello, " joined with person
end

show greet with "world"
```

The whole language fits on one page: **[LANGUAGE.md](LANGUAGE.md)**.

---

## The game engine

A game is a description of what is on screen and what happens each frame.

```plain
start a game called "Catch" sized 640 by 480
set the background to "#141225"

make basket be a box at 320 , 440 sized 90 by 18 colored "#ffd166"
make star be a circle at 320 , 0 sized 22 colored "#ef476f"
set the speed of star to 0 , 4

make score be 0

every frame
    if key "left" is held
        move basket left by 9
    end
    if key "right" is held
        move basket right by 9
    end
    keep basket on the screen
    draw "score {score}" at 18 , 16
end

when star touches basket
    add 1 to score
    move star to random 40 to 600 , 0
    play a beep at 880
end
```

```bash
plain play examples/catch.plain
```

You get sprites, movement, gravity, per-frame code, timers, collisions,
keyboard and mouse input, immediate drawing, and sound. The same engine runs
headless in Node, so `plain run game.plain --frames 300` simulates 300 frames
without a window — which is how the tests check games.

Full list of game sentences: [LANGUAGE.md](LANGUAGE.md#the-game-engine).

---

## The website engine

A website is a description of what is on the page.

```plain
make a website called "Ada's Corner"
set the theme to "dark"

add a title "Ada's Corner"
add text "A site written in sentences."

add a card called "What is this?"
    add text "Every line came from a sentence."
    add a list of "No build tools", "No brackets", "Just sentences"
end

add a button "Say hello"
    show a message "Hello from Plain!"
end

make a page called "Projects" at "/projects"
add a title "Projects"
```

```bash
plain play examples/site.plain          # see it, with working buttons
plain build examples/site.plain --out site
```

`plain build` writes ordinary HTML files — one per page, styled, responsive,
with a light/dark theme baked in. Drop the folder on any host. The buttons and
text boxes keep working because the same program is re-run in the browser.

The page content is written into the HTML itself, so it reads fine even with
JavaScript off. The interactive parts need the folder to be *served* (any host,
or `plain play`) — browsers refuse to load modules straight off the disk.

Full list of website sentences: [LANGUAGE.md](LANGUAGE.md#the-website-engine).

---

## Why it is easy to learn

- **One shape for everything.** Every line is either a plain sentence
  (`add 1 to score`) or one of nine control words. There is no separate syntax
  for calling a function, indexing a list, or building an object.
- **Errors are written for people.** `Line 4: I do not know a name called
  "scoer"` with the line printed underneath and a suggestion of what to try.
- **Lists count from 1** and text is text — no zero-based surprises.
- **Indentation is free.** Blocks end with `end`, so a stray space never
  breaks a program.
- **The vocabulary is discoverable.** `plain words` prints every sentence the
  language knows, including the ones the engines add.

## Extending it

The engines are not special: they register sentences the same way you would.

```js
import { createRuntime } from './src/runtime.js';

const plain = createRuntime();

plain.define('wave at $who', ({ who }, ctx) => ctx.output(`o/ ${who}`));
plain.defineValue('double $n', ({ n }) => n * 2);
plain.defineInfix('$a rhymes with $b', ({ a, b }) => a.slice(-2) === b.slice(-2));

plain.run(`
wave at "world"
show double 21
if "cat" rhymes with "hat"
    show "they do"
end
`);
```

`$x` is a value, `#x` is a bare name, `$*x` is a comma separated list, and a
spec ending in `...` takes a block closed by `end`.

## Layout

```
bin/plain.js          the command line tool
src/lexer.js          text  -> tokens
src/parser.js         tokens -> tree (this is where sentences are matched)
src/interp.js         runs the tree
src/phrases.js        the sentence table
src/stdlib.js         the sentences every program has
src/browser.js        running a program in a browser
engines/game/         the game engine
engines/web/          the website engine
examples/             programs to read and run
tests/run-tests.js    102 checks, no framework
```

## Tests

```bash
npm test
```

## Licence

MIT.
