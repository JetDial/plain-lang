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
`random item of $list`, `copy of $list`, `shuffled $list`.

`shuffled` hands back a new list in a random order and leaves the one you
gave it alone, which is what cards, questions, spawn points and turns all
need. Every item is swapped with one somewhere at or before it - the only
shuffle that treats every order as equally likely. The obvious version,
swapping each item with any other, quietly favours some orders over others.

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

A part is one .plain file. Two sentences at the top of it are how it says
what it is and what it leans on:

```plain
this part is called "dates" version "1.2.0"
this part needs "money" version "1.0.0" from "https://example.com/money.plain"
```

Those are ordinary sentences, not a comment and not a separate manifest, so
they are checked by the same parser as everything else - and `plain get`
reads them off a fetched file **without running a line of it**, which is the
only safe moment to decide whether to trust it. A comment that says the same
words is not a claim. Fetching one part fetches everything it needs, and
says so as it goes.

A part lands in `plain-parts/` and is written down in `plain-parts.json` with
its version, its size, its fingerprint and what it needs.

`plain get` with no address puts back exactly what this folder was using.
Anything that has changed at the far end is **refused**, not quietly taken:

    money  REFUSED - it has changed since you fetched it
      was 7913d33ade401cc5
      is  c2077a5227811d1d

`plain get --update` takes the new one on purpose. `plain remove dates`
stops using one, and says if anything else claimed to need it.
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

### Telling somebody

A receipt, a reset link, a nightly summary. Sending waits for its answer,
the way fetching does:

```plain
use the mail server "smtp.example.com" on port 587
sign in to the mail server as "me@example.com" with password "an app password"

send an email from "me@example.com" to "you@example.com" about "Your receipt" saying "Thank you."

show what the mail server said
```

Port 587 offers to lock the line and Plain takes it; port 465 is locked from
the first byte. Accents in a subject and in the words are carried the way a
mail server from 1982 expects, so nothing arrives as `?????`. An address
that is not one is refused before anything is sent, and a server that says
no says why:

    The mail server would not take that message: 550 no such person here

Most mail providers want a password made for programs rather than the one
you type, and will say so.

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

## The view

A game bigger than its window has to decide which part of it you are looking
at. Without help, every game ends up writing the same sum beside every single
thing it draws — `(x minus camx) times zoom plus half the width` — and getting
it wrong in one place leaves one kind of thing standing still while the world
slides past it.

```
point the view at x of hero , y of hero
zoom the view to 0.5

seen through the view
    draw a circle at 5000 , 3000 sized 100 colored "#7ee787"
end

draw "score {score}" at 20 , 20 sized 16 colored "#ffffff"
```

Anything drawn **inside** `seen through the view` is drawn where it belongs in
the world, at the size it is in the world. Anything drawn outside it is drawn
on the screen, which is where a score, a health bar and a menu want to be.

`view x`, `view y` and `view zoom` read it back. `view left`, `view right`,
`view top` and `view bottom` are which part of the world is on screen at all —
what you use to skip drawing the rest of it.

Also `draw a line from $x , $y to $x , $y thick $n colored $c`, which follows
the same rule.

## Editing a film, not only assembling one

Cutting one clip against the next is a slideshow. These are what make
something look edited, and every editor people pay for has all of them.

```
cross into the last clip over 1 seconds     two clips on screen at once
play the last clip at 0.5 speed             slow motion; the timeline knows
split the last clip at 3 seconds            the most used action there is
drift the last clip from 1 to 1.25          the slow push into a still
drift the last clip left
make the last clip 0.2 brighter
drain the colour from the last clip
tint the last clip "#4a6ea8"
```

A crossfade is not two fades that happen to meet — the first clip is still
there while the next arrives, which is why the film gets *shorter* by exactly
the overlap.

## Laying out a page, not only stacking it

```
start a row
    start a card
        add a heading "Morning"
        add text "High water at 06:12."
    end
    start a card
        add a heading "Evening"
    end
end

add a button "The whole week" going to "/week"

describe this page as "When the sea comes in, and when it goes out again."
set the page picture to "/cover.png"
```

A **row** puts things side by side and becomes a column on a telephone,
which is the whole of what a layout system does. A **card** is the box
everything on the modern web is made of. `describe this page as` is what a
search engine and a shared link show — leaving it out is why so many pages
appear as a bare address with no description.

## Scenes

A game is nearly always several games: a title screen, the playing, and the
bit at the end that says what happened. Each has its own things on screen and
its own rules, and none may run while another is showing.

```
scene "title"
    make banner be words "PRESS SPACE" at 400 , 300 sized 40 colored "#ffffff"
    when key "space" is pressed
        go to scene "playing"
    end
end

scene "playing"
    make ship be a plane at 400 , 300 sized 40 colored "#ffd166"
    every frame
        move ship right by 3
    end
end

when scene "playing" starts
    show "off we go"
end
```

Anything made or said **inside** a scene belongs to it: its things are drawn
only while it is showing, its blocks run only then. Anything **outside** every
scene belongs to all of them — which is what a score, a background and a piece
of music are.

The first scene described is the one that shows, so a game with scenes is
never staring at nothing. `go to scene "x"` switches, `the scene now` says
which is up, `showing scene "x"` asks.

Without this, a program ends up with `if the state is playing` wrapped around
every single block — hard to read, and easy to get wrong in one place.

## Names that are already words

Plain has a lot of sentences, and some of them start with a word you might
reasonably want as a name. Naming something `key` does not fail — and then
`key "left" is held` stops meaning what it did. Naming a field `keys` does not
fail either, and then `keys of thing` hands back the list of names inside it
rather than your field.

`plain check` says so:

```
Careful - these names are already words in Plain:
  line 1: "key" is how you say "key $key is held"
  line 3: "keys" is how you say "keys of $thing"
  Nothing is broken yet. But a sentence using one of these
  will mean the phrase, not your name.
```

It is a warning and not a refusal, because most of the time nothing goes
wrong — the two only collide when you write the sentence as well as the name.

## Tidying a number for showing

Showing a number to somebody almost never means showing all of it.
3.141592653589793 is a fact; 3.14 is what goes on a screen.

```
show round 3.14159265 to 2 places        3.14
make price be show 3.5 to 2 places as text     "3.50"
make named be pad "ada" to 8            "ada     "
make lined be pad "9" to 4 on the left  "   9"
```

The second one gives back text rather than a number, on purpose: money wants
"3.50" and a number cannot hold the difference between that and 3.5.

Padding lines things up in a column, which is most of what a table is.

## Checking your own work

A language that can build a server and a game and cannot say whether they
work is half a tool.

```
make score be 0
add 10 to score

check score is 10
check score is not 3
check that score is above 5
check "the score adds up" : score is 10

show how the checks went
```

Nothing is thrown. A failed check is written down and the program carries on,
because the second failure is usually the one that explains the first. A
failure says what it expected and what turned up:

```
1 of 4 checks failed
  expected 99 but got 10
```

Also `checks that passed`, `checks that failed`, and `forget the checks so
far`.

## Groups — one lot of things meeting another

A game with forty bullets and thirty rocks cannot name every pair. It has two
lots of things and one rule about what happens when one lot meets the other.

```
put bullet in the group "shots"
put rock in the group "rocks"

when anything in "shots" touches anything in "rocks"
    remove the one that touched from the game
    remove the other one from the game
end
```

A pair that is already touching does not fire again until it has come apart,
so "when a bullet hits a rock" happens once rather than every frame it is
still there.

## Facing and fading

```
face hero left            a drawing of somebody walking right, turned over
face hero right
turn hero over
set the fade of ghost to 0.4
```

`facing of hero` is 1 or -1, `fade of hero` runs from 0 to 1. Fading is how
anything appears, disappears, or flickers while it cannot be hurt.

## Lighting a world, and picking things out of it

One directional light was enough to see a world and not enough to make one.

```
set the shadows to 0.8              0 is flat, 1 is black shadows
set the light colour to "warm"
put a lamp at 0 , 4 , 0 reaching 14 colored "#ffb347"
move the lamp to 2 , 5 , 0
take the lamp away
set the haze to 0.4                 how much distance fades into the sky
```

A lamp is a light with a **place** rather than a direction: it falls off as
you walk away and lights the side of a thing that faces it. Haze is the
cheapest way to make a world feel large, because it stops the far edge of it
looking like an edge.

Out of somebody's own eyes, rather than over their shoulder:

```
look out of hero
look over the shoulder of hero
```

The camera sits where they are and looks the way they are facing. It is the
same following seen from a different place, which is all a first person
camera has ever been.

And the question a 3D program cannot answer without help:

```
show what is under the mouse
show what the camera is looking at
show what is at 400 , 300 on the screen
```

Every editor, strategy game and point-and-click needs this. It draws a line
out of the camera through that point on the screen and gives back whichever
body it meets first.

## Pictures

A picture could only be a *thing* - something made once that lives in the
world and is moved about. That is right for a hero and wrong for everything
else a game draws with pictures: a tiled floor, a row of hearts, a hundred
trees. Those are drawn, not kept.

```
draw the picture "grass.png" at 100 , 100 sized 64 by 64
draw the picture "hero.png" at 200 , 150 sized 48 by 48 turned 30
draw frame 3 of "walk.png" at 300 , 150 sized 48 by 48 with 4 by 2 frames
if is the picture "grass.png" ready ... end
```

A file is loaded once and remembered however many times it is drawn, so a
floor of four hundred tiles loads one file. Drawing goes through the view
like everything else, so pictures scroll and scale with the world.

Sheets - one file holding a grid of pictures - are how nearly every game's
artwork arrives, which is what `draw frame 3 of` is for.

## Arcs

```
draw an arc at 400 , 300 sized 90 from 120 to 240 thick 5 colored "#7ee787"
```

Part of a circle round a point, measured in degrees, going clockwise from
the right. A health bar curved round the thing it belongs to is read without
looking away from it, which is why every game that has one draws it there.

## Shaking, and text that centres itself

```
shake the view                              a short sharp one
shake the view by 14 for 0.5 seconds        as hard and as long as you like
if the view is shaking ... end

draw "BOOM" centred at 400 , 300 sized 40 colored "#ffd166"
```

A shake is hardest at the moment it happens and gone by the end, which is
what makes it read as an impact rather than a wobble. Centred text saves
measuring the letters yourself, which nobody should have to do to put a
title on a screen.

## Bits, sliding, and time

Three things every game engine has.

```
make a burst of 30 at 200 , 150 colored "#ff7a59"
make a slow burst of 20 at x of ship , y of ship colored "#888"

slide door to 350 , 150 over 1 seconds
if door is still sliding
    show "wait"
end

move ship by 90 times seconds since the last frame , 0
```

A **burst** is what an explosion, a splash, a puff of dust and a shower of
sparks all are: bits thrown out from a point that move themselves and fade.
Say it once.

A **slide** eases at both ends, because nothing in the world starts and stops
at full speed, and it happens on its own once said.

**`seconds since the last frame`** is how a game runs at the same speed on a
fast machine and a slow one. Multiply movement by it.

## Sounds a game actually needs

A game with no sound files should still be able to make a noise. A beep is a
pure tone, and nothing in the world is a pure tone — an explosion is a rush
of noise that dies away, a missile is noise sliding downwards, a pickup is a
short rise.

```
play a bang            an explosion
play a thud            something heavy landing
play a whoosh          something going past
play a blip at 660     a short note at that pitch
play a rising note     picked something up
play a falling note    lost something
```

No files, no downloads, nothing to install. `play the sound "x.mp3"` is still
there for when you have real recordings.

## Room — memory, without addresses

What a C programmer reaches for memory to do is nearly always one of two
things: put a known number of numbers side by side so the processor can read
them quickly, or hand a block to something else that will fill it in — a
decoder, a sound card, a device. Neither needs addresses. Both need a fixed
run of numbers with a known size.

```
make samples be room for 1024 numbers
put 0.5 at 1 of samples
show what is at 1 of samples
fill samples with 0
show how much room is in samples
```

A block is a list of numbers, so everything that works on those works here —
walking it, adding it up, handing it to a toolkit.

What is deliberately absent is any way to ask **where** a block is. No
address, so no arithmetic on addresses, and none of the mistakes that come of
it. Asking for position 2000 of a block of 1024 says so:

```
There is no position 2000 in a block of 1024
```

rather than reading whatever happened to be next door.

## Toolkits — code written in another language

The one thing C++ has that no amount of tidy design replaces: it can call the
library that already exists. Thirty years of image decoders, compression,
cryptography and physics are written in C, and a language that cannot reach
them has to rewrite all of it or go without.

The way in is WebAssembly, which is what a C library compiles to when it wants
to be portable. It works in a terminal and on a page and needs nothing
installed.

```
make sums be bytes of file "maths.wasm"
use the toolkit sums as maths

show what maths offers                    ["add", "multiply"]
show ask maths for "add" with 40 and 2    42
```

`ask $toolkit for $name`, `... with $one`, and `... with $one and $other`.

A toolkit takes numbers and gives numbers back. It cannot read your files or
open a socket unless you hand it the means — which is the same bargain
anybody choosing Plain has already made.

What this does **not** do is let Plain write a driver. That needs addresses,
and addresses are the thing this language is for not having. The answer there
is the same as this one: let the C library do the pointer work, and call it.

## Asking without waiting

Everything else Plain does over a wire stops the program until the answer
comes back. That is fine for a script and wrong for anything with people in
it: a game that freezes for a second has dropped sixteen frames, and a server
that freezes has stopped answering everybody else.

```
ask for "https://example.com/tides" and when it arrives
    if did it work
        show what arrived
    end
end
show "and the program carries straight on"
```

The next line runs immediately. The block runs when the answer turns up,
however long that takes. `what arrived` is the answer, `did it work` says
whether it was one.

Other languages solve this with promises and a word you must put in front of
every action that touches one. Plain already had the shape — `when someone
visits`, `every frame`, `when the server says something` — so this is that
same sentence pointed at a question, and nothing else in the language has to
change colour.

## Days

A day is written the way the world writes it down — `"2026-08-14"` — because
that is the one form that sorts correctly as text and reads correctly to a
person. Anywhere a day is wanted, `today` works too.

```
show the day after "2026-08-14"              2026-08-15
show the day 20 days after today
show the day 1 days before "2026-01-01"      2025-12-31
show days between "2026-08-14" and "2026-12-25"    133
show the weekday of "2026-08-14"             Friday
show the date "2026-08-14" in words          Friday 14 August 2026
```

Also `the year of`, `the month of`, `the day of`, `the month name of`,
`is $when a real day`, and the two questions: `$when is before $other`,
`$when is after $other`.

## Part of a list, and pages of one

```
show the first 5 of scores
show the last 2 of scores
show everything after the first 5 of scores
show page 2 of scores with 20 to a page
show how many pages in scores with 20 to a page
```

Pages count from 1, so page 1 is the first page. Asking for more than there
is gives you what there is rather than failing.

## Sets, without a second kind of list

Other languages hand you a whole new container for this. Here it is four
sentences about the lists you already have.

```
show unique [1, 2, 2, 3, 1]                          [1, 2, 3]
show everything in [1, 2, 3, 4] not in [2, 4]        [1, 3]
show everything in [1, 2, 3] also in [2, 3, 9]       [2, 3]
show everything in [1, 2] and [2, 5]                 [1, 2, 5]
```

## Bytes

Most of what computers send each other is not writing. A picture, a sound, or
a game speaking its own shorthand is a run of numbers from 0 to 255. In Plain
that run is an ordinary list, so everything you already know works on it —
`number of items in`, `item 3 of`, `for each`. These phrases do the packing.

```
make packet be []
add the byte 5 to packet
add the number 1234 in 2 bytes to packet
add the decimal 3.5 to packet
add the text "hi" to packet
show hex of packet                       05 d2 04 00 00 60 40 68 69
```

Reading it back: `the number in packet at 2 over 2 bytes`, `the decimal in
packet at 4`, `the text in packet at 8 for 2`, `the bytes in packet at 2 for
4`. Counting starts at 1, as everywhere else in Plain.

Also `bytes of text "..."`, `text of bytes ...`, `hex of ...` and `bytes from
hex "de ad be ef"` — the last two mainly so a test can say what it means.

Numbers are packed least important byte first, which is what nearly every
protocol and every ordinary computer uses.

To send them, a server says `tell connection 3 the bytes packet` or `tell them
the bytes packet`, and reads what arrived with `the bytes they sent`. A page
says `send the bytes packet to the server` and reads `the bytes the server
sent`. Writing and bytes travel differently on the wire, and a program that
expects a shorthand will ignore anything sent as writing — so the difference
is not cosmetic.

## Asking about the game

`key "left" is held`, `mouse x`, `mouse y`, `mouse is down`,
`ball touches paddle`, `distance from ball to paddle`, `game width`,
`game height`, `frame number`, `game time`.

`the key pressed` is which key set off the `when any key is pressed` you are
inside. A letter comes through as itself; the rest have names — `"enter"`,
`"space"`, `"backspace"`, `"escape"`, `"left"`. It is what lets somebody type
rather than only steer:

```
when any key is pressed
    if the key pressed is "enter"
        say what was typed
        set typed to ""
    otherwise if the key pressed is "backspace"
        make shorter be (length of typed) minus 1
        set typed to part of typed from 1 to shorter
    otherwise if length of the key pressed is 1
        set typed to typed joined with the key pressed
    end
end
```

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
