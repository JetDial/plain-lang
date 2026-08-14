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
| text | `"hi"`, `'hi'` | `{...}` inside text is filled in |
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

to shout with words and times
    repeat times times
        show uppercase of words
    end
end

show greet with "world"
shout with "hey" and 3
```

The name can be several words: `to add up with a and b` is called as
`add up with 3 and 4`. `give back` returns a value and ends the action.
Actions can be used before they are written.

## 10. Talking to the person running the program

```plain
show "hello"                 # print a line
ask "Your name? " into name  # read a line (a number if it looks like one)
stop the program
```

## 11. Built-in values

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
    ...
end

every 2 seconds
    ...
end

when ball touches paddle
    ...
end

when key "space" is pressed
    ...
end

when any key is pressed
    ...
end

when the mouse is clicked
    ...
end

when ball leaves the screen
    ...
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
```

Key names: `left`, `right`, `up`, `down`, `space`, `enter`, `escape`, `shift`,
and any letter or digit as itself (`"a"`, `"7"`).

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

`plain check file.plain` finds mistakes without running anything.
