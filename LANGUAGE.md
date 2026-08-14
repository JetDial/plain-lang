# The Plain language

The whole language, on one page. Read it top to bottom and you know Plain.

Notation used below: `$x` means *a value goes here*, `#x` means *a name goes
here*, and `...` means *a block of lines, closed by `end`*.

---

## 1. Lines, blocks and comments

One statement per line. Blocks are closed by `end`. Indentation is decoration —
use it or don't.

```plain
# a comment
note this is a comment too, if the line starts with "note"

if 1 is 1
    show "yes"
end
```

## 2. Values

| Kind | Written like | Notes |
|---|---|---|
| number | `42`, `3.5`, `1_000` | one kind of number |
| text | `"hi"` | `{...}` inside is filled in; may run over several lines |
| exact text | `'hi'` | single quotes: taken exactly as written |
| yes/no | `yes`, `no` (`true`, `false`, `on`, `off`) | |
| list | `a list of 1, 2, 3` or `[1, 2, 3]` | counts from **1** |
| thing | `{ name: "Ada", age: 36 }` | named values |
| nothing | `nothing`, `none` | |

Text can carry values:

```plain
make n be 3
show "there are {n}, double is {n times 2}"
```

Write `\{` for a real curly brace, `\"` for a quote, `\n` for a new line.

## 3. Names

```plain
make score be 0          # make a name
let score be 0           # same thing
set score to 10          # change one that exists
add 1 to score           # add to a number, or push onto a list
take 1 from score
put "hi" into greeting    # make it or change it, either way
```

Names ignore capitals: `Score` and `score` are the same name. `the` is
decoration and is ignored: `show the score` works.

## 4. Maths and questions

| You write | It means |
|---|---|
| `plus` `minus` `times` `over` / `divided by` `modulo` | `+ - * / %` |
| `^` | to the power of |
| `joined with` | glue two pieces of text together |
| `is` | equals |
| `is not` | does not equal |
| `is above` / `over` / `more than` / `bigger than` | `>` |
| `is below` / `under` / `less than` / `smaller than` | `<` |
| `is at least` / `is at most` | `>=` `<=` |
| `contains` | this list or text contains that |
| `and` `or` `not` | and, or, not |

The symbols `+ - * / % = != < > <= >=` work too, if you prefer them.

`not` covers the whole question after it, so `not score is 5` reads the way it
sounds.

## 5. Choosing

```plain
if score is above 100
    show "high"
otherwise if score is above 50
    show "middling"
otherwise
    show "low"
end
```

`else` works in place of `otherwise`. A trailing `then` is allowed and ignored.

## 6. Repeating

```plain
repeat 3 times
    show "again"
end

repeat with n from 1 to 10
    show n
end

repeat with n from 10 to 0 by 2
    show n
end

for each item in shopping
    show item
end

while lives is above 0
    take 1 from lives
end

repeat forever
    stop
end
```

`stop` leaves the loop. `next` (or `skip`) jumps to the next turn. Inside
`repeat n times` the name `count` holds the turn number.

## 7. Lists

```plain
make shopping be a list of "bread", "milk"
add "apples" to shopping
remove "milk" from shopping
remove item 1 from shopping
empty shopping

show item 1 of shopping
show first of shopping
show last of shopping
show length of shopping
set item 2 of shopping to "cheese"
```

Also: `total of`, `average of`, `highest of`, `lowest of`, `sorted`,
`reversed`, `join $list with $separator`, `position of $value in $list`,
`random item of $list`, `copy of $list`.

## 8. Things

```plain
make player be { name: "Ada", health: 100 }
show name of player
set the health of player to 80
show keys of player
```

`something of something` reads a named value. It also works on lists and text:
`length of`, `first of`, `last of`.

## 9. Actions of your own

```plain
to greet with person
    give back "Hello, " joined with person
end

to shout with words and many
    repeat many times
        show uppercase of words
    end
end

show greet with "world"
shout with "hey" and 3
```

The name can be several words: `to add up with a and b` is called as
`add up with 3 and 4`. A few words are Plain's own - `times`, `count`, `end`
- and it says so rather than letting you name something one of them. `give back` returns a value and ends the action.
Actions can be used before they are written.

## 10. Kinds of your own

A kind is a sort of thing, with values it always has and actions it can do.

```plain
a kind called Animal
    has name
    has sound be "..."
    has legs be 4

    to speak
        show "{name of me} says {sound of me}"
    end

    to describe
        give back "{name of me}, {legs of me} legs"
    end
end

a kind called Dog based on Animal
    has sound be "woof"

    to fetch with item
        give back "{name of me} fetched the {item}"
    end
end
```

Making one, and using it:

```plain
make rex be a new Dog with name "Rex"

tell rex to speak                       # do something
show ask rex to fetch with "ball"       # do something and use the answer
show name of rex                        # read a value
set the name of rex to "Rexy"           # change a value

if rex is a kind of Animal
    show "a dog is an animal too"
end

show kind name of rex                   # Dog
```

Inside an action, `me` is the thing itself. `based on` means "everything that
kind has, plus these" — values and actions both.

## 11. When things go wrong

```plain
try
    show 1 divided by 0
if it fails
    show "I could not do that: {the problem}"
end
```

Anything that would stop the program is caught instead, and `the problem`
holds the message. You can raise your own:

```plain
report a problem saying "there is nobody to share with"
```

## 12. Actions used as values

```plain
to double with n
    give back n times 2
end

make f be the action double
show call f with 21                       # 42

show [1, 2, 3] changed by the action double        # [2, 4, 6]
show [1, 2, 3, 4] kept where the action is_big     # the ones that pass
show [1, 2, 3] added up by the action double       # 12
```

`call $action`, `call $action with $one`, and `call $action with $one and
$other` all work.

## 13. Things used as a bag of named values

```plain
make settings be { theme: "dark", size: 14 }

show value "theme" of settings
set value "size" of settings to 16
if settings has "theme"
    show "it has a theme"
end
show keys of settings                    # ["theme", "size"]
show values of settings
```

## 14. Splitting a program across files

```plain
use "helpers.plain"

show shout with "hello"
```

The used file is read first, so anything it writes — actions, kinds, names —
is ready before the rest of your program runs. A file is only pulled in once,
however many times it is used, and line numbers in error messages stay
pointing at the file you actually typed.

### Parts written by other people

```bash
plain get https://example.com/dates.plain      # fetch it, once, because you asked
plain get https://example.com/x.plain as dates # under a name of your choosing
plain parts                                    # what this folder uses
plain get                                      # fetch them all again, and check
```

A part lands in `plain-parts/` and is written down in `plain-parts.json` with
its size and fingerprint, so `plain parts` can tell you when one has changed.
Then:

```plain
use "dates"
```

Two things keep this small and safe. A part is **Plain source**, read by
Plain's own interpreter — it cannot run a program of its own, reach outside
its folder, or install anything. And nothing is ever fetched behind your
back: a part arrives only when you type `plain get`.

## 15. Keeping things after the program stops

Everything is forgotten when a program ends, unless you say otherwise.

```plain
remember 12 as "best score"
show remembered "best score"

make best be remembered "best score" or 0     # the first run has nothing yet
remember score as "best score" if it is bigger

forget "best score"
forget everything remembered
show everything remembered                    # the names you have kept

if "best score" is remembered
    show "there is one already"
end
```

Lists and things are kept whole, not flattened into text. In a terminal this
lives in a small file beside your program (`yourprogram.memory.json`); in a
browser it lives in the browser's own store.

Files sit next to your program, and nowhere else:

```plain
write "hello" to file "notes.txt"
add "another line" to file "notes.txt"
show text of file "notes.txt"
show lines of file "notes.txt"
show does file "notes.txt" exist
```

Reading and writing files needs a terminal; in a browser Plain says so rather
than failing quietly.

Data usually arrives in one of two shapes, so Plain reads and writes both:

```plain
# JSON - what web services speak.
show json of a list of 1, "two", yes
make person be thing from json '{"name": "Ada", "years": [1815, 1852]}'
show value "name" of person
show item 1 of value "years" of person

# CSV - what spreadsheets speak.
make table be rows of text of file "sales.csv"
show item 2 of item 1 of table              # row 1, column 2
write csv of table to file "copy.csv"
```

`rows of` handles the awkward parts of CSV properly: commas inside quotes,
doubled quotes meaning one quote, and lines that wrap. `csv of` puts the
quotes back where they are needed. Neither loses anything on the way out and
in again.

## 16. Patterns in text

A pattern is written as text in **single quotes**, which are taken exactly as
written — handy, because `{4}` in a pattern is not a value to fill in.

```plain
if note matches '[0-9]{4} [0-9]{3} [0-9]{4}'
    show "there is a phone number in there"
end

show first match of '[0-9]+' in "room 214 please"
show parts of note matching '[0-9]+'
show replace pattern '[0-9]' with "x" in note
```

Double quotes fill in `{values}`; single quotes never do.

## 17. The bits of a number

```plain
show bitwise and of 12 and 10        # 8
show bitwise or of 12 and 10         # 14
show bitwise xor of 12 and 10        # 6
show bitwise not of 0                # -1
show shift 1 left by 8               # 256
show shift 256 right by 4            # 16
```

## 18. The internet

Fetching waits for its answer, because that is what "fetch this and then use
it" means:

```plain
fetch "https://example.com" into page
show length of page

fetch "https://api.github.com/repos/nodejs/node" as a thing into repo
show "node has {stargazers_count of repo} stars"

send { name: "Ada" } to "https://example.com/people" into answer
```

Answering is the other way round — the program finishes, and the server
carries on:

```plain
when someone visits "/"
    answer with "<h1>Hello from Plain</h1>"
end

when someone visits "/add"
    answer with "{(number of asked for \"a\") plus (number of asked for \"b\")}"
end

when someone visits "/shout"
    answer with uppercase of what they sent
end

when someone visits anything else
    answer with "Nothing at {what was asked for}"
end

start serving on port 3000
```

Several at once, which is much quicker than one after another:

```plain
fetch all of "https://a.example", "https://b.example" into answers
show length of answers
```

Also: `what was asked for`, `asked for $name`, `what they sent`,
`how they asked`, and `answer with the website` to hand over a website built
in the same program.

## 19. A whole application

Four things turn the server above into something people can actually use:
addresses with a piece in them, forms arriving, somewhere to keep what was
typed, and a way to tell one visitor from another.

**Part of the address.** Use single quotes — the braces belong to the
address, and Plain fills in braces inside "double quotes":

```plain
when someone visits '/notes/{id}/remove'
    remove row the address part "id" from notes
    send them to "/"
end
```

**Forms.** A page being looked at and a form being sent are different things,
so they are written differently. What arrives is a thing either way, whether
the browser sent a form or a program sent JSON:

```plain
when someone visits "/name"        # somebody looking
    answer with the page "<form method='post' action='/name'>...</form>"
end

when someone sends to "/name"      # somebody sending
    show the form field "who"
    show the form                  # all of it at once
    send them to "/"
end
```

**A table** keeps rows between runs, with an id each — the small piece
between a list, which is forgotten when the program stops, and a database,
which you would have to install:

```plain
make notes be a table called "notes"

save { title: "Buy bread", done: no } in notes

show number of rows in notes
show title of row 3 of notes
show every row of notes
show rows of notes where "done" is no
show rows of notes where "title" contains "bread"
show rows of notes sorted by "title"
show first row of notes where "title" is "Buy bread"

change row 3 of notes to { title: "Buy two loaves", done: no }
remove row 3 from notes
empty the table notes
```

Rows are ordinary things, so `title of note` and `value "title" of note` both
work. It is kept the same way `remember` keeps things: a file beside the
program in a terminal, the browser's own store on a page.

**Who is asking.** Every browser is given a tag, and what belongs to that tag
stays on the machine the program runs on. It is kept the way everything else
is kept, so restarting the program does not throw everybody out; anyone not
seen for a month is forgotten:

```plain
sign this visitor in as "Ada"
show who is signed in
sign this visitor out

keep 3 as "basket" for this visitor
show what this visitor has as "basket"
forget everything about this visitor
```

**Accounts with passwords.** A password is never written down as itself: it
is scrambled, slowly and with salt, by the machinery built for it. Checking
one takes the same time whether it is wrong in the first letter or the last,
and a name nobody has costs the same as one somebody does.

```plain
make people be a table called "people"

create an account in people for "Ada" with password "correct horse"
if people has an account for "Ada"
    show "that name is taken"
end

make typed be the form field "password"
make found be the account in people for "Ada" with password typed
if found is nothing
    show "no"
otherwise
    sign this visitor in as name of found
end

change the password in people for "Ada" to "another long one"
```

Eight letters is the shortest password Plain will take. An account row holds
`name` and `locked`, and you can put anything else on it you like.

**Files sent with a form.** A picture is not text, so it is never turned into
any:

```plain
when someone sends to "/picture"
    if a file was sent as "picture"
        make sent be the file sent as "picture"
        save the file sent as "picture" to "kept/{name of sent}"
        show "{name of sent}, {bytes of sent} bytes, said to be {type of sent}"
    end
end
```

They are called `name`, `type` and `bytes` because `size of` and `kind of`
already mean something else in Plain. `the text of the file sent as "notes"`
reads one that is text after all. Anything saved goes through the same fence
as every other file: beside your program, and nowhere else.

**Locking the conversation.** The same server, over https:

```plain
start serving safely on port 8443 with certificate "cert.pem" and key "key.pem"
```

Both are files. For playing about on your own machine, one command makes a
pair (browsers will warn that nobody vouches for it, which is true):

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"
```

And the rest of what a server needs:

```plain
send them to "/"                       # go and look over there instead
answer that nothing is there           # 404
answer with "no tea" and code 418      # any code you like
hand out the files in "public"         # pictures, stylesheets, downloads
```

### All of it, or none of it

Taking money off one row and putting it on another is two changes, and a
program that stops in between has done half a thing:

```plain
do all of this together
    change row 1 of money to { owner: "Ada", pennies: 400 }
    change row 2 of money to { owner: "Bob", pennies: 200 }
end
```

If anything in there goes wrong, every table is put back as it was and the
problem carries on its way.

### Two tables at once

```plain
make lines be every row of orders joined to people on "by"
show name of match of item 1 of lines
```

Each row that comes back is the one from the first table, with the one it
was matched to under the name `match`, or `nothing` if there was none. The
match is on the other table's id unless you say otherwise:

```plain
make lines be every row of orders joined to people on "who" matching "name"
```

### Rows written before you changed your mind

```plain
fill in "done" with no on every row of notes     # only the ones without it
show the number filled in
rename "title" to "words" in every row of notes
```

### Too much at once

```plain
when someone sends to "/notes"
    if this visitor has asked more than 20 times in 60 seconds
        answer with "slow down" and code 429
    otherwise
        save { title: the form field "title" } in notes
        send them to "/"
    end
end
```

### Work on a timer

```plain
every 60 seconds on the server
    show "{number of rows in notes} notes kept"
end
```

### Staying connected

A page that must be told the moment something happens cannot keep asking.
Three sentences are the whole of it:

```plain
when someone connects
    tell them "welcome - {how many are connected} here"
    tell everyone else "somebody joined"
end

when someone says something
    tell everyone "someone said: {what they said}"
end

when someone disconnects
    show "someone left"
end
```

`examples/live-chat.plain` is a working one. In the page, it is the ordinary
browser thing - `new WebSocket("ws://localhost:3020")` - so anything that
speaks WebSocket can join.

### One at a time

Only one program may keep things in a given file. A second is told so
rather than left to find out, because both would hold their own copy and
take it in turns to overwrite the other. Writes go to one side and are moved
into place, so a program stopped mid-write leaves the old file, never half a
new one.

`examples/notes-app.plain` is all of it in one file: a list, a form that adds
to it, a link that removes one, a name the server remembers for your browser,
and everything kept when the program stops.

Both of these need a terminal. A page cannot be made to wait, and cannot open
a port of its own, so in a browser Plain says so rather than half-working.

## 20. Talking to the person running the program

```plain
show "hello"                 # print a line
ask "Your name? " into name  # read a line (a number if it looks like one)
stop the program
```

## 21. Built-in values

**Numbers** — `round $n`, `round $n to $places places`, `floor of`,
`ceiling of`, `absolute of`, `square root of`, `sine of`, `cosine of`,
`smaller of $a and $b`, `bigger of $a and $b`, `pi`,
`random $low to $high`, `random number`.

**Text** — `uppercase of`, `lowercase of`, `trimmed`, `length of`,
`part of $text from $start to $finish`, `parts of $text split by $separator`,
`replace $find with $replacement in $text`, `does $text start with $prefix`,
`does $text end with $suffix`, `text of $value`, `number of $value`.

**Other** — `kind of $value`, `time now`, `today`.

---

# The game engine

Available in any program; a game begins when you say `start a game`.

## Setting up

```plain
start a game called "Pong" sized 800 by 500
set the background to "#0d1117"
set gravity to 0.4
```

## Making things

```plain
make ball be a circle at 400 , 250 sized 18 colored "white"
make paddle be a box at 40 , 250 sized 16 by 110 colored "#7ee787"
make prize be a star at 200 , 100 sized 30 colored "gold"
make life be a heart at 30 , 20 sized 24 colored "#ef476f"
make hero be a picture "hero.png" at 100 , 100 sized 48 by 48
make label be words "Ready" at 400 , 40 sized 24 colored "white"
```

Every thing has values you can read and set: `x`, `y`, `width`, `height`,
`size`, `color`, `dx`, `dy`, `speed`, `angle`, `text`, `left`, `right`, `top`,
`bottom`, `hidden`, `visible`. You can invent your own:

```plain
set the health of hero to 3
show health of hero
```

## Moving

```plain
move ball by 5 , 0
move ball to 400 , 250
move paddle up by 9            # up, down, left, right
set the speed of ball to 6 , 3
stop ball moving
bounce ball                    # both directions
bounce ball sideways           # left/right
bounce ball upright            # up/down
keep paddle on the screen
point turret at mouse x , mouse y
hide ball
reveal ball
remove ball from the game
```

## When things happen

```plain
every frame
    move hero right by 2
end

every 2 seconds
    add 1 to score
end

when ball touches paddle
    bounce ball
end

when key "space" is pressed
    push hero up by 9
end

when any key is pressed
    show "off we go"
end

when the mouse is clicked
    add 1 to score
end

when ball leaves the screen
    stop the game saying "missed"
end
```

## Asking about the game

`key "left" is held`, `mouse x`, `mouse y`, `mouse is down`,
`ball touches paddle`, `distance from ball to paddle`, `game width`,
`game height`, `frame number`, `game time`.

## Drawing on top

Inside `every frame`:

```plain
draw "score {score}" at 20 , 18
draw "BIG" at 400 , 250 sized 48 colored "#ffd166"
draw a box at 100 , 100 sized 40 by 40 colored "red"
draw a circle at 200 , 100 sized 30 colored "blue"
```

## Ending

```plain
stop the game
stop the game saying "You win"
play a beep
play a beep at 880
play the sound "jump.wav"
play music "tune.mp3"
stop the music
set the sound volume to 0.5
```

## Pictures that move

A sprite sheet is one picture holding a grid of frames.

```plain
make hero be a sprite "walk.png" at 100 , 100 sized 32 by 32 with 4 by 2 frames
make coin be a sprite "spin.png" at 200 , 100 sized 16 by 16 with 6 frames

animate hero at 10 frames a second
animate hero from 1 to 4 at 12 frames a second
stop animating hero
set the frame of hero to 3
show frame of hero
```

## Waiting

```plain
after 2 seconds
    show "two seconds later"
end
```

That waits without stopping anything else — the game keeps running in the
meantime. In a terminal program, where there is nothing else to keep running,
`wait 2 seconds` stops and waits properly.

A terminal program ends when its last line is read, so a program that wants
its timers to go on happening says so:

```plain
every 5 seconds
    fetch "https://api.github.com/zen" into wisdom
    show wisdom
end

keep going
```

`stop the game` ends it. On a page nothing is needed: the page keeps going
on its own.

Key names: `left`, `right`, `up`, `down`, `space`, `enter`, `escape`, `shift`,
and any letter or digit as itself (`"a"`, `"7"`).

---

# The 3D world engine

A world begins with `start a world`. It shares the game engine's clock, keys,
timers and `draw` sentences, so everything above still applies — `every frame`,
`when a touches b`, `key "x" is held` and so on all work the same.

Positions are `x` (right), `y` (up) and `z` (towards you).

## Setting up

```plain
start a world called "Moon Walk" sized 900 by 600
set the sky to "#0b1020"
set world gravity to 0.02
set the ground level to 0
set the light to 0.4 , 1 , 0.6
```

## Making things

```plain
make ground be a floor at 0 , 0 , 0 sized 80 by 80 colored "#2c3a4f"
make hero be a cube at 0 , 1 , 0 sized 1.6 colored "#ffd166"
make crate be a block at 5 , 1 , 6 sized 3 by 2 by 3 colored "#a970ff"
make prize be a ball at -6 , 1 , -8 sized 1.4 colored "#ef476f"
make tower be a post at 9 , 3 , -7 sized 2 by 6 colored "#7ee787"
make spike be a cone at -10 , 2 , 4 sized 3 by 4 colored "#79c0ff"
```

Values you can read and set: `x`, `y`, `z`, `width`, `height`, `depth`, `size`,
`color`, `dx`, `dy`, `dz`, `speed`, `turn`, `top`, `bottom`, `hidden`, `heavy`.
You can invent your own, the same as in 2D.

## Moving

```plain
move hero by 1 , 0 , 0
move hero to 0 , 1 , 0
move hero forward by 0.2         # forward, back, left, right, up, down
turn hero left by 3              # left, right, up, down, over
set the speed of hero to 0 , 0 , -0.2
push hero up by 0.35
stop hero still
let hero float
let hero fall
remove hero from the world
```

`forward` follows the way a thing is facing, so turn first and then walk.

## The camera

```plain
move the camera to 0 , 8 , 14
point the camera at hero
point the camera at 0 , 0 , 0
follow hero with the camera
set the camera distance to 9
set the camera height to 4
```

## Asking

`hero is resting`, `distance from hero to prize`, `ground level`, `camera x`,
`camera y`, `camera z` — plus everything the game engine already answers.

Flat things (`make x be a box at ...`) and `draw` still work in a world: they
are painted on top as a heads-up display.

---

# The video engine

A video begins with `make a video`. It is a timeline of clips, one after
another.

```plain
make a video called "How Plain Works" sized 1280 by 720
set the frame rate to 30

add a title "How Plain Works" for 3 seconds
add a background "#1b2a41" for 2 seconds
add a picture "beach.jpg" for 4 seconds
add a clip "holiday.mp4" from 4 to 12 seconds
add a clip "holiday.mp4" for 5 seconds

put the words "the sea" on the last clip
fade the last clip in over 1 seconds
fade the last clip out over 1 seconds
trim the last clip to 2 seconds

add music "song.mp3"
set the volume to 0.8
```

Asking: `video length`, `clip count`, `video width`, `video height`.

```bash
plain play video.plain     # watch it
plain edit video.plain     # the studio: scrub, drag, trim, export, save
```

A second track, laid over the clips wherever you like:

```plain
put the words "a caption" on top from 1 to 6 seconds
put the words "later" on top at 8 seconds for 3 seconds
put the picture "logo.png" on top from 0 to 4 seconds
put the last thing on top middle          # top, middle or bottom
fade the last thing on top over 0.5 seconds
show things on top
```

Sound:

```plain
add music "song.mp3"
add music "birds.mp3" starting at 4 seconds
add music "hum.mp3" at volume 0.3
silence the last clip
set the volume of the last clip to 0.5
set the volume to 0.8
```

In the studio, dragging the right edge of a clip changes how long it lasts,
and **Save writes the whole timeline back out as the sentences above**.

There are two ways out:

| Button | What it does |
|---|---|
| **Export** | Plays the film into the browser's recorder, mixing the music and the clips' own sound in. Takes as long as the film. |
| **Export fast** | Encodes every frame itself and writes the `.webm` by hand. Much quicker — no sound. |

Both write `.webm`. Fast export needs a browser with WebCodecs (Chrome and
Edge have it) and says so plainly when there is none.

---

# The website engine

A website begins when you say `make a website`.

## The site

```plain
make a website called "Ada's Corner"
set the theme to "dark"        # light, dark, ocean, forest, sunset
make a page called "Projects" at "/projects"
work on the page called "Home"
```

The first page is `/` (written as `index.html`). Every page after that gets
its own file.

## Putting things on the page

```plain
add a title "Ada's Corner"          # big heading
add a heading "Projects"
add a small heading "Pong"
add text "A paragraph."
add a note "Small, quiet text."
add a quote "Programs must be written for people to read."
add code "make score be 0"
add a list of "one", "two", "three"
add a link "Home" to "/"
add a picture "cat.png"
add a picture "cat.png" with words "A cat"
add a space
add a footer "Made with Plain."
```

## Grouping

```plain
add a card called "Today"
    add text "Learned about loops."
end

add a row
    add a card called "One"
        add text "left"
    end
    add a card called "Two"
        add text "right"
    end
end
```

A row lays its cards out side by side, and stacks them on a narrow screen.

## Things that react

```plain
add a text box named visitor with label "Your name"
add a big text box named story with label "Tell me more"
add text "..." named answer

add a button "Greet me"
    set the words of answer to "Hello, {typed in visitor}!"
end

add a button "Shout"
    show a message "Hello!"
end

when the page loads
    show a message "Welcome"
end
```

`typed in #name` reads a text box. `set the words of #name to $value` changes
any named piece of the page. `show a message` pops up a short note in the
browser, and prints to the terminal when there is no browser.

## Your own HTML, CSS, markdown and JavaScript

Plain writes the page for you, but it does not stand in your way. Styling can
be said as sentences:

```plain
set the page background to "#0f1020"
set the text colour to "#e8ecf4"
set the font to "Georgia, serif"
set the page width to 720
```

or written as the CSS you already know. **Use single quotes** — they are
taken exactly as typed, which matters because CSS is mostly braces:

```plain
add style '
.badge {
    padding: 4px 12px;
    border-radius: 999px;
    background: linear-gradient(90deg, #ff7a59, #ffd166);
}
'
```

Markup goes in the same way, exactly as written rather than escaped:

```plain
add html '<p class="tilt"><span class="badge">your own markup</span></p>'
```

And anything you have named can be styled by that name:

```plain
add a title "Handmade" named crown
style crown with 'letter-spacing: -0.03em; color: #ffd166'
```

When the words matter more than the markup, write markdown:

```plain
add markdown '
## A heading

The marks people already type: **bold**, *slanted*, `code`, and
[a link](https://example.com).

- lists
- of things

> and something worth quoting.
'
```

Headings, bold, slanted, code, links, pictures, lists, quotes, rules and
fenced code all work. Markdown is *read* rather than passed through, so a
stray `<` in your writing stays a `<`.

And JavaScript, for the corners a sentence has not reached yet:

```plain
add html '<p>Open for <span id="ticks">0</span> seconds.</p>'
add script '
var seconds = 0;
setInterval(function () {
  seconds += 1;
  document.getElementById("ticks").textContent = seconds;
}, 1000);
'
```

Your style comes after Plain's, so it wins. Style, markup, markdown and
script all reach the built pages, the live preview and the designer alike —
`examples/styled-site.plain` uses every one of them at once.

Two things worth knowing. Markup and script you add are **not** escaped —
that is the point of them, and it is your own page, but do not paste in
markup or code you were sent by somebody else. And neither a style nor a
script can close its own block early; Plain sees to that.

## The designer

```bash
plain edit site.plain
```

The live page sits on the left and a palette of blocks on the right. Click
anything on the page to change its words, move it up or down, or remove it;
add blocks from the palette; switch theme; add pages with `+`. **Save writes
the page back out as the sentences above**, including the inside of a button,
so a site you dragged and a site you typed are the same file.

---

# Adding your own sentences

The engines use the same door you do:

```js
import { createRuntime } from './src/runtime.js';
const plain = createRuntime();

plain.define('wave at $who', ({ who }, ctx) => ctx.output(`o/ ${who}`));
plain.define('three times ...', (args, ctx) => { for (let i = 0; i < 3; i++) ctx.block(); });
plain.defineValue('double $n', ({ n }) => n * 2);
plain.defineInfix('$a rhymes with $b', ({ a, b }) => a.slice(-2) === b.slice(-2));

plain.run('wave at "world"');
```

| In a spec | Means |
|---|---|
| `word` | that word, typed exactly |
| `$name` | a value |
| `#name` | a bare name (not looked up) |
| `$*name` | a comma separated list of values |
| `...` at the end | a block of lines, closed by `end` |

When two sentences could both match, the one with more fixed words wins.

The handler gets `(args, ctx)`. `ctx` has `output`, `fail`, `define`,
`lookup`, `assign`, `exists`, `block`, `line`, and `runtime`.

---

# Errors

Plain reports the line, prints it, and suggests a fix:

```
Line 3: I do not know a name called "scoer"

  3 | show scoer

Try this: make scoer be <value> before using it
```

`plain check file.plain` finds mistakes without running anything, and reports
**all** of them at once rather than stopping at the first:

```
I found 2 things to fix.

Line 2: I do not know how to start a line with "wibble"

  2 | wibble 3

Line 6: I expected a value but found the end of the line

  6 |     show x +
```

---

# Tidying a program

\
It re-indents, trims trailing spaces and collapses runs of blank lines. It
never rewrites your sentences, your spacing inside a line, or your comments.

---

# Tidying a program

```bash
plain fmt mine.plain        # fix the indenting
plain fmt .                 # every .plain file in this folder
plain fmt . --check         # say what needs it, change nothing
```

It re-indents, trims trailing spaces and collapses runs of blank lines. It
never rewrites your sentences, your spacing inside a line, or your comments.

---

# Learning it

```bash
plain learn            # the course, in your browser
plain learn --list     # the syllabus, in the terminal
```

Ten lessons, then six projects you build a step at a time. Each step runs your
program and looks at what it did, so the answer can be written your own way.
Games and websites run live inside the lesson.

---

# Writing it in another language

```bash
plain translate mine.plain --to javascript
plain translate mine.plain --to python
plain translate mine.plain --to csharp
plain translate mine.plain --to lua
plain translate mine.plain --to typescript
plain translate mine.plain --to ruby
plain translate mine.plain --to java
plain translate mine.plain --to go
plain translate mine.plain --to php
plain translate mine.plain --to all --out translated
```

Everything in this file up to here translates: names, sums, questions, loops,
lists, things, actions, kinds, catching problems. Sentences from the engines
(games, worlds, websites, videos) do not, and the translator lists them by
line rather than writing something that half works.

The generated file keeps your names and shape, and carries a small set of
helpers for the places where Plain means something particular: lists count
from 1, text joins with anything, `yes`/`no` decide truth, and dividing by
zero is refused rather than becoming infinity.

All four are checked by **running** them. Plain's test suite takes ten
programs, translates each one, runs the results, and insists every language
prints exactly the same thing as Plain did. If a language's tool is not on
the machine (no `python`, no `lua`, no dotnet SDK) that language is skipped
and the run says which ones it could not check.
