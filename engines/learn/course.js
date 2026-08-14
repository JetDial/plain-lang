// Plain - the course.
//
// Lessons teach one idea each; projects build something real, one step at a
// time. Every step has a `check` that looks at what the learner's program
// actually did, so "it works" is decided by running it, not by matching text.
//
// A check is given:
//   { lines, source, runtime, game, world, site, studio }
// and returns true when the step is done, or a sentence saying what is
// missing. Being wrong is normal here, so the sentences are hints.

const has = (source, ...words) =>
  words.every(word => source.toLowerCase().includes(word.toLowerCase()));

const said = (lines, text) =>
  lines.some(line => String(line).toLowerCase().includes(String(text).toLowerCase()));

// Every lesson shows a few lines and then says, in ordinary words, what each
// one is doing. Reading code is a skill of its own, and it is learned by
// being shown line by line - not by being told the names of things.
const walk = (rows) => '<div class="lines">' + rows.map(([code, means]) =>
  `<div><code>${String(code).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code><span>${means}</span></div>`
).join('') + '</div>';

export const LESSONS = [
  {
    id: 'showing',
    title: 'Showing things',
    teach: `<p>A Plain program is a list of instructions, one to a line, and the computer
does them from the top down like a recipe.</p>
<p>The first instruction to learn is <code>show</code>. It means: put this on
the screen where I can see it.</p>
<pre>show "Hello!"
show 6 times 7</pre>
` + walk([
      ['show "Hello!"', 'Put the words <b>Hello!</b> on the screen. The quote marks say "these are words, not an instruction" - so Plain does not try to understand them, it just shows them.'],
      ['show 6 times 7', 'Work out 6 times 7, then show the answer: <b>42</b>. No quote marks, so Plain does the sum instead of writing "6 times 7".']
    ]) + `
<p>That is the whole difference between the two lines: <b>quotes mean words,
no quotes means work it out</b>.</p>`,
    task: 'Show a greeting of your own, then show what 12 times 12 is.',
    start: 'show "Hello!"\n',
    check: ({ lines }) => {
      if (lines.length < 2) return 'Two lines this time: a greeting, and the sum.';
      if (!lines.some(line => String(line).includes('144'))) return 'Let Plain do the sum: show 12 times 12';
      return true;
    }
  },

  {
    id: 'names',
    title: 'Names hold values',
    teach: `<p>A program needs somewhere to put things it will want again - a score, a
name, a total. That is what a <i>name</i> is: a labelled box.</p>
<pre>make score be 0
set score to 10
show score</pre>
` + walk([
      ['make score be 0', 'Get a box, write <b>score</b> on the side, and put <b>0</b> in it. "make" is for the first time only.'],
      ['set score to 10', 'The box already exists. Take out what was in it and put <b>10</b> in instead.'],
      ['show score', 'Show what is <i>in</i> the box - 10 - not the word "score". No quote marks, remember.']
    ]) + `
<p>Two shortcuts, because adding and taking away is what people do most:</p>
` + walk([
      ['add 5 to score', 'Whatever is in the box, make it 5 bigger.'],
      ['take 2 from score', 'Whatever is in the box, make it 2 smaller.']
    ]) + ``,
    task: 'Make a name called <code>score</code>, add 10 to it twice, then show it. It should end up as 20.',
    start: 'make score be 0\n',
    check: ({ lines, source }) => {
      if (!has(source, 'make score')) return 'Start with: make score be 0';
      if (!lines.some(line => String(line).trim() === '20')) return 'The last line should show 20.';
      return true;
    }
  },

  {
    id: 'text',
    title: 'Putting values inside text',
    teach: `<p>You often want to show words and a value together - "Hello, Ada" rather
than "Ada" on its own. Curly braces do that.</p>
<pre>make name be "Ada"
show "Hello, {name}!"</pre>
` + walk([
      ['make name be "Ada"', 'A box called <b>name</b> with the word Ada in it.'],
      ['show "Hello, {name}!"', 'Everything inside the quotes is words - <i>except</i> what is in the curly braces. Plain swaps <code>{name}</code> for what is in the box, and shows <b>Hello, Ada!</b>']
    ]) + `
<p>Think of the braces as a gap you leave for Plain to fill in. Anything can
go in the gap, even a sum:</p>
<pre>show "Two dozen is {2 times 12}"</pre>
<p>which shows <b>Two dozen is 24</b>.</p>`,
    task: 'Make a name and an age, then show one sentence that uses both.',
    start: 'make name be "Ada"\nmake age be 36\n',
    check: ({ lines, source }) => {
      if (!source.includes('{')) return 'Use {curly braces} to put the values inside the text.';
      if (!lines.length) return 'Show the sentence when you have built it.';
      const line = lines[lines.length - 1];
      if (line.includes('{')) return 'Something is still in braces - check the name is spelled the same.';
      return true;
    }
  },

  {
    id: 'questions',
    title: 'Asking questions',
    teach: `<p>So far every line has happened. Often you want a line to happen
<i>only sometimes</i> - only if the score is high enough, only if the person
is old enough. That is what <code>if</code> is for.</p>
<pre>if score is above 10
    show "well done"
otherwise
    show "keep going"
end</pre>
` + walk([
      ['if score is above 10', 'Ask a question. If the answer is yes, do the lines underneath.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;show "well done"', 'This happens only when the answer was yes. It is pushed in from the left so you can see at a glance which lines belong to the question.'],
      ['otherwise', 'And if the answer was no, do these instead.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;show "keep going"', 'This happens only when the answer was no.'],
      ['end', 'The question is finished. Lines after this happen either way.']
    ]) + `
<p><b>Every block in Plain finishes with <code>end</code></b>, so you can
always see where something stops.</p>
<p>The questions read the way you would say them out loud: <code>is</code>,
<code>is not</code>, <code>is above</code>, <code>is below</code>,
<code>is at least</code>, <code>is at most</code>.</p>`,
    task: 'Make a name called <code>age</code>. Show "grown up" if it is at least 18, "teenager" if it is at least 13, and "child" otherwise.',
    start: 'make age be 15\n',
    check: ({ lines, source }) => {
      if (!has(source, 'otherwise')) return 'You will need "otherwise" for the other two answers.';
      if (!lines.length) return 'Nothing was shown - is the age inside one of the branches?';
      if (!said(lines, 'teenager')) return 'With age 15 it should say teenager. Check the order of your questions.';
      return true;
    }
  },

  {
    id: 'repeating',
    title: 'Doing something again',
    teach: `<p>Computers are good at doing the same thing over and over. Rather than
writing a line ten times, you write it once and say how often.</p>
<pre>repeat 3 times
    show "again"
end</pre>
` + walk([
      ['repeat 3 times', 'Do the lines underneath, three times over.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;show "again"', 'This is the line being repeated. It runs three times, so "again" appears three times.'],
      ['end', 'The end of what is being repeated.']
    ]) + `
<p>Usually you want to know <i>which</i> turn you are on - to number a list,
or build a times table. Then you give the turn a name:</p>
` + walk([
      ['repeat with n from 1 to 5', 'Do the lines underneath five times. On the first turn <b>n</b> is 1, then 2, and so on up to 5.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;show n', 'Shows 1, then 2, then 3, then 4, then 5 - one on each turn.'],
      ['end', '']
    ]) + `
<p>And when you do not know how many turns it will take, you repeat until
something changes:</p>
` + walk([
      ['while lives is above 0', 'Keep going for as long as that stays true. Check the question, do the lines, check again.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;take 1 from lives', 'Something in here has to change, or it never stops.'],
      ['end', '']
    ]) + ``,
    task: 'Show the 7 times table, from 7 up to 70, one line each.',
    start: 'repeat with n from 1 to 10\n\nend\n',
    check: ({ lines }) => {
      if (lines.length < 10) return `That gave ${lines.length} lines; ten are needed.`;
      const numbers = lines.map(line => Number(String(line).match(/\d+$/)?.[0]));
      if (!String(lines[0]).includes('7')) return 'The first line should have 7 in it.';
      if (!numbers.includes(70) && !lines.some(line => String(line).includes('70'))) {
        return 'The last one should be 70. Try: show n times 7';
      }
      return true;
    }
  },

  {
    id: 'lists',
    title: 'Lists',
    teach: `<p>One box holds one thing. A <i>list</i> is a box that holds several, in
order - a shopping list, the scores in a game, the people in a room.</p>
<pre>make shopping be a list of "bread", "milk"
add "apples" to shopping
show item 1 of shopping</pre>
` + walk([
      ['make shopping be a list of "bread", "milk"', 'A box called <b>shopping</b> holding two things, in that order.'],
      ['add "apples" to shopping', 'Put another one on the end. The list is now three long.'],
      ['show item 1 of shopping', 'Show the first thing: <b>bread</b>. Plain counts from 1, because that is how people count - the first is item 1, not item 0.']
    ]) + `
<p>Doing something to every one of them is a loop that names each in turn:</p>
` + walk([
      ['for each item in shopping', 'Go through the list from the front. Each time round, <b>item</b> is the next thing on it.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;show item', 'Runs once for each thing on the list: bread, then milk, then apples.'],
      ['end', '']
    ]) + ``,
    task: 'Build a list of at least three things, add one more, then show each one on its own line.',
    start: 'make shopping be a list of "bread", "milk"\n',
    check: ({ lines, source }) => {
      if (!has(source, 'for each')) return 'Use "for each" to go through the list.';
      if (lines.length < 4) return 'There should be at least four things shown, one per line.';
      return true;
    }
  },

  {
    id: 'things',
    title: 'Things with named values',
    teach: `<p>Sometimes several values belong together: a person has a name <i>and</i> an
age <i>and</i> a town. Keeping them in three separate boxes gets confusing
fast. A <i>thing</i> keeps them in one, each with a label.</p>
<pre>make player be { name: "Ada", health: 100 }
show name of player
set the health of player to 80</pre>
` + walk([
      ['make player be { name: "Ada", health: 100 }', 'One box called <b>player</b> holding two labelled values. The curly braces gather them up; the labels are on the left of each colon.'],
      ['show name of player', 'Reach into the box and read the one labelled <b>name</b>. Shows Ada.'],
      ['set the health of player to 80', 'Reach in and change the one labelled <b>health</b>. The name is untouched.']
    ]) + `
<p><code>something of something</code> is the shape to remember: the label
first, then what it belongs to - the way you would say "the name of the
player" out loud.</p>`,
    task: 'Make a thing with a name and a health. Take 30 off its health, then show a sentence with both values in it.',
    start: 'make player be { name: "Ada", health: 100 }\n',
    check: ({ lines, source }) => {
      if (!has(source, 'set the health')) return 'Change the health with: set the health of player to ...';
      if (!said(lines, '70')) return 'After taking 30 off 100 the health should be 70.';
      return true;
    }
  },

  {
    id: 'actions',
    title: 'Actions of your own',
    teach: `<p>When you find yourself writing the same handful of lines again, give them a
name and write them once. That is an <i>action</i>: your own instruction,
which then works exactly like Plain's own.</p>
<pre>to greet with person
    give back "Hello, " joined with person
end

show greet with "world"</pre>
` + walk([
      ['to greet with person', 'Teach Plain a new instruction called <b>greet</b>. It expects one thing to be handed to it, and inside these lines that thing is called <b>person</b>.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;give back "Hello, " joined with person', '<b>joined with</b> glues two pieces of text together. <b>give back</b> hands the answer to whoever asked, and stops here.'],
      ['end', 'The end of the instruction.'],
      ['show greet with "world"', 'Use it. "world" goes in as <b>person</b>, "Hello, world" comes back, and show puts it on the screen.']
    ]) + `
<p>An action does not have to give anything back - some just do something. And
you can use one anywhere in your program, even above the place you wrote it.</p>`,
    task: 'Write an action that takes a number and gives back double it, then show it used twice with different numbers.',
    start: 'to double with n\n\nend\n',
    check: ({ lines, source }) => {
      if (!has(source, 'give back')) return 'The action needs to "give back" its answer.';
      if (lines.length < 2) return 'Use the action twice, with different numbers.';
      return true;
    }
  },

  {
    id: 'kinds',
    title: 'Kinds of your own',
    teach: `<p>A <i>thing</i> is one bag of labelled values. A <i>kind</i> is a pattern for
making lots of them the same shape - and it can carry instructions of its
own, so a dog knows how to bark without you writing it out each time.</p>
<pre>a kind called Dog
    has name
    has sound be "woof"

    to speak
        show "{name of me} says {sound of me}"
    end
end

make rex be a new Dog with name "Rex"
tell rex to speak</pre>
` + walk([
      ['a kind called Dog', 'Describe a sort of thing. Nothing is made yet - this is the pattern, not a dog.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;has name', 'Every Dog has a name. No value here, so it must be filled in when one is made.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;has sound be "woof"', 'Every Dog has a sound, and unless you say otherwise it is "woof".'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;to speak', 'An instruction that belongs to Dogs. Inside it, <b>me</b> means the particular dog being spoken to.'],
      ['make rex be a new Dog with name "Rex"', 'Now make one, and fill in the name. It gets "woof" for free.'],
      ['tell rex to speak', 'Ask that dog to do its own instruction. Shows <b>Rex says woof</b>.']
    ]) + `
<p><code>tell</code> when you just want it done; <code>ask</code> when you want
the answer back: <code>show ask rex to fetch with "ball"</code>.</p>`,
    task: 'Write a kind with at least one value and one action, make two of them with different values, and tell both to do something.',
    start: 'a kind called Dog\n    has name\n\nend\n',
    check: ({ lines, source }) => {
      if (!has(source, 'a kind called')) return 'Start the kind with: a kind called Something';
      if (!has(source, 'tell ')) return 'Use "tell <name> to <action>" to make one of them do something.';
      if (lines.length < 2) return 'Make two of them, and tell each one to do something.';
      return true;
    }
  },

  {
    id: 'keeping',
    title: 'Keeping things after the program stops',
    teach: `<p>When a program stops, everything it was holding is gone. That is fine for a
sum and hopeless for a high score. <code>remember</code> puts something
somewhere it will still be next time.</p>
<pre>make best be remembered "best score" or 0
remember 12 as "best score"</pre>
` + walk([
      ['make best be remembered "best score" or 0', 'Look for something kept under the label <b>best score</b>. If this is the very first run there is nothing there, so use 0 instead. Without the "or 0" the first run would have nothing to work with.'],
      ['remember 12 as "best score"', 'Put 12 away under that label. Next time the program runs, it is still there.']
    ]) + `
<p>The label is just a word you choose, and it has nothing to do with the name
of any box - it is how you find the value again later.</p>
<p>In a terminal this lives in a small file beside your program; on a page it
lives in the browser. Either way you do not have to set anything up.</p>`,
    task: 'Keep a best score. Read it with a fallback of 0, make up a score, keep it only if it beats the old one, then show both.',
    start: 'make best be remembered "best score" or 0\n',
    check: ({ lines, source }) => {
      if (!has(source, 'remembered')) return 'Read the old one with: remembered "best score" or 0';
      if (!has(source, 'remember ')) return 'Keep the new one with "remember ... as ...".';
      if (lines.length < 2) return 'Show the score you made up and the best one.';
      return true;
    }
  },

  {
    id: 'problems',
    title: 'When things go wrong',
    teach: `<p>Some lines can go wrong through no fault of yours: a sum divides by zero, a
file is not there, somebody types letters where a number should be. Left
alone, that stops the whole program. <code>try</code> catches it instead.</p>
<pre>try
    show 1 divided by 0
if it fails
    show "I could not do that: {the problem}"
end</pre>
` + walk([
      ['try', 'Do the lines underneath, but be ready for them to go wrong.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;show 1 divided by 0', 'This cannot be done. Normally the program would stop right here.'],
      ['if it fails', 'It went wrong, so carry on from here instead of stopping.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;show "I could not do that: {the problem}"', '<b>the problem</b> holds what went wrong, in words. Showing it is how you find out.'],
      ['end', '']
    ]) + `
<p>You can raise one yourself when something is wrong in a way only you can
know about:</p>
<pre>report a problem saying "there is nobody to share with"</pre>`,
    task: 'Write an action that shares sweets between people, and reports a problem when there are no people. Call it twice: once that works, once that fails, and catch the failure.',
    start: 'to share with sweets and people\n\nend\n',
    check: ({ lines, source }) => {
      if (!has(source, 'report a problem')) return 'Raise the problem with: report a problem saying "..."';
      if (!has(source, 'if it fails')) return 'Catch it with try ... if it fails ... end';
      if (lines.length < 2) return 'Show both the answer that works and the message you caught.';
      return true;
    }
  },

  {
    id: 'shapes',
    title: 'The shapes data comes in',
    teach: `<p>Data written down by other programs nearly always arrives in one of two
shapes. Plain reads and writes both, so you do not have to pick them apart
by hand.</p>
<p><b>JSON</b> is what web services send back. It is labelled values, like a
thing, written as text:</p>
<pre>make person be thing from json '{"name": "Ada", "years": [1815, 1852]}'
show value "name" of person</pre>
` + walk([
      ['make person be thing from json \'...\'', 'Take that text and turn it into a real thing you can read from. Note the <b>single</b> quotes: JSON is full of curly braces, and inside "double quotes" Plain would think braces were gaps to fill in.'],
      ['show value "name" of person', 'Read the labelled value out. Shows Ada.']
    ]) + `
<p><b>CSV</b> is what spreadsheets save. It is rows of values with commas
between them:</p>
<pre>make table be rows of "name,note
Ada,\\"likes, commas\\"
Bob,two"
show item 2 of item 2 of table</pre>
` + walk([
      ['make table be rows of "..."', 'Turn that text into a list of rows, and each row into a list of what was in it.'],
      ['show item 2 of item 2 of table', 'Row 2, then column 2 of that row: <b>likes, commas</b>. Notice the comma inside it did not split the row, because it was in quotes - that is the part people usually get wrong by hand.']
    ]) + ``,
    task: 'Read the JSON below into a name, show the town, then show the whole thing back as JSON.',
    start: `make place be thing from json '{"town": "Bath", "founded": 60}'
`,
    check: ({ lines, source }) => {
      if (!has(source, 'thing from json')) return 'Start with: make place be thing from json \'...\'';
      if (!said(lines, 'Bath')) return 'Show the town: show value "town" of place';
      if (!lines.some(line => String(line).includes('{'))) return 'Show it back out with: show json of place';
      return true;
    }
  },

  {
    id: 'ownmarkup',
    title: 'Your own HTML, CSS and markdown',
    teach: `<p>Plain writes web pages for you. But sometimes you already know exactly what
you want, and it should get out of the way. It does.</p>
<p>Styling can be said as sentences:</p>
<pre>make a website called "Mine"
set the page background to "#0f1020"
set the font to "Georgia, serif"</pre>
<p>Or written as the CSS you already know. <b>Use single quotes here</b>:</p>
` + walk([
      ["add style '.badge { border-radius: 999px }'", 'Your own styling, taken exactly as typed. Single quotes matter: CSS is mostly curly braces, and inside "double quotes" Plain treats braces as gaps to fill in - so your CSS would come out mangled.'],
      ['add html \'&lt;p&gt;&lt;b&gt;mine&lt;/b&gt;&lt;/p&gt;\'', 'Your own markup, put on the page exactly as written.'],
      ['add markdown \'## A heading with **bold**\'', 'The marks people already type. This one is <i>read</i> and turned into a page, so a stray &lt; in your writing stays a &lt;.']
    ]) + `
<p>Anything you have named can be styled by that name later:</p>
<pre>add a title "Handmade" named crown
style crown with 'color: #ffd166'</pre>`,
    task: 'Make a website, give it a background of your choosing, add a title with a name, and style that title by its name.',
    start: `make a website called "Mine"
set the page background to "#0f1020"
add a title "Handmade" named crown
`,
    check: ({ source, site }) => {
      if (!has(source, 'make a website')) return 'Start with: make a website called "Mine"';
      if (!site || !site.styles || !site.styles.length) return 'Set a background, or add some style of your own.';
      if (!has(source, 'named')) return 'Give the title a name: add a title "..." named crown';
      if (!has(source, 'style ')) return 'Now style it by that name: style crown with \'color: #ffd166\'';
      return true;
    }
  },
  {
    id: 'serving',
    title: 'A program that answers',
    teach: `
<p>Everything so far has run once, top to bottom, and stopped. A program
behind a website is the other way round: it starts, and then <i>waits</i>.
Somebody opens an address, the program wakes up, works out an answer, and
goes back to waiting.</p>
<p>So instead of one list of instructions, you write several small ones and
say which address each belongs to.</p>
<pre>when someone visits "/"
    answer with "&lt;h1&gt;Hello&lt;/h1&gt;"
end

when someone visits "/about"
    answer with "&lt;p&gt;A page about me.&lt;/p&gt;"
end</pre>
` + walk([
      ['when someone visits "/"', 'Not "do this now". It means: <b>keep this, and do it whenever</b> somebody opens the front page. The "/" is the address, the bit after the site name.'],
      ['&nbsp;&nbsp;&nbsp;&nbsp;answer with "..."', 'What to send back. Whatever you answer with is what appears in their browser.'],
      ['end', 'The end of that one. The next "when someone visits" is a different address.']
    ]) + `
<p>In your terminal you would finish with <code>start serving on port
3000</code> and open <code>localhost:3000</code>. Here in the course there is
no port to open, so <b>Run</b> just sets the answers up and shows you what
each one would send back.</p>
<p>Two things worth having straight away:</p>
` + walk([
      ['answer with "..."', 'Anything - a whole page of markup, or a single word.'],
      ['send them to "/"', 'Do not answer at all; tell their browser to go and look at a different address instead. This is what you do after somebody fills in a form.'],
      ['answer that nothing is there', 'The "404" everybody has seen. Use it when they ask for something that does not exist.']
    ]) + ``,
    task: 'Set up two addresses: <code>"/"</code> answering with a greeting, and <code>"/about"</code> answering with something about you.',
    start: `when someone visits "/"
    answer with "<h1>Hello</h1>"
end
`,
    check: ({ runtime }) => {
      const server = runtime.server;
      if (!server || server.routes.length < 2) return 'Two addresses are wanted: "/" and "/about".';
      const paths = server.routes.map(route => route.path);
      if (!paths.includes('/')) return 'One of them should be "/", the front page.';
      if (!paths.includes('/about')) return 'The other should be "/about".';
      for (const route of server.routes) {
        server.answer = null;
        route.run();
        if (!server.answer || !String(server.answer.body).trim()) {
          return `The address "${route.path}" does not answer with anything yet.`;
        }
      }
      return true;
    }
  },

  {
    id: 'tables',
    title: 'Keeping things people typed',
    teach: `
<p>A list is forgotten the moment the program stops. <code>remember</code>
keeps one value. But a website needs to keep <i>many</i> of something - every
note, every order, every comment - and be able to find one again later.</p>
<p>That is a <b>table</b>. Think of a notebook with numbered lines: you write
things on new lines, and the line number is how you find one again.</p>
<pre>make notes be a table called "notes"
save { title: "Buy bread", done: no } in notes
show number of rows in notes</pre>
` + walk([
      ['make notes be a table called "notes"', 'Open the notebook called <b>notes</b>. If it does not exist yet, it is started. If it does, everything already in it is still there - including from the last time the program ran.'],
      ['save { title: "Buy bread", done: no } in notes', 'Write a new line in it. What you save is a thing - labelled values, as in an earlier lesson. Plain gives it a number of its own, called its <b>id</b>.'],
      ['show number of rows in notes', 'How many lines the notebook has.']
    ]) + `
<p>Getting things back out is the part that matters. There are four questions
you will ask over and over:</p>
` + walk([
      ['every row of notes', 'All of them, as a list you can go through with "for each".'],
      ['row 3 of notes', 'The one numbered 3 - the id it was given when it was saved.'],
      ['rows of notes where "done" is no', 'Only the ones that match. This is the one you will use most.'],
      ['rows of notes sorted by "title"', 'All of them, in order.']
    ]) + `
<p>And two for changing what is there:</p>
` + walk([
      ['change row 3 of notes to { title: "Buy two loaves", done: no }', 'Replace line 3 with something else. It keeps the same number.'],
      ['remove row 3 from notes', 'Cross that line out.']
    ]) + `
<p>Every row is an ordinary thing, so <code>title of note</code> works exactly
the way it did in the lesson on things.</p>`,
    task: 'Make a table, save two things in it, then show how many there are and the title of the first one.',
    start: `make notes be a table called "practice"
empty the table notes
`,
    check: ({ lines, source, runtime }) => {
      if (!has(source, 'a table called')) return 'Start with: make notes be a table called "practice"';
      if (!has(source, 'save ')) return 'Put something in it: save { title: "..." } in notes';
      if (!lines.some(line => String(line).trim() === '2')) return 'Show how many rows there are - it should be 2.';
      if (lines.length < 2) return 'Show the title of one of them as well.';
      return true;
    }
  },

  {
    id: 'forms',
    title: 'Taking what somebody typed, and knowing who they are',
    teach: `
<p>A page that only shows things is half a website. The other half is a
<b>form</b>: a box somebody types in and a button they press.</p>
<p>When they press it, their browser sends what they typed to an address of
your choosing. So you need two pieces: one that shows the form, and one that
catches what was sent.</p>
<pre>when someone visits "/"
    answer with "&lt;form method='post' action='/notes'&gt;
        &lt;input name='title'&gt;&lt;button&gt;Add&lt;/button&gt;&lt;/form&gt;"
end

when someone sends to "/notes"
    save { title: the form field "title" } in notes
    send them to "/"
end</pre>
` + walk([
      ['when someone <b>visits</b> "/"', 'Somebody is <i>looking</i>. Send back the page with the form on it.'],
      ["&lt;input name='title'&gt;", 'The box they type in. The <b>name</b> is the label their browser puts on it, and it is how you fetch it back on the other side.'],
      ["action='/notes'", 'Where the browser should send it when the button is pressed.'],
      ['when someone <b>sends</b> to "/notes"', 'Somebody is <i>sending</i>, not looking. A different sentence, so the two never get confused.'],
      ['the form field "title"', 'What they typed in the box labelled title.'],
      ['send them to "/"', 'Do not answer with a page. Tell their browser to go back to the front page, which will now show the new note. Without this, pressing refresh would send it all over again.']
    ]) + `
<p><b>Never put what somebody typed straight onto a page.</b> They can type
markup, and it will be treated as markup. Turn the dangerous letters into
harmless ones first - the guest book project does exactly that.</p>
<p>The other half of a real site is knowing <i>who</i> is asking. Every
browser is quietly given a tag, and Plain keeps things against that tag:</p>
` + walk([
      ['sign this visitor in as "Ada"', 'Remember, for this browser only, that it is Ada.'],
      ['who is signed in', 'Gives back "Ada" for that browser, and <b>nothing</b> for anybody else. This is how one person sees their things and not yours.'],
      ['keep 3 as "basket" for this visitor', 'Keep anything you like against them, not only a name.']
    ]) + `
<p>None of it leaves the machine your program runs on - the browser only
carries the tag.</p>`,
    task: 'Set up an address people can send to. Take a form field called <code>name</code>, sign the visitor in under it, then send them back to "/".',
    start: `when someone sends to "/hello"

end
`,
    check: ({ runtime }) => {
      const server = runtime.server;
      if (!server || !server.routes.length) return 'Start with: when someone sends to "/hello"';
      const posting = server.routes.find(route => route.method === 'POST');
      if (!posting) return 'Use "when someone sends to", not "when someone visits" - a form is sending, not looking.';
      server.asked = { ...server.asked, tag: 'learner', sent: 'name=Ada', kind: 'application/x-www-form-urlencoded' };
      server.answer = null;
      posting.run();
      const who = server.visitors.get('learner') || {};
      if (who.signedIn === undefined) return 'Sign them in with what they typed: sign this visitor in as the form field "name"';
      if (String(who.signedIn) !== 'Ada') return `They typed "Ada", but you signed them in as "${who.signedIn}" - read the field called name.`;
      if (!server.answer || server.answer.code !== 303) return 'Finish by sending them somewhere: send them to "/"';
      return true;
    }
  }
];

export const PROJECTS = [
  {
    id: 'quiz',
    title: 'Project: a quiz that marks itself',
    about: 'Lists, things, loops and actions, all in one small program.',
    steps: [
      {
        task: 'Make a list called <code>questions</code>. Each item is a thing with an <code>ask</code> and an <code>answer</code>. Put three in.',
        start: `make questions be [
    { ask: "2 plus 2", answer: 4 },
    { ask: "5 times 3", answer: 15 }
]
show length of questions
`,
        check: ({ lines, source }) => {
          if (!has(source, 'questions')) return 'Call the list "questions".';
          if (!said(lines, '3')) return 'Show the length - there should be three questions.';
          return true;
        }
      },
      {
        task: 'Go through the questions and show each one, numbered: "1. 2 plus 2". A "for each" loop or a counting loop, whichever you like.',
        check: ({ lines }) => {
          if (lines.length < 3) return `Only ${lines.length} line(s) came out; all three questions should be shown.`;
          const numbered = lines.filter(line => /^\s*\d/.test(String(line)));
          if (numbered.length < 3) return 'Number them: "1. ...", "2. ...", "3. ...".';
          if (!/^\s*1\D/.test(String(numbered[0]))) return 'The numbering should start at 1.';
          if (String(numbered[0]).replace(/^\s*\d\D*/, '').trim().length < 3) {
            return 'Show the question itself after the number, not just the number.';
          }
          return true;
        }
      },
      {
        task: 'Write an action <code>mark with given and wanted</code> that gives back yes when they match. Use it on every question with a pretend answer, and count the score.',
        check: ({ lines, source }) => {
          if (!has(source, 'to mark')) return 'Write the action: to mark with given and wanted';
          if (!has(source, 'score')) return 'Keep a name called score and add to it.';
          if (!lines.length) return 'Show the score at the end.';
          return true;
        }
      },
      {
        task: 'Finish it: show the score out of the number of questions, and a different message for full marks.',
        check: ({ lines, source }) => {
          if (!has(source, 'if ')) return 'Use an "if" to pick the message.';
          if (!said(lines, 'out of') && !lines.some(line => String(line).includes('/'))) {
            return 'Show something like "You got 2 out of 3".';
          }
          return true;
        }
      }
    ]
  },

  {
    id: 'site',
    title: 'Project: a website about you',
    about: 'The website engine. Everything you add here is a real page.',
    steps: [
      {
        task: 'Start a website with a title and a paragraph about it.',
        start: `make a website called "About Me"

add a title "About Me"
add text "Written in Plain."
`,
        check: ({ site }) => {
          if (!site.pages[0].nodes.length) return 'Add a title and some text to the page.';
          if (!site.pages[0].nodes.some(node => node.kind === 'title')) return 'Every page wants a title: add a title "..."';
          return true;
        }
      },
      {
        task: 'Add a card with a heading and a list of three things you like.',
        check: ({ site }) => {
          const card = site.pages[0].nodes.find(node => node.kind === 'card');
          if (!card) return 'Add a card:  add a card called "..."  then the things inside, then end';
          if (!card.children.some(child => child.kind === 'list')) return 'Put a list inside the card: add a list of "a", "b", "c"';
          return true;
        }
      },
      {
        task: 'Add a button that shows a message when it is pressed.',
        check: ({ site }) => {
          const button = site.pages[0].nodes.find(node => node.kind === 'button');
          if (!button) return 'add a button "Press me"  then what it does, then end';
          if (!button.props.source || !button.props.source.trim()) return 'Put a line inside the button, like: show a message "Hello"';
          return true;
        }
      },
      {
        task: 'Add a second page, give it a title, and set the theme to something you like (light, dark, ocean, forest, sunset).',
        check: ({ site }) => {
          if (site.pages.length < 2) return 'Add another page: make a page called "Projects" at "/projects"';
          if (!site.pages[1].nodes.length) return 'The second page is empty - give it a title too.';
          if (site.theme === 'light') return 'Try a different theme: set the theme to "dark"';
          return true;
        }
      }
    ]
  },

  {
    id: 'game',
    title: 'Project: catch the falling star',
    about: 'The 2D game engine: things, keys, frames and touching.',
    steps: [
      {
        task: 'Start a game, and make a basket near the bottom and a star at the top.',
        start: `start a game called "Catch" sized 640 by 480
set the background to "#141225"

make basket be a box at 320 , 440 sized 90 by 18 colored "#ffd166"
`,
        check: ({ game }) => {
          if (!game.started) return 'Begin with: start a game called "Catch" sized 640 by 480';
          if (game.things.length < 2) return 'Two things are needed: a basket and a star.';
          return true;
        }
      },
      {
        task: 'Make the star fall, by setting its speed downwards.',
        check: ({ game }) => {
          const falling = game.things.some(thing => thing.dy > 0);
          if (!falling) return 'Set the star moving: set the speed of star to 0 , 4';
          return true;
        }
      },
      {
        task: 'Every frame, move the basket with the left and right arrow keys, and keep it on the screen.',
        check: ({ game, runtime }) => {
          if (!game.everyFrame.length) return 'Add an "every frame" block.';
          game.press('right');
          const before = game.things[0].x;
          game.simulate(3);
          game.release('right');
          if (game.things[0].x === before) return 'Holding right should move the basket: if key "right" is held ... end';
          return true;
        }
      },
      {
        task: 'When the star touches the basket, add 1 to a score and send the star back to the top. Draw the score each frame.',
        check: ({ game, runtime, source }) => {
          if (!game.collisions.length) return 'Add: when star touches basket ... end';
          if (!has(source, 'score')) return 'Keep a name called score.';
          if (!has(source, 'draw ')) return 'Show it on screen: draw "score {score}" at 18 , 16';
          return true;
        }
      }
    ]
  },

  {
    id: 'world',
    title: 'Project: a world in three dimensions',
    about: 'The 3D engine. Same sentences, one more direction.',
    steps: [
      {
        task: 'Start a world with a floor and something to walk about as.',
        start: `start a world called "Moon Walk" sized 900 by 600
set the sky to "#0b1020"
set world gravity to 0.02

make ground be a floor at 0 , 0 , 0 sized 60 by 60 colored "#2c3a4f"
`,
        check: ({ world }) => {
          if (!world.started) return 'Begin with: start a world called "..." sized 900 by 600';
          if (world.bodies.length < 2) return 'Add a hero as well as the floor: make hero be a cube at 0 , 1 , 0 sized 1.6 colored "#ffd166"';
          return true;
        }
      },
      {
        task: 'Point the camera at your hero by following it.',
        check: ({ world }) => {
          if (!world.camera.follow) return 'Add: follow hero with the camera';
          return true;
        }
      },
      {
        task: 'Every frame, turn with the left and right keys and walk forward with the up key.',
        check: ({ game, world }) => {
          if (!game.everyFrame.length) return 'Add an "every frame" block.';
          const hero = world.camera.follow || world.bodies[1];
          const facing = hero.turnY;
          game.press('left');
          game.simulate(3);
          game.release('left');
          if (hero.turnY === facing) return 'Holding left should turn the hero: if key "left" is held ... turn hero left by 3 ... end';
          const spot = { x: hero.x, z: hero.z };
          game.press('up');
          game.simulate(3);
          game.release('up');
          if (hero.x === spot.x && hero.z === spot.z) return 'Holding up should walk: move hero forward by 0.2';
          return true;
        }
      },
      {
        task: 'Add something to collect. When the hero touches it, count it and move it somewhere random.',
        check: ({ game, world, source }) => {
          if (world.bodies.length < 3) return 'Add a prize: make prize be a ball at -6 , 1 , -8 sized 1.4 colored "#ef476f"';
          if (!game.collisions.length) return 'Add: when hero touches prize ... end';
          if (!has(source, 'random')) return 'Move it somewhere random: move prize to random -20 to 20 , 1 , random -20 to 20';
          return true;
        }
      }
    ]
  },

  {
    id: 'video',
    title: 'Project: a title sequence',
    about: 'The video engine: a timeline you can watch and export.',
    steps: [
      {
        task: 'Start a video and add a title card that lasts three seconds.',
        start: `make a video called "My Film" sized 1280 by 720

add a title "My Film" for 3 seconds
`,
        check: ({ studio }) => {
          if (!studio.started) return 'Begin with: make a video called "..." sized 1280 by 720';
          if (!studio.clips.length) return 'Add a title: add a title "My Film" for 3 seconds';
          return true;
        }
      },
      {
        task: 'Fade the title in, and add two coloured cards after it with words over them.',
        check: ({ studio }) => {
          if (!studio.clips[0].fadeIn) return 'Add: fade the last clip in over 1 seconds';
          if (studio.clips.length < 3) return 'Add two more cards: add a background "#1b2a41" for 2 seconds';
          if (!studio.clips.some(clip => clip.overlay)) return 'Put words on one: put the words "..." on the last clip';
          return true;
        }
      },
      {
        task: 'Finish with a closing title that fades out, and make the whole film at least ten seconds long.',
        check: ({ studio }) => {
          const last = studio.clips[studio.clips.length - 1];
          if (!last || !last.fadeOut) return 'The last clip should fade out.';
          if (studio.length < 10) return `The film is ${studio.length.toFixed(1)} seconds; make it at least ten.`;
          return true;
        }
      }
    ]
  },

  {
    id: 'translate',
    title: 'Project: the same program in eleven languages',
    about: 'Write it once in Plain, read it in JavaScript, Python, Java, Go, Rust, C and five more.',
    steps: [
      {
        task: 'Write a small program with a name, a loop and an action of your own, and get it working here.',
        teach: `
<p>Plain can write your program out in eleven other languages. Not a rough
translation - real loops, real classes, real functions, with your names kept,
and the same answers when you run them.</p>
<p>The point is not to leave Plain. It is that what you learn here is not
stuck here: the loop you are about to write is the same loop in all twelve.</p>`,
        start: `to double with n
    give back n times 2
end

make total be 0
repeat with n from 1 to 5
    add double with n to total
end
show "total is {total}"
`,
        check: ({ lines, source }) => {
          if (!has(source, 'to ')) return 'Include an action of your own: to double with n ... end';
          if (!has(source, 'repeat')) return 'Include a loop, so you can go looking for it in the other languages.';
          if (!lines.length) return 'Show something at the end so you can compare the answers.';
          return true;
        }
      },
      {
        task: 'Press <b>Translate</b> below the editor. Find <i>your</i> loop in the JavaScript, then in the Python, then in the Go.',
        teach: `
<p>Read three of them side by side and you will see the same shape three
times over. That is worth more than any explanation of what a loop is.</p>
<p>Look at what changes and what does not. Python has no braces, Go insists
on types, Java wraps everything in a class - but the loop is the loop.</p>`,
        check: ({ translated }) => {
          if (!translated) return 'Press Translate to see your program in the other languages.';
          return true;
        }
      },
      {
        task: 'Open the folded <b>runtime</b> under Rust or C, and have a look at what is underneath.',
        teach: `
<p>Nine of the languages need only a handful of small helpers. Two of them
need a great deal more, and it is worth knowing why.</p>
<p><b>Rust</b> wants to know the type of every value and who owns it. Plain
does not work that way - a name holds whatever you put in it - so every Plain
value becomes one Rust type, shared with <code>Rc</code>.</p>
<p><b>C</b> has none of the pieces at all: no type that holds anything, no
lists that grow, no text that joins, and no way to give memory back. So all
four are built, and what your program made is swept up at the end of every
turn of a loop.</p>
<p>That is the honest price of those two languages, and now you have seen
it rather than been told about it.</p>`,
        check: ({ translated }) => {
          if (!translated) return 'Press Translate first, then open the folded runtime under Rust or C.';
          return true;
        }
      },
      {
        task: 'Change your program so it does something the other languages have to work at - use a list, sort it, and join it with a separator - then translate it again.',
        teach: `
<p>Try this, run it, then translate it:</p>
<pre>make scores be a list of 5, 3, 9, 1
show join sorted scores with " < "</pre>
<p>Now compare. Lua has no sort like this. Go has to say what type it is
sorting. C has to be handed a comparing function. Plain says
<code>sorted</code>, and each language is left to keep its own promise.</p>`,
        start: `make scores be a list of 5, 3, 9, 1
show join sorted scores with " < "
`,
        check: ({ lines, source, translated }) => {
          if (!has(source, 'sorted')) return 'Sort a list: show join sorted scores with " < "';
          if (!said(lines, '<')) return 'Join it with a separator so the answer is one line.';
          if (!translated) return 'Press Translate again and compare how each language sorts.';
          return true;
        }
      },
      {
        task: 'Last step, in your terminal rather than here: run <code>plain translate yourfile.plain --to all --out translated</code> and open the folder.',
        teach: `
<p>The course can show you the code. Your terminal can hand you the files:</p>
<pre class="shell">plain translate mine.plain --to python
plain translate mine.plain --to rust --out mine.rs
plain translate mine.plain --to all --out translated</pre>
<p>What comes out is a real file you can build and run with nothing else
installed:</p>
<pre class="shell">python mine.py
node mine.js
rustc -O mine.rs && ./mine
cc -O2 mine.c -o mine -lm && ./mine</pre>
<p>So Plain is a fair place to start something. If the project outgrows it,
or somebody on your team only writes Go, the way out is one command - and
they get real Go, not a pile of Plain they have to learn first.</p>
<p>Tick this off once you have opened one of those files.</p>`,
        check: ({ translated }) => {
          if (!translated) return 'Have a translate open here too, so you can compare it with the file.';
          return true;
        }
      }
    ]
  },
  {
    id: 'guestbook',
    title: 'Project: a guest book',
    about: 'A page anybody can write on, that is still there tomorrow.',
    steps: [
      {
        task: 'Make a table for the messages, and an address that shows how many there are.',
        teach: `
<p>This is a whole small website: a page, a form, somewhere to keep what
people write, and their name against it. Four steps.</p>
<p>Start at the back. Before there is anything to show, there has to be
somewhere to keep it.</p>`,
        start: `make book be a table called "guestbook"
empty the table book

when someone visits "/"

end
`,
        check: ({ runtime }) => {
          const server = runtime.server;
          if (!runtime.tables || !server || !server.routes.length) {
            return 'Two things: a table called "guestbook", and "when someone visits /".';
          }
          server.answer = null;
          server.routes[0].run();
          if (!server.answer || !String(server.answer.body).includes('0')) {
            return 'Answer with how many messages there are: answer with "{number of rows in book} so far"';
          }
          return true;
        }
      },
      {
        task: 'Add the form to that page, and an address it sends to that saves the message.',
        teach: `
<p>The form goes on the page you already have. Its <code>action</code> is the
address you are about to write, and its <code>method</code> is
<code>post</code> - which is what makes it a <i>sending</i> rather than a
<i>looking</i>.</p>
<pre class="markup">&lt;form method='post' action='/write'&gt;
    &lt;input name='words'&gt;&lt;button&gt;Sign&lt;/button&gt;
&lt;/form&gt;</pre>
<p>Then catch it with <code>when someone sends to "/write"</code>, save what
they typed, and send them back to "/".</p>`,
        check: ({ runtime }) => {
          const server = runtime.server;
          const posting = server && server.routes.find(route => route.method === 'POST');
          if (!posting) return 'You need "when someone sends to ..." to catch the form.';
          const looking = server.routes.find(route => !route.method || route.method === 'GET');
          if (!looking) return 'Keep the page that shows the form as well.';
          server.answer = null;
          looking.run();
          if (!/<form/i.test(String(server.answer && server.answer.body))) {
            return 'The page should answer with a form in it.';
          }
          server.asked = { ...server.asked, tag: 'learner', sent: 'words=hello+there', kind: 'application/x-www-form-urlencoded' };
          server.answer = null;
          posting.run();
          const table = [...runtime.tables.tables.values()][0];
          if (!table || !table.read().rows.length) return 'Save what they typed: save { words: the form field "words" } in book';
          if (!server.answer || server.answer.code !== 303) return 'Send them back afterwards: send them to "/"';
          return true;
        }
      },
      {
        task: 'Show the messages on the page - and make what people typed safe to show.',
        teach: `
<p>Now put them on the page. Go through the table and glue a line together for
each one.</p>
<p>And here is the part that matters. Somebody will type
<code>&lt;b&gt;shouting&lt;/b&gt;</code>, or worse, and if you put it straight
on the page the browser will obey it. Swap the dangerous letters for harmless
ones first:</p>
<pre>to safely with words
    make out be text of words
    set out to replace "&amp;" with "&amp;amp;" in out
    set out to replace "&lt;" with "&amp;lt;" in out
    give back out
end</pre>
<p>Do the <code>&amp;</code> first, or you will go back over your own work.</p>`,
        check: ({ runtime }) => {
          const server = runtime.server;
          const looking = server && server.routes.find(route => !route.method || route.method === 'GET');
          const posting = server && server.routes.find(route => route.method === 'POST');
          if (!looking || !posting) return 'Keep both addresses from the last step.';

          server.asked = { ...server.asked, tag: 'learner', sent: 'words=%3Cb%3Eshouting%3C%2Fb%3E', kind: 'application/x-www-form-urlencoded' };
          server.answer = null;
          posting.run();

          server.answer = null;
          looking.run();
          const page = String(server.answer && server.answer.body);
          if (!/shouting/.test(page)) return 'The messages people wrote should appear on the page.';
          if (/<b>shouting<\/b>/.test(page)) {
            return 'Somebody typed markup and it went straight onto the page. Swap < and & for &lt; and &amp; first.';
          }
          return true;
        }
      },
      {
        task: 'Last: let people say who they are, and show each message with a name against it.',
        teach: `
<p>Add a second box to the form for a name, sign the visitor in with it, and
put the name next to each message when you save it.</p>
<pre>sign this visitor in as the form field "who"
save { words: the form field "words", by: who is signed in } in book</pre>
<p>Somebody who has not said their name yet gets <code>nothing</code> back
from <code>who is signed in</code>, so check for that and call them
"somebody".</p>
<p>That is a working website: it keeps what people write, it survives being
restarted, it knows one visitor from another, and it cannot be vandalised by
what somebody types.</p>`,
        check: ({ runtime }) => {
          const server = runtime.server;
          const posting = server && server.routes.find(route => route.method === 'POST');
          const looking = server && server.routes.find(route => !route.method || route.method === 'GET');
          if (!posting || !looking) return 'Keep both addresses.';

          server.asked = { ...server.asked, tag: 'learner', sent: 'words=hello&who=Ada', kind: 'application/x-www-form-urlencoded' };
          server.answer = null;
          posting.run();
          const who = server.visitors.get('learner') || {};
          if (who.signedIn === undefined) return 'Sign them in: sign this visitor in as the form field "who"';

          const table = [...runtime.tables.tables.values()][0];
          const row = table.read().rows[table.read().rows.length - 1];
          if (!row || row.by === undefined) return 'Save the name with the message: save { words: the form field "words", by: who is signed in } in book';

          server.answer = null;
          looking.run();
          if (!/Ada/.test(String(server.answer && server.answer.body))) {
            return 'Show the name next to the message on the page.';
          }
          return true;
        }
      }
    ]
  }
];

export function syllabus() {
  return [
    ...LESSONS.map(lesson => ({ kind: 'lesson', id: lesson.id, title: lesson.title, steps: 1 })),
    ...PROJECTS.map(project => ({ kind: 'project', id: project.id, title: project.title, steps: project.steps.length }))
  ];
}

export function totalSteps() {
  return LESSONS.length + PROJECTS.reduce((sum, project) => sum + project.steps.length, 0);
}
