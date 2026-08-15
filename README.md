# Plain

A programming language you write the way you type a sentence — and, in the
same box, everything you would otherwise go and collect: a web server with a
database behind it, 2D and 3D game engines, a website designer, a video
editor, and a translator that writes your program out in eleven other
languages.

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

And the sentences do not have to be English ones. Say **en español**,
**en français**, **auf deutsch**, **em português**, **in italiano** or
**in het nederlands** on the first line and write the whole file in that
language -
`haz puntos ser 0`, `por cada carta dentro de cartas`, `si ... fin`. The
checker checks it, the translator turns it into Python, and a Spanish file
can use an English one, because the language belongs to the file. Underneath it
has the things a grown-up language has: your own kinds of thing, actions used
as values, catching problems, and files that pull in other files.

**Nothing to install but Node.** Plain itself pulls in no packages - the
whole of it is the files in this repository. (Your *programs* can depend on
other people though: see parts, below, which fetch what they need, pin what
they got, and refuse anything that changed underneath you.) — which is also why `plain pack` can hand
you one folder to copy to a server.

## What comes with it

| | |
|---|---|
| **Whole applications** | addresses, forms, a table that survives restarts, sign-in with real passwords, files people send, HTTPS, live connections, email |
| **Games** | 2D with sprites, gravity and collisions; 3D on a hand-written WebGL renderer with pictures on things, shadows cast by the sun, lamps, haze and a first person camera |
| **Websites** | typed, or dragged about in a designer that writes Plain sentences back out |
| **Video** | a timeline, a studio, and a WebM file at the end, muxed by hand |
| **Eleven other languages** | JavaScript, TypeScript, Python, Ruby, PHP, Java, C#, Go, Lua, Rust, C — real code, built and run by the test suite |
| **A course** | 16 lessons and 9 projects in the browser, every step checked by running what you wrote |
| **Six human languages besides English** | Spanish, French, German, Portuguese, Italian and Dutch, per file, one dictionary each - adding another is adding words |

Made with it: **[Skyward](https://github.com/JetDial/skyward)**, a multiplayer
flying game whose whole server is one file of Plain sentences - and
**Stonefall** (`plain play examples/stonefall`), a textured, shadowed
3D game in one file, played from title screen to victory.

Made *in* it: a level editor, a sprite editor, a film editor and a site
builder, each written in Plain and each writing its output back out as
Plain (`plain desk` opens everything in this folder in one page).

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
plain desk           everything in this folder, in one place
plain learn          open the course: 16 lessons and 7 projects
plain run <file>     run it in the terminal            (--fast to go quicker)
plain play <file>    open it in the browser
plain edit <file>    open the designer or the video studio
plain build <file>   write HTML you can publish        (--out folder)
plain translate <f>  write it in 11 other languages     (--to rust)
plain fmt <file>     tidy the indenting                (--check to just look)
plain get <url>      fetch a part, and what it needs    (plain parts to list)
plain remove <name>  stop using one
plain pack <file>    one folder to copy to a server
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

# The shapes data arrives in.
show json of shopping
make person be thing from json '{"name": "Ada"}'
make table be rows of text of file "sales.csv"
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
```

## Tools written in Plain

Two of the examples are not demonstrations - they are things you would use,
written in the language they are for. Each writes its output **as Plain**, so
there is no file format to agree on and nothing to import.

```bash
# Each of these is a project folder: main.plain is the door, the other
# files arrive through "use", and pictures live beside them. Your own
# projects can be folders too - plain new <name> makes one.
plain play examples/level-editor    # click to place, S writes the level
plain play examples/sprite-editor   # paint 16x16, S writes the picture
plain play examples/film-editor     # a timeline, S writes the film
plain play examples/site-builder    # a page, S writes the site
plain edit examples/site.plain           # the designer
plain build examples/site.plain --out site
```

`plain edit` opens a designer: the live page on the left, blocks to add on the
right, click anything to change its words, drag the order about, switch themes.
**Save writes it back out as Plain sentences** — the same file you would have
typed by hand, so you can keep working either way.

Plain writes the markup for you, and gets out of the way when you want your
own:

```plain
set the page background to "#0f1020"
set the font to "Georgia, serif"

add style '.badge { border-radius: 999px; background: linear-gradient(90deg, #ff7a59, #ffd166) }'
add html '<p><span class="badge">your own markup</span> sits here.</p>'

add a title "Handmade" named crown
style crown with 'color: #ffd166'

add markdown '## Or the marks you already type, **bold** and all.'
add script 'document.title = "written in JavaScript"'
```

Single quotes are taken exactly as typed, which is what CSS, HTML and
markdown need. Your style comes after Plain's, so it wins — in built pages,
the live preview and the designer alike. Markdown is read rather than passed
through, so a stray `<` stays a `<`. See `examples/styled-site.plain`.

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

## A whole application, front to back

The page, the form, the thing that keeps what was typed, and the bit that
knows who is asking — all in one file, in one language, with nothing to
install.

```plain
make notes be a table called "notes"

when someone visits "/"
    answer with the page "<h1>{number of rows in notes} notes</h1>"
end

when someone sends to "/notes"                 # a form arriving
    save { title: the form field "title", by: who is signed in } in notes
    send them to "/"
end

when someone visits '/notes/{id}/remove'       # a piece of the address
    remove row the address part "id" from notes
    send them to "/"
end

when someone sends to "/name"
    sign this visitor in as the form field "who"
    send them to "/"
end

start serving on port 3000
```

A **table** is the piece between a list, which is forgotten the moment the
program stops, and a database, which you would have to install and learn. It
keeps rows with an id each, and answers the four questions people actually
ask:

```plain
save { title: "Buy bread", done: no } in notes
show rows of notes where "done" is no
show rows of notes where "title" contains "bread"
show rows of notes sorted by "title"
change row 3 of notes to { title: "Buy two loaves", done: no }
remove row 3 from notes
```

Rows are ordinary things, so `title of note` works. They are kept the way
`remember` keeps things: a file beside the program, or the browser's own
store on a page.

Every browser gets a tag, so the server can tell one visitor from another
without anything about them leaving your machine — and it is kept, so
restarting the program does not throw everybody out:

```plain
create an account in people for "Ada" with password "correct horse"

make found be the account in people for the form field "who" with password the form field "password"
if found is not nothing
    sign this visitor in as name of found
end

keep 3 as "basket" for this visitor
show what this visitor has as "basket"
```

A password is never written down as itself: it is scrambled slowly, with
salt, by the machinery built for it, and checking one takes the same time
whether it is wrong at the first letter or the last. A name nobody has costs
the same as a name somebody does.

Files sent with a form arrive as bytes, never as text:

```plain
make sent be the file sent as "picture"
save the file sent as "picture" to "kept/{name of sent}"
show "{name of sent}, {bytes of sent} bytes, said to be {type of sent}"
```

And the whole thing can be locked:

```plain
start serving safely on port 8443 with certificate "cert.pem" and key "key.pem"
```

Plus `send them to "/"`, `answer that nothing is there`, `answer with ... and
code 418`, and `hand out the files in "public"` for pictures and stylesheets.

```bash
plain run examples/notes-app     # then open localhost:3010
plain run examples/live-chat.plain     # a room everyone hears at once
```

And the parts a real one needs on top: `do all of this together` puts every
table back if anything in the block goes wrong; `joined to ... on ...` lines
two tables up; `fill in ... on every row of ...` catches up rows written
before you added a field; `this visitor has asked more than 20 times in 60
seconds` turns somebody away; `every 60 seconds on the server` does work
nobody asked for; and `when someone connects` / `says something` /
`disconnects` keeps a page on the line. Only one program may keep things in
a given file, and it says so rather than letting two quietly overwrite each
other.

That example is a real one: write a note, it is there after a restart; remove
one, it is gone; tell it your name, and the browser next to yours still says
nobody. What a visitor types is escaped before it goes back out, and a folder
handed out cannot be walked out of with `..`.

Looking a row up is not a search: the first question about a field builds a
lookup from that field to the rows holding it, and the rest are instant until
something is written. Two thousand lookups in a table of two hundred thousand
rows: **2.2s reading every row, 0.4s with the lookup**, and the gap grows with
every question asked.

## Sending it somewhere

```plain
use the mail server "smtp.example.com" on port 587
sign in to the mail server as "me@example.com" with password "an app password"
send an email from "me@example.com" to "you@example.com" about "Your receipt" saying "Thank you."
```

The whole SMTP conversation, written out: hello, lock the line, prove who
you are, from, to, the message, goodbye. Accents survive in both the subject
and the words. A server that refuses says why, in its own words.

## Putting it on a server

```bash
plain pack app.plain
```

One folder with everything in it: your program, the files it uses, and Plain
itself. Nothing to install but Node. Inside are three ways to start it —
`sh start.sh`, a `Dockerfile`, and a systemd unit — and a README saying
which file holds your data and how to back it up.

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

Sixteen lessons and seven projects, in the browser, with a real editor. Every step
is checked by **running what you wrote** and looking at what it did — not by
comparing your text to an answer. The editor colours code as you type, using
Plain's own lexer, so it can never disagree with the language. Get it wrong and you get a hint, not a red
cross:

> *Holding right should move the basket: `if key "right" is held ... end`*

The lessons cover showing things, names, text, questions, loops, lists,
things, actions, kinds, catching problems, the shapes data arrives in (JSON
and CSV), writing your own HTML, CSS and markdown, and then the back end: a
program that answers, a table that keeps what people typed, and forms. Every
line of every example is explained in ordinary words, one line at a time.
Then you build:

| Project | What you make | What it teaches |
|---|---|---|
| A quiz that marks itself | A three-question quiz with a score | lists, things, loops, actions |
| A website about you | Two pages, a card, a working button | the website engine |
| Catch the falling star | A playable 2D game | frames, keys, touching |
| A world in three dimensions | A 3D world you walk around | the world engine |
| A title sequence | A film with fades and captions | the video engine |
| The same program in eleven languages | Your own program in all of them, and the runtime under Rust and C | how it all maps over, and the price each language charges |
| A guest book | A page anybody can write on, still there tomorrow | routes, forms, tables, visitors, and not being vandalised |

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
**Ruby**, **PHP**, **Java**, **C#**, **Go**, **Lua**, **Rust** or **C** — real loops, real
classes, real functions, with your names kept and a
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

The test suite takes ten programs, translates each into **all eleven**
languages, builds and runs every result, and insists all twelve print exactly
the same thing. If a language's tool is missing from the machine, that language is
skipped and the run says so rather than pretending.

Sentences that belong to an engine (games, worlds, websites, videos) do not
translate, and the translator says so with the line numbers rather than
writing something that half works. The same goes for the few things a target
genuinely cannot do — patterns in Lua and Rust, whose own libraries have none.

Rust is the odd one out, because it wants to know the type of everything and
who owns it. So every Plain value becomes one Rust type, and sharing is done
with `Rc`, which frees a thing when the last name lets go. That type and
everything that works on it live in `runtime/rust/plain.rs` — a real Rust
file that compiles and is checked on its own — and it is written out above
your program, so what you get is a single `.rs` file:

```bash
plain translate mine.plain --to rust --out mine.rs
rustc -O mine.rs && ./mine
```

No crates, no Cargo, no build file.

C is the same idea taken further, because C has none of the pieces: no type
that holds anything, no lists that grow, no text that joins, and no way to
give memory back on its own. `runtime/c/plain.c` builds all four. Every
thing on the heap is counted, and swept up at the end of each turn of a loop:

```bash
plain translate mine.plain --to c --out mine.c
cc -O2 mine.c -o mine -lm
```

A loop of six million turns, each making four things, holds steady at 4 MB —
without the sweep it would ask for a gigabyte.

Neither counting nor sweeping is quite a garbage collector: a program that
ties a knot in itself (a list holding itself, two things pointing at each
other) keeps that knot until it ends. Everything else is given back.

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
the language
  src/lexer.js         text   -> tokens
  src/parser.js        tokens -> tree (this is where sentences are matched)
  src/interp.js        runs the tree; kinds, actions, catching problems
  src/phrases.js       the sentence table
  src/stdlib.js        the sentences every program has
  src/format.js        plain fmt
  src/browser.js       running a program in a browser

what a program can do
  engines/game/        the 2D game engine
  engines/world/       the 3D world engine and its WebGL renderer
  engines/web/         the website engine, its HTML and markdown writers,
                       and the designer
  engines/video/       the video timeline and the studio
  engines/store/       remembering things, files, JSON and CSV
  engines/data/        tables: rows with ids, looked up rather than scanned,
                       transactions, joins, accounts with real passwords
  engines/net/         fetching, and answering as a web server: addresses,
                       forms, visitors, files, live connections
  engines/mail/        sending email, and the shape a message goes in
  engines/parts/       what a part says about itself, read before it is run
  engines/learn/       the course: lessons, projects and their checks

writing it out in something else
  src/translate/       Plain -> 11 other languages
  runtime/rust/        the Value type Rust programs are built on
  runtime/c/           the same for C, with the counting and the sweep

the tool, and proof
  bin/plain.js         the command line tool
  bin/templates.js     the finished programs `plain make` writes
  bin/parts.js         fetching and recording parts other people wrote
  examples/            programs to read and run
  tests/fake-dom.js    a small stand-in browser, so pages can be tested
  tests/run-tests.js   391 checks, no framework, 11 languages built and run
```

## Tests

```bash
npm test
```

## Licence

MIT.
