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
  },

  {
    id: 'bytes',
    title: 'Talking to a program that does not speak English',
    teach: `<p>Everything so far has sent <i>writing</i> - a page, a message, some
JSON. Most of what computers actually send each other is not writing at all.
A picture is not writing. A sound is not writing. And a game sending where
forty aircraft are, sixteen times a second, does not send the word
"aircraft" forty times either - it sends numbers, in an order both ends have
agreed on beforehand.</p>
<p>That agreed order is called a <b>protocol</b>, and it is much less
mysterious than it sounds. It is a list like "first a number saying which
kind of message this is, then two bytes for who it is about, then four bytes
for where they are".</p>
<p>A <b>byte</b> is a number from 0 to 255. That is the whole idea. A run of
them, in Plain, is an ordinary list - so everything you already know works on
it.</p>
<pre>make packet be []
add the byte 5 to packet
add the number 1234 in 2 bytes to packet
add the text "hi" to packet</pre>
` + walk([
      ['make packet be []', 'An empty list. Nothing new to learn: a run of bytes is a list of numbers, and that is all it ever is.'],
      ['add the byte 5 to packet', 'Put the single number 5 on the end. Often the first byte says which kind of message this is - a number both ends have agreed means "hello", or "I pressed a key".'],
      ['add the number 1234 in 2 bytes to packet', '1234 does not fit in one byte, because a byte stops at 255. This puts it in two, which between them can hold up to 65535. <b>You have to say how many</b>, because the program at the other end will be reading exactly that many and no more.'],
      ['add the text "hi" to packet', 'The letters, as the numbers they are stored as. Two letters, two bytes - though a letter with an accent on it takes more, which is exactly the sort of thing that has to be got right rather than assumed.']
    ]) + `
<p>Reading is the same list, the other way round. Counting starts at 1, as it
does everywhere else in Plain:</p>
` + walk([
      ['the number in packet at 2 over 2 bytes', 'Start at the second byte, read two of them, give back the number they make: <b>1234</b>.'],
      ['the text in packet at 4 for 2', 'Start at the fourth byte, read two, give back the letters: <b>hi</b>.'],
      ['hex of packet', 'The whole thing written out as pairs like <code>05 d2 04 68 69</code>. Nobody reads bytes as decimal numbers - this is how you check that what you built is what you meant.']
    ]) + `
<p>Two things worth knowing before you use this for real.</p>
<p><b>Least important byte first.</b> 1234 comes out as <code>d2 04</code>,
not <code>04 d2</code>. It looks backwards and it is what almost every
protocol and almost every computer does, so Plain does it too.</p>
<p><b>Bytes and writing travel differently.</b> A program expecting a
shorthand will ignore anything you send as writing, even if the letters are
right. So there are separate sentences for it: a server says
<code>tell them the bytes packet</code> and reads <code>the bytes they
sent</code>; a page says <code>send the bytes packet to the server</code> and
reads <code>the bytes the server sent</code>.</p>
<p>This is the part of Plain that lets it talk to something that was never
built with Plain in mind - a game somebody else wrote, a piece of hardware, a
file format from 1991. You do not need permission from either end. You need
their list, and a way to count.</p>`,
    task: 'Build a little message: a byte saying 7, then the number 2024 in two bytes, then your name as text. Show the hex of it, then read the 2024 back out and show it.',
    start: 'make packet be []\nadd the byte 7 to packet\n',
    check: ({ lines, source, runtime }) => {
      if (!has(source, 'add the byte')) return 'Start with a byte: add the byte 7 to packet';
      if (!has(source, 'in 2 bytes')) return 'Put 2024 in two bytes: add the number 2024 in 2 bytes to packet';
      if (!has(source, 'add the text')) return 'Add your name: add the text "Ada" to packet';
      if (!has(source, 'hex of')) return 'Show what you built: show hex of packet';
      if (!lines.some(line => String(line).includes('e8 07'))) {
        return '2024 in two bytes is "e8 07" - least important byte first. Check the hex you showed.';
      }
      if (!lines.some(line => String(line).trim() === '2024')) {
        return 'Read it back out and show it: show the number in packet at 2 over 2 bytes';
      }
      return true;
    }
  },

  {
    id: 'rules',
    title: 'The rules, and what actually goes wrong',
    teach: `<p>Plain has few rules. Nearly every mistake people make comes from four of
them, and all four are the same mistake underneath: <b>Plain reads a line as
a sentence, and a sentence can be read more than one way</b>.</p>
<p>Every example below is a real mistake, taken from building a multiplayer
game in this language. Not one of them was a crash. That is the point - they
all did something, quietly, and the something was wrong.</p>

<h3>1. Every block ends with <code>end</code></h3>
<p>This is the whole of the layout. Indenting is decoration; <code>end</code>
is what decides where a block stops. Forget one and the error appears at the
<i>bottom</i> of your program, because that is where Plain finally ran out of
lines to close.</p>

<h3>2. Some names are already words</h3>
` + walk([
      ['make key be 3', 'Fine on its own. But <code>key "left" is held</code> now means something else, and you will get errors on lines you never touched.'],
      ['make keys be []', 'Worse, because it does not complain at all: <code>keys of thing</code> stops being your list and becomes the names inside a thing.'],
      ['make kind be 2', 'Same again - <code>kind of x</code> is how you ask what sort of value something is.']
    ]) + `
<p><code>plain check</code> now warns about this and tells you the sentence
you have collided with. If a name feels natural, that is often exactly why it
is taken.</p>

<h3>3. An argument at the end of a line swallows the rest</h3>
` + walk([
      ['if danger with plane is above 0', 'Reads as <b>danger with (plane is above 0)</b>. The action gets a yes or no where it wanted a plane, and the question you thought you asked never happens.'],
      ['make soon be danger with plane', 'Work it out onto a name of its own first...'],
      ['if soon is above 0', '...and then ask. Two lines, and no way to read it wrongly.']
    ]) + `
<p>This one cost more time than anything else in the game: a whole sky of
aircraft had no terrain, because <code>if clearof with hill and base and
(...) is no</code> quietly asked a different question and rejected every hill
that was offered.</p>

<h3>4. Some sums bind tighter than they look</h3>
` + walk([
      ['round 1234.5 times 512', 'Rounds first, then multiplies - so the fraction you were trying to keep is thrown away before the multiply happens.'],
      ['round (1234.5 times 512)', 'The brackets are not decoration. When a line mixes <code>round</code> or <code>square root of</code> with arithmetic, say which happens first.']
    ]) + `

<h3>And one about text</h3>
<p>A piece of text in double quotes cannot hold more double quotes inside its
curly braces:</p>
` + walk([
      ['draw "{value "x" of thing}" at 10 , 10', 'Plain sees the text ending at the second quote. It will tell you it does not know how to start a line with "draw".'],
      ['make across be value "x" of thing', 'Work it out first...'],
      ['draw "{across}" at 10 , 10', '...and put the name in the braces.']
    ]) + `
<h3>How to find these</h3>
<p>Three habits, in order of how much time they save:</p>
<p><b>Run <code>plain check</code> after every few lines.</b> It parses
without running, so it costs nothing, and it finds the missing
<code>end</code> while you still remember what you were doing.</p>
<p><b>Work things out onto names.</b> A line with three ideas in it can be
read three ways. A line with one idea can be read one way, and the name you
chose says what it is.</p>
<p><b>Check the value, not the code.</b> Every one of the mistakes above
looks right. What gives them away is <code>show</code>: print the thing you
believe you have, and it will not be that.</p>`,
    task: 'Two of these lines are traps. Rewrite them safely: work out <code>value "x" of ship</code> onto a name and show it inside a sentence, and work out a rounded multiplication with the brackets in the right place.',
    start: 'make ship be { x: 12.5 }\n',
    check: ({ lines, source }) => {
      if (!has(source, 'make ship')) return 'Keep the ship: make ship be { x: 12.5 }';
      if (!has(source, 'round (')) return 'Use brackets so the multiply happens first: round (12.5 times 512)';
      if (!lines.some(line => String(line).includes('6400'))) {
        return '12.5 times 512 rounded is 6400. If you got 6144, the round happened first.';
      }
      if (!lines.some(line => /[A-Za-z]/.test(String(line)) && String(line).includes('12.5'))) {
        return 'Show the x inside a sentence too, with the value worked out onto a name first.';
      }
      return true;
    }
  },

  {
    id: 'tour',
    title: 'Everything else Plain can do',
    teach: `<p>The sentences you have learned - names, questions, repeating, lists,
actions - are the whole language. Everything below is the <i>same</i>
language with more sentences available, not a new thing to learn.</p>
<p>Here is one line from each, so you know what exists and can go and find
it. The projects further down build several of these properly.</p>
` + walk([
      ['start a game called "Catch" sized 640 by 480', '<b>A flat game.</b> Things, keys, sixty frames a second, and a rule for what happens when two things touch. <i>Project: catch the falling star.</i>'],
      ['start a world called "Moon Walk" sized 900 by 600', '<b>A game in three dimensions.</b> The same sentences with one more number: across, up, and how far away. <i>Project: a world in three dimensions.</i>'],
      ['make a video called "My Film" sized 1280 by 720', '<b>A film.</b> Clips one after another with a length each, fades, words over the top, music. Plain works out what happens when. <i>Project: a title sequence.</i>'],
      ['make a site called "My Notes"', '<b>A website.</b> Pages, headings, pictures and links, written as sentences and saved as ordinary HTML and CSS you own.'],
      ['when someone visits "/"', '<b>A server.</b> The program stops running top to bottom and starts waiting for people to arrive. <i>Project: a guest book.</i>'],
      ['make notes be a table called "notes"', '<b>Somewhere to keep things.</b> Rows you can save, find, change and delete, that are still there tomorrow.'],
      ['send an email to "ada@example.com" saying "hello"', '<b>Email.</b> The same sentence whether it goes out through a real mail server or is written to a file while you are testing.'],
      ['ask for "https://..." and when it arrives ...', '<b>Asking without waiting.</b> The program carries straight on, and the block runs when the answer turns up. A game that stops to ask a question has dropped sixteen frames.'],
      ['draw the picture "grass.png" at 100 , 100 sized 64 by 64', '<b>Pictures.</b> Drawn rather than kept, so a floor of four hundred tiles is a loop and one file. <code>draw frame 3 of "walk.png"</code> takes one picture out of a sheet.'],
      ['show the first 5 of scores', '<b>Part of a list, and pages of one.</b> The top few, the next page, the rest after the first - each one sentence rather than a loop with a counter and an off-by-one waiting to happen.'],
      ['make best be reversed sorted people by "score"', '<b>Sorting by one of the values things carry.</b> A scoreboard, in a sentence.'],
      ['make hand be shuffled cards', '<b>Shuffling.</b> A new list in a random order; the one you gave it is left alone. Cards, quiz questions, whose turn it is, where things spawn - all the same sentence.'],
      ['make later be the day 20 days after today', '<b>Days.</b> Tomorrow, how long until something, which weekday a date falls on - written the way the world writes dates down.'],
      ['show everything in mine not in yours', '<b>Sets, without a second kind of list.</b> Unique, what is in one and not the other, what is in both, and both together.'],
      ['connect to "ws://localhost:3040"', '<b>Two programs talking.</b> A page and a server sending messages back and forth, which is what a multiplayer game is made of.'],
      ['this part needs "colours" version 1 from "./colours.plain"', '<b>Other people’s code.</b> Split a big program into parts, and use parts somebody else wrote - including packages from npm.'],
      ['add the number 1234 in 2 bytes to packet', '<b>Bytes.</b> Talking to a program that does not speak English - a game somebody else wrote, a piece of hardware, a file format from 1991. <i>Lesson: talking to a program that does not speak English.</i>'],
      ['scene "title" ... end', '<b>Scenes.</b> A title screen, the playing, and the bit at the end - each with its own things and its own rules, and none running while another is showing.'],
      ['check score is 10', '<b>Checking your own work.</b> A language that can build a game and cannot say whether it works is half a tool.'],
      ['make samples be room for 1024 numbers', '<b>Memory, without addresses.</b> A fixed run of numbers side by side, which is what makes a processor fast and what a decoder or a sound card wants handed to it.'],
      ['use the toolkit sums as maths', '<b>Code written in another language.</b> Thirty years of decoders, compression and physics are written in C. A toolkit lets Plain call one instead of rewriting it.'],
      ['show the rust of this program', '<b>Eleven other languages.</b> The same program written out as JavaScript, Python, Java, Go, Rust, C and more, to run where Plain is not installed. <i>Project: the same program in eleven languages.</i>']
    ]) + `
<p>Two things worth knowing about all of them:</p>
<p><b>They mix.</b> A server that keeps a table, sends an email and hands a
page to a game is one program, not four. The multiplayer game in the Skyward
project is a server and a browser game written in the same language.</p>
<p><b>You do not need permission.</b> Nothing above is a paid add-on or a
separate download. If you can write <code>show "hello"</code> you already
have all of it.</p>`,
    task: 'Pick one and try its first line. Start a game, or a world, or a video - whichever you would most like to make - and show something so you can see it ran.',
    start: 'start a game called "Mine" sized 640 by 480\n',
    check: ({ game, world, studio, site, source }) => {
      const started = game.started || world.started || studio.started || (site && site.pages.length);
      if (!started) return 'Begin one of them: start a game called "Mine" sized 640 by 480';
      if (!has(source, 'show') && !has(source, 'make ') && !has(source, 'add ')) {
        return 'Add one more line - something to put in it, so there is more than an empty window.';
      }
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
        teach: `<p>A page is a list of things, one after another down the screen. That
builds a document. What makes it a <i>website</i> is two more ideas, and both
are one sentence each.</p>
` + walk([
          ['start a row', 'What the block adds goes side by side instead of down the page - and becomes a column again on a telephone, which is the whole of what a layout system does.'],
          ['start a card', 'A box round a few things. The modern web is almost entirely made of these.'],
          ['add a button "The whole week" going to "/week"', 'How anybody moves around a site.'],
          ['describe this page as "..."', 'What a search engine and a shared link show. Leaving it out is why so many pages turn up as a bare address with no description at all.']
        ]) + `
<p>They nest, so a row of cards is a row with cards inside it:</p>
<pre>start a row
    start a card
        add a heading "Morning"
        add text "High water at 06:12."
    end
    start a card
        add a heading "Evening"
    end
end</pre>`,
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
        teach: `<p>A game is a drawing that changes very fast. Sixty times a second the
computer wipes the screen, works out where everything has got to, and draws
it all again. Each of those is called a <b>frame</b>. Nothing actually
moves - it is redrawn somewhere slightly different, sixty times a second,
and your eye does the rest. That is every video game ever made.</p>
<p>So the first job is to say what exists.</p>
` + walk([
          ['start a game called "Catch" sized 640 by 480', 'Open a window 640 across and 480 down and start the sixty-times-a-second drawing. Nothing shows yet, because nothing is in it. 640 and 480 are just numbers of dots - about a third of a laptop screen.'],
          ['set the background to "#141225"', 'What colour to wipe the screen with each time. The <code>#</code> word is a colour written as red, green and blue in that order - <code>#141225</code> is very dark blue. You never have to write one yourself: copy any of these and change a digit to see it change.'],
          ['make basket be a box at 320 , 440 sized 90 by 18 colored "#ffd166"', 'Put a yellow box on the screen, and give it the name <b>basket</b> so you can talk about it later. <code>320 , 440</code> is where its middle sits: 320 across and 440 down. <b>Down</b>, not up - screens count downwards from the top, so 440 is near the bottom of a 480-tall window. <code>90 by 18</code> is its width and height, which is why it looks like a shelf rather than a block.']
        ]) + `<p>Now do the same for the star, up at the top where it can fall from -
somewhere like <code>320 , 30</code>. Make it small, and any colour you
like.</p>`,
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
        teach: `<p>Nothing in the window moves yet, because nothing has been told to. In
Plain a thing has a <b>speed</b>: how far it shifts each frame, sideways and
downwards. You set it once, and it keeps going by itself - like sliding
something across a table rather than carrying it.</p>
` + walk([
          ['set the speed of star to 0 , 4', 'Every frame, add 0 to the across of the star, and add 4 to its down. So it does not drift sideways at all, and falls four dots a frame. Sixty frames a second means 240 dots a second - about half the window every second.'],
          ['set the speed of star to 0 , 1', 'The same line with a smaller number: a slow, drifting fall.'],
          ['set the speed of star to 2 , 4', 'Falling <i>and</i> drifting right, because now there is something in the first number too.']
        ]) + `<p>Try 4 first. If it is too fast to catch, that is not a mistake to fix -
it is the dial that decides whether your game is easy or hard, and you are
the one who sets it.</p>`,
        task: 'Make the star fall, by setting its speed downwards.',
        check: ({ game }) => {
          const falling = game.things.some(thing => thing.dy > 0);
          if (!falling) return 'Set the star moving: set the speed of star to 0 , 4';
          return true;
        }
      },
      {
        teach: `<p>The star falls on its own. The basket must not - it should do what a
person tells it. That means asking, sixty times a second, whether a key is
being held down.</p>
<pre>every frame
    if key "left" is held
        move basket left by 6
    end
end</pre>
` + walk([
          ['every frame', 'Everything until the matching <code>end</code> happens once per frame - sixty times a second, forever. This is where a game actually lives.'],
          ['if key "left" is held', 'Ask right now: is the left arrow down? Not "was it pressed" - <b>is it down this instant</b>. That is the difference between a key that nudges you once and a key you can lean on.'],
          ['move basket left by 6', 'Take 6 off the across of the basket. Six dots a frame, sixty times a second, is a brisk walk across the screen. Two would be a crawl, twenty a teleport.'],
          ['end', 'Closes the <code>if</code>. Plain uses <code>end</code> rather than brackets so you can see where things stop without counting punctuation.']
        ]) + `<p>Add the right arrow the same way. Then keep it on the screen: after
moving, ask whether the basket has gone too far and put it back.</p>
<pre>if x of basket is below 45
    move basket to 45 , 440
end</pre>
<p>Without those two lines a player can walk the basket clean out of the
window and spend the rest of the game catching nothing. Every game has a
handful of lines like this. They are not interesting, and leaving them out
is what makes a game feel broken.</p>`,
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
        teach: `<p>One more thing before the rule, and it is the thing that separates a
game the size of its window from a game with a world in it.</p>
<p>Everything so far has been drawn where it sits on the screen: 320 across
means 320 dots from the left, always. That is fine while the whole game
fits. The moment the world is bigger than the window, you need to say
<i>which part of it you are looking at</i> - and then every single thing you
draw has to be shifted by however far the view has moved, and shrunk by
however far out it is zoomed.</p>
<p>Written by hand that is the same sum copied beside every drawing in the
game, and if you get it wrong in one place, one kind of thing stands still
while the world slides past it. So Plain does it for you.</p>
` + walk([
          ['point the view at x of basket , y of basket', 'Look at the basket, wherever it has got to. The view is now centred on it.'],
          ['zoom the view to 0.5', 'Half size, so you see twice as much sky. Bigger than 1 is closer in.'],
          ['seen through the view', 'Everything until the matching <code>end</code> is drawn <b>where it is in the world</b>, not where it lands on the screen.'],
          ['end', 'And after this, drawing goes back to being on the screen - which is exactly where a score belongs, because a score should not slide away when you walk left.']
        ]) + `<p>This game is small enough not to need it. Try it anyway: point the view
at the basket and watch the whole world slide instead of the basket. That is
how every scrolling game you have ever played works.</p>
<p><code>view left</code>, <code>view right</code>, <code>view top</code> and
<code>view bottom</code> tell you which part of the world is on screen, which
is how a big game avoids drawing the parts of itself nobody can see.</p>
<hr>
<p>Four more the engine has, which turn a game that works into a game that
feels made:</p>
` + walk([
      ['make a burst of 30 at 200 , 150 colored "#ff7a59"', 'An explosion, a splash, a puff of dust and a shower of sparks are all the same thing: bits thrown out from a point that move themselves and fade. Say it once.'],
      ['slide door to 350 , 150 over 1 seconds', 'Moves it there over a second, eased at both ends, because nothing in the world starts and stops at full speed. Said once, then it happens on its own.'],
      ['shake the view by 10 for 0.4 seconds', 'The whole picture knocked sideways and settling. The cheapest way to make something feel heavy.'],
      ['draw an arc at 320 , 240 sized 90 from 120 to 240 thick 5 colored "#7ee787"', 'Part of a circle. A health bar curved round the thing it belongs to is read without looking away from it, which is why every game that has one draws it there.']
    ]) + `
<p>And when a game has more of something than it can name one by one:</p>
` + walk([
      ['put bullet in the group "shots"', 'This one belongs to that lot.'],
      ['when anything in "shots" touches anything in "rocks" ...', 'One rule about two lots of things, rather than a rule for every possible pair. Forty bullets and thirty rocks is twelve hundred pairs and one sentence.'],
      ['the one that touched', 'Inside that block, which two actually met - "the one that touched" and "the other one".']
    ]) + `
<hr>
<p>Now the rule.</p>
<p>Two things are moving about and nothing happens when they meet. A game
is the rule about what happens when they meet.</p>
<pre>make score be 0

when star touches basket
    add 1 to score
    move star to random 30 to 610 , 20
end</pre>
` + walk([
          ['make score be 0', 'A box with the name <b>score</b> and 0 in it. It has to exist before the game starts, or the first catch would be adding 1 to nothing.'],
          ['when star touches basket', 'Plain watches those two, every frame, and runs this the moment they overlap. You never have to check distances yourself.'],
          ['add 1 to score', 'One more than whatever was in the box. Not "score is 1" - <b>one more than before</b>, which is why it keeps climbing.'],
          ['move star to random 30 to 610 , 20', 'Put the star back at the top, at a randomly chosen place across. <code>random 30 to 610</code> picks a fresh number each time, which is the whole reason the game does not become the same catch over and over.']
        ]) + `<p>And a noise, because a catch with no sound barely happened:</p>
<pre>play a rising note</pre>
<p>There is a small kit of these - <code>play a bang</code>, <code>play a
thud</code>, <code>play a whoosh</code>, <code>play a blip at 660</code> -
and none of them need a sound file. They are noise shaped by hand, which is
what an explosion actually is.</p>
<p>Last, the score has to be visible, or the player is being marked in
secret. Inside <code>every frame</code>:</p>
<pre>draw "score {score}" at 18 , 16 sized 16 colored "#ffffff"</pre>
<p>The <code>{score}</code> in the middle of the words means "drop the
number that is in that box in here" - so it reads <b>score 3</b>, and it
changes the instant the box does. Drawing goes inside <code>every
frame</code> because the screen is wiped sixty times a second; something
drawn once is gone in a sixtieth of a second.</p>`,
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
        teach: `<p>Three dimensions sounds like a different subject. It is the same
subject with one more number.</p>
<p>In the 2D game a thing had an across and a down. Here it has an across, an
<b>up</b>, and a <b>how far away</b> - written <code>x , y , z</code>. That
is the entire difference. The sentences are the ones you already know.</p>
` + walk([
          ['start a world called "Moon Walk" sized 900 by 600', 'Open a window, same as a game, but what gets drawn in it has depth. The 900 by 600 is still just the size of the window on your screen - it says nothing about how big the world is.'],
          ['set the sky to "#0b1020"', 'What colour is behind everything. The 3D version of the background.'],
          ['set world gravity to 0.02', 'How hard things are pulled down. Small numbers feel like the moon and big ones feel like lead - 0.02 is a gentle drift downwards. Nothing falls until something is above the floor to fall.'],
          ['make ground be a floor at 0 , 0 , 0 sized 60 by 60 colored "#2c3a4f"', 'A flat sheet 60 by 60 sitting at the middle of everything. <code>0 , 0 , 0</code> is the centre of the world - not a corner. Numbers go both ways from it, so -20 is as real a place as 20.'],
          ['make hero be a cube at 0 , 1 , 0 sized 1.6 colored "#ffd166"', 'A yellow block standing on the floor. The <b>1</b> in the middle is how far up it is: put 0 there and it would be sunk halfway into the ground.']
        ]) + `<p>The sizes here are small - 1.6, not 160 - because a world is measured in
whatever unit you like, and it is easiest if that unit is roughly a metre.</p>`,
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
        teach: `<p>You cannot see your hero properly because the camera has no idea it
exists. In three dimensions there is always a camera - somebody has to be
standing somewhere, looking in some direction, or there is no picture at
all.</p>
` + walk([
          ['follow hero with the camera', 'Stay behind the hero and keep it in view, wherever it goes. One line, and you never think about the camera again.'],
          ['move the camera to 0 , 12 , 20', 'Or place it by hand: twelve up and twenty back. Useful for a fixed view of a board or a scene.'],
          ['point the camera at hero', 'Look at that, from wherever the camera happens to be.']
        ]) + `<p>Following is what nearly every game does, because the alternative is
walking your hero out of shot and having no idea where it went.</p>
<hr>
<p>Two more views, and the difference between them is the difference between
most games:</p>
` + walk([
      ['look over the shoulder of hero', 'Behind them and slightly above - what you have now.'],
      ['look out of hero', 'Out of their own eyes, at eye height, looking the way they face. It is the same following seen from a different place, which is all a first person camera has ever been.']
    ]) + `
<p>And the light, which is what makes a world look like somewhere rather
than like a diagram:</p>
` + walk([
      ['set the shadows to 0.8', 'How dark the unlit side of things is. 0 is flat and lifeless; 1 is black shadows.'],
      ['put a lamp at 0 , 4 , 0 reaching 14 colored "#ffb347"', 'A light with a <b>place</b> rather than a direction. It falls off as you walk away and lights the side of a thing that faces it, which a sun cannot do.'],
      ['show the colour at 4 , 9 of the picture "grass.png"', '<b>Asking a picture a question.</b> "#rrggbb", or "" for outside, see-through, or not loaded yet - so black and nothing stay different answers. There is also <b>save dots as the picture "out.png" sized 16 by 16</b>, which writes a real PNG from a list of colours.'],
      ['make statue be a model "stone.obj" at 0 , 1 , 0 sized 3 colored "#c9c2b2"', '<b>A shape nobody typed.</b> A wavefront .obj file - the plainest model format there is - triangulated, centred and scaled into a one-unit box so <b>sized 3</b> means the same as for a cube. Until the file arrives the thing is not drawn at all.'],
      ['let the sun cast shadows', '<b>Shadows.</b> Everything the sun cannot see falls into shadow - the ground behind a wall, the stripe under a bridge. The world is drawn twice: once from where the sun stands keeping only distances, then from the eye, asking each spot: is anything nearer the sun than you? Off unless you ask, because it costs a second drawing.'],
      ['cover ground with the picture "grass.png" repeated 24 times', '<b>A picture on a thing.</b> A world of flat colours reads as a diagram; this is what makes it grass. <b>repeated</b> tiles it - 24 across a 60 metre floor is a tile every two and a half metres. Tiling wants a picture 64 by 64 or 128 by 128; other sizes work but cannot repeat.'],
      ['cover crate with the picture "wood.png"', 'Without <b>repeated</b>, the picture is stretched once over the whole thing. The picture is <b>multiplied by the colour</b>, so the same wood picture on a green crate gives green wood - one file, any colour you like. And until the picture has loaded the thing is just its colour, so nothing flickers.'],
      ['set the haze to 0.4', 'How much of the distance fades into the sky. The cheapest way to make a world feel large, because it stops the far edge looking like an edge.']
    ]) + `
<p>Last, the question a 3D program cannot answer without help — and which
every editor, strategy game and point-and-click needs:</p>
` + walk([
      ['what is under the mouse', 'Whichever body a line out of the camera through the mouse meets first, or nothing.'],
      ['what the camera is looking at', 'The same question aimed at the middle of the screen.']
    ]) + ``,
        task: 'Point the camera at your hero by following it.',
        check: ({ world }) => {
          if (!world.camera.follow) return 'Add: follow hero with the camera';
          return true;
        }
      },
      {
        teach: `<p>Now the part that is genuinely different from the 2D game. There, left
meant left - a fixed direction on a flat screen. Here, left means
<b>turn</b>, and forward means <b>whichever way the hero is now facing</b>.
Those are two separate ideas and keeping them apart is what makes moving
about in three dimensions feel right.</p>
<pre>every frame
    if key "left" is held
        turn hero left by 3
    end
    if key "up" is held
        move hero forward by 0.2
    end
end</pre>
` + walk([
          ['turn hero left by 3', 'Swing the hero three degrees anticlockwise on the spot. It does not move an inch - it is now pointing somewhere else.'],
          ['move hero forward by 0.2', 'Move a fifth of a unit in whatever direction the hero is pointing <i>at this moment</i>. Turn first and this same line takes you somewhere completely different, which is exactly how walking works.'],
          ['move hero up by 0.2', 'Straight up, regardless of facing. Some directions should ignore which way you are turned, and up is one of them.']
        ]) + `<p>If you turned <i>and</i> moved in one line, you could never stand still
and look around. Two ideas, two lines, and the player decides how to combine
them.</p>`,
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
        teach: `<p>Same rule as the falling star, one dimension richer.</p>
` + walk([
          ['make prize be a ball at -6 , 1 , -8 sized 1.4 colored "#ef476f"', 'A red ball, six to the left and eight away. Minus is not an error - the middle of the world is 0, so half of everywhere is negative.'],
          ['when hero touches prize', 'Plain watches those two and runs this the moment they meet. It is the same sentence as in the flat game; it is now measuring in three directions instead of two.'],
          ['move prize to random -20 to 20 , 1 , random -20 to 20', 'Put it somewhere else on the floor: a random across, always 1 up so it does not sink, and a random how-far-away. Two randoms rather than one, because there are now two directions to be scattered across.']
        ]) + `<p>Keep the <b>1</b> fixed. Randomising the up as well is the usual first
mistake, and it leaves prizes buried in the floor and floating out of reach.</p>`,
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
        teach: `<p>Video editing sounds like a different kind of program altogether. It is
a list.</p>
<p>A film is clips, one after another, each with a length in seconds. Plain
keeps that list, works out that the third clip starts at 5.5 seconds because
the first two came to 5.5, and draws the right one at the right moment. You
never work out a time yourself.</p>
` + walk([
          ['make a video called "My Film" sized 1280 by 720', 'Start an empty film, 1280 across by 720 down - the ordinary size for something people watch. Nothing is in it yet.'],
          ['add a title "My Film" for 3 seconds', 'Put words on a plain background for three seconds and add it to the end of the list. Not "at 0 seconds" - <b>at the end</b>, wherever the end has got to. That is what makes a list of clips easier than a timeline: you add things in the order they happen.'],
          ['add a background "#1b2a41" for 2 seconds', 'Two seconds of flat colour, again at the end. Now the film is five seconds long, and you did not have to say so.']
        ]) + `<p>Everything else in this engine is a change to a clip that already
exists - a fade, some words over the top - and it always means <i>the last
one you added</i> unless you say otherwise.</p>`,
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
        teach: `<p>A cut straight from black to a title looks like a mistake. A fade takes
a second and looks deliberate, and it is one line.</p>
` + walk([
          ['fade the last clip in over 1 seconds', 'Start the clip black and bring it up to full over its first second. <b>The last clip</b> means the one you most recently added, so this reads in the order you were already writing.'],
          ['fade the last clip out over 1 seconds', 'The same at the other end. Used on the final clip so the film finishes instead of stopping.'],
          ['put the words "somewhere in 1946" on the last clip', 'Words over the top of whatever that clip is, rather than a card of their own. This is how a caption over a picture is different from a title between pictures.']
        ]) + `<p>Fades are what makes a sequence of cards feel like a film. Try building
the whole thing without them, watch it, then add them: it is the clearest
before-and-after in this course.</p>
<hr>
<p>Four more, and these are what people actually buy an editor to get:</p>
` + walk([
      ['cross into the last clip over 1 seconds', 'A crossfade, which is not two fades that happen to meet - the clip before is still there while this one arrives. The film gets <b>shorter</b> by exactly the overlap, and Plain works that out rather than being told.'],
      ['play the last clip at 0.5 speed', 'Slow motion. Half speed means it lasts twice as long, and the timeline knows.'],
      ['split the last clip at 3 seconds', 'Two clips where there was one. The single most used action in any editor.'],
      ['drift the last clip from 1 to 1.25', 'The slow push into a still picture that stops it looking like a slide. <code>drift the last clip left</code> moves across instead.']
    ]) + `
<p>Also <code>make the last clip 0.2 brighter</code>, <code>drain the colour
from the last clip</code> and <code>tint the last clip "#4a6ea8"</code> —
which between them are most of what "graded" means.</p>`,
        task: 'Fade the title in, and add two coloured cards after it with words over them.',
        check: ({ studio }) => {
          if (!studio.clips[0].fadeIn) return 'Add: fade the last clip in over 1 seconds';
          if (studio.clips.length < 3) return 'Add two more cards: add a background "#1b2a41" for 2 seconds';
          if (!studio.clips.some(clip => clip.overlay)) return 'Put words on one: put the words "..." on the last clip';
          return true;
        }
      },
      {
        teach: `<p>One last thing, which is the point of the whole engine: a film that
exists only on your screen is not a film yet.</p>
` + walk([
          ['show video length', 'How many seconds the whole thing has come to. Plain has been adding it up as you went.'],
          ['show clip count', 'How many clips are in it. Both of these are worth showing while you build, so you can see the film growing.']
        ]) + `<pre class="shell">plain edit titles.plain</pre>
<p>opens the studio in a browser, where the film you have just written plays,
and where there is a button to save it out as a real video file. The
program is the film; the studio is a window onto it.</p>
<p>Ten seconds is not an arbitrary target. Under about eight, a title
sequence does not have time to establish anything, and you will feel that
when you watch it back rather than being told it.</p>`,
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
    id: 'protocol',
    title: 'Project: agreeing on a shorthand',
    about: 'Two programs, one agreement, no words at all.',
    steps: [
      {
        teach: `<p>You have sent writing between two programs already. Now the other way
- the way most real programs do it, and the way you talk to something that
was never built with you in mind.</p>
<p>A <b>protocol</b> is an agreement about what goes where. That is all it
is. Here is one, and it is complete:</p>
<div class="lines"><div><code>byte 1</code><span>what kind of message this is</span></div>
<div><code>bytes 2-3</code><span>who it is about</span></div>
<div><code>bytes 4-5</code><span>how far across they are</span></div>
<div><code>bytes 6-7</code><span>how far down</span></div></div>
<p>Seven bytes. Nobody sends the words "how far across" - both ends already
know that bytes 4 and 5 are how far across, so the words would be a waste of
a wire. That is the whole trade: a protocol is smaller and faster than
writing, and it is completely unreadable to anybody who has not got the
list.</p>
<p>Building one message:</p>
` + walk([
          ['make packet be []', 'A run of bytes is an ordinary list.'],
          ['add the byte 1 to packet', 'Kind 1, meaning "somebody moved". A number both ends have agreed on. It could have been 7 or 200; what matters is that the other end agrees.'],
          ['add the number 4096 in 2 bytes to packet', 'Who. Two bytes hold up to 65535, so this game can have that many players and no more. That is a decision, and you have just made it.'],
          ['add the number 1200 in 2 bytes to packet', 'How far across.'],
          ['add the number 800 in 2 bytes to packet', 'How far down. Seven bytes in total, whoever it is and wherever they are.']
        ]) + `
<p>Make that, and show <code>hex of packet</code> so you can see it.</p>`,
        task: 'Build one message in that shape - kind 1, then a number for who, then across, then down - and show its hex.',
        start: `make packet be []
add the byte 1 to packet
`,
        check: ({ lines, source }) => {
          if (!has(source, 'add the byte')) return 'Start with the kind: add the byte 1 to packet';
          if ((source.match(/in 2 bytes/g) || []).length < 3) return 'Three two-byte numbers: who, across and down.';
          if (!has(source, 'hex of')) return 'Show it: show hex of packet';
          if (!lines.length) return 'Nothing was shown - is the "show" line there?';
          const written = String(lines[lines.length - 1]).trim().split(/\s+/);
          if (written.length !== 7) return `That came out ${written.length} bytes long. The shape above is exactly 7.`;
          return true;
        }
      },
      {
        teach: `<p>Now read it back, which is the half that catches mistakes. Writing a
protocol wrong is not like writing ordinary code wrong: it does not
complain, and it does not stop. It hands you a number that is nearly right,
or a name made of rubbish, and everything after it in that message is
rubbish too, because you are now counting from the wrong place.</p>
` + walk([
          ['the number in packet at 2 over 2 bytes', 'Who: start at byte 2, take two. <b>Counting starts at 1</b>, and being one out here is the single most common way to get this wrong.'],
          ['the number in packet at 4 over 2 bytes', 'Across: bytes 4 and 5.'],
          ['the number in packet at 6 over 2 bytes', 'Down: bytes 6 and 7.']
        ]) + `
<p>Read all three out of the packet you built, and show them. If they are
not the three numbers you put in, count again - the packet is fine, the
counting is what is wrong.</p>`,
        task: 'Read who, across and down back out of your packet and show all three.',
        check: ({ lines, source }) => {
          if (!has(source, 'the number in packet at')) return 'Read one back: show the number in packet at 2 over 2 bytes';
          if ((source.match(/the number in packet at/g) || []).length < 3) return 'All three: who, across and down.';
          const shown = lines.map(line => String(line).trim());
          if (!shown.includes('4096') || !shown.includes('1200') || !shown.includes('800')) {
            return 'The three numbers back out should be the three you put in. If one is wrong, check where you started counting.';
          }
          return true;
        }
      },
      {
        teach: `<p>One last thing, and it is the reason protocols look so strange from
outside.</p>
<p>Positions are hardly ever sent as they are. A game sends where forty
aircraft are, sixteen times a second, forever - so every byte is worth
arguing about. If a position can be half a pixel out without anybody
noticing, then it does not need a big number, it needs a small one with the
fraction multiplied away:</p>
` + walk([
          ['make squeezed be round (x times 512)', 'Multiply by 512 and round. The brackets matter: without them Plain rounds x first and then multiplies, which throws away the very fraction you were trying to keep. Now half a pixel is a whole number, and no fraction has to be sent at all.'],
          ['make back be squeezed divided by 512', 'And the other end divides by 512 to get it back. Both ends know the 512. It is part of the agreement, like everything else.']
        ]) + `
<p>That is genuinely all that is happening in the packed positions of a real
game. The number looks meaningless on its own — 4718592 — and is a position
divided by nothing more mysterious than a number both ends agreed on.</p>
<p>Try it: squeeze a position with a fraction in it, put it in three bytes,
read it back, and show it. Three bytes hold up to 16 million, which at 512
to the pixel is a sky about 32000 across. Every one of those numbers is
somebody's decision.</p>`,
        task: 'Squeeze a position like 1234.5 by 512, put it in 3 bytes, read it out and unsqueeze it. Show the result - it should be 1234.5 again.',
        check: ({ lines, source }) => {
          if (!has(source, 'in 3 bytes')) return 'Three bytes this time: add the number squeezed in 3 bytes to packet';
          if (!has(source, '512')) return 'Multiply by 512 before packing, and divide by 512 after.';
          if (!lines.some(line => String(line).trim() === '1234.5')) {
            return 'It should come back as 1234.5 exactly. If it came back whole, the multiply is missing; if it came back huge, the divide is.';
          }
          return true;
        }
      }
    ]
  },

  {
    id: 'spanish',
    title: 'Project: a program in Spanish',
    about: 'The same language, written in Spanish - "en español" on the first line is all it takes.',
    steps: [
      {
        task: 'Run this Spanish program, then change something and run it again.',
        teach: `
<p>Plain reads Spanish and French as well as English. Say so on the first
line - <b>en español</b> - and every sentence after it may be written in
that language: <b>haz</b> is make, <b>muestra</b> is show, <b>si ... fin</b>
is if ... end, <b>por cada</b> is for each.</p>
<p>Two things worth knowing. Any English word still works mid-sentence, so a
word you do not know the Spanish for is never a wall. And the language's own
little words - <b>y</b>, <b>a</b>, <b>en</b>, <b>de</b> - belong to the
language, exactly as "and", "to", "at" and "of" do in English.</p>`,
        start: `en español
haz cartas ser [3, 1, 2]
muestra ordenado cartas
haz total ser 0
por cada carta dentro de cartas
    cambia total a total más carta
fin
si total es mayor que 5
    muestra "total {total}: grande"
sino
    muestra "total {total}: pequeño"
fin
`,
        check: ({ lines }) => {
          if (!lines.length) return 'Show something - muestra is show.';
          return true;
        }
      },
      {
        task: 'Write three lines of French: en français, then fais nombres être [1, 2, 3], then affiche nombres.',
        teach: `
<p>French works the same way, apostrophes and all: <b>l'élément 1 de
cartes</b> is "the item 1 of cartes". A Spanish program can use an English
library and the other way round, because the language belongs to the file,
not the machine.</p>
<p>And everything downstream is unchanged: plain check checks Spanish,
plain translate turns French into Python. A language here is a dictionary,
not a dialect - adding one is adding words.</p>`,
        start: `en français
fais nombres être [1, 2, 3]
affiche nombres
`,
        check: ({ lines, source }) => {
          if (!has(source, 'fran')) return 'Start with: en français';
          if (!lines.length) return 'affiche is show - show your list.';
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
