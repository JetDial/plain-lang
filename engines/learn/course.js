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

export const LESSONS = [
  {
    id: 'showing',
    title: 'Showing things',
    teach: `
<p>A Plain program is a list of sentences, one to a line. The first one to
learn is <code>show</code>, which writes something out.</p>
<pre>show "Hello!"
show 6 times 7</pre>
<p>Text goes in "double quotes". Numbers do not.</p>`,
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
    teach: `
<p><code>make</code> gives a value a name. <code>set</code> changes one that
already exists.</p>
<pre>make score be 0
set score to 10
show score</pre>
<p>There are shortcuts for the two things people do most:</p>
<pre>add 5 to score
take 2 from score</pre>`,
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
    teach: `
<p>Curly braces drop a value into the middle of some text.</p>
<pre>make name be "Ada"
show "Hello, {name}!"</pre>
<p>Anything can go in the braces, even a sum:</p>
<pre>show "Two dozen is {2 times 12}"</pre>`,
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
    teach: `
<p><code>if</code> runs some lines only when something is true. Blocks always
finish with <code>end</code>.</p>
<pre>if score is above 10
    show "well done"
otherwise
    show "keep going"
end</pre>
<p>Questions read the way you say them: <code>is</code>, <code>is not</code>,
<code>is above</code>, <code>is below</code>, <code>is at least</code>,
<code>is at most</code>.</p>`,
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
    teach: `
<p>Three ways to repeat, all of them saying what they do:</p>
<pre>repeat 3 times
    show "again"
end

repeat with n from 1 to 5
    show n
end

while lives is above 0
    take 1 from lives
end</pre>
<p><code>stop</code> leaves a loop early. <code>next</code> skips to the next
turn.</p>`,
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
    teach: `
<p>A list holds several values in order. Lists count from 1.</p>
<pre>make shopping be a list of "bread", "milk"
add "apples" to shopping
show item 1 of shopping
show length of shopping</pre>
<p>To go through the whole list:</p>
<pre>for each item in shopping
    show item
end</pre>`,
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
    teach: `
<p>When several values belong together, keep them in one thing.</p>
<pre>make player be { name: "Ada", health: 100 }
show name of player
set the health of player to 80</pre>
<p><code>something of something</code> is how you read a value out.</p>`,
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
    teach: `
<p>An action is a sentence you teach Plain. It reads the same when you write
it and when you use it.</p>
<pre>to greet with person
    give back "Hello, " joined with person
end

show greet with "world"</pre>
<p><code>give back</code> hands a value to whoever asked. An action can also
just do something, with no <code>give back</code> at all.</p>`,
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
    teach: `
<p>A kind is a sort of thing: the values it always has, and what it can do.</p>
<pre>a kind called Dog
    has name
    has sound be "woof"

    to speak
        show "{name of me} says {sound of me}"
    end
end

make rex be a new Dog with name "Rex"
tell rex to speak</pre>
<p>Inside an action, <code>me</code> is the thing itself. Another kind can be
<code>based on</code> this one and keep everything it has.</p>`,
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
    id: 'problems',
    title: 'When things go wrong',
    teach: `
<p>Some things fail: dividing by zero, a value that is not there. Instead of
stopping the whole program, catch it.</p>
<pre>try
    show 1 divided by 0
if it fails
    show "I could not do that: {the problem}"
end</pre>
<p>You can raise your own, too:</p>
<pre>report a problem saying "there is nobody to share with"</pre>`,
    task: 'Write an action that shares sweets between people, and reports a problem when there are no people. Call it twice: once that works, once that fails, and catch the failure.',
    start: 'to share with sweets and people\n\nend\n',
    check: ({ lines, source }) => {
      if (!has(source, 'report a problem')) return 'Raise the problem with: report a problem saying "..."';
      if (!has(source, 'if it fails')) return 'Catch it with try ... if it fails ... end';
      if (lines.length < 2) return 'Show both the answer that works and the message you caught.';
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
    title: 'Project: read your program in another language',
    about: 'The same program, written out in JavaScript and Python.',
    steps: [
      {
        task: 'Write a small program with a name, a loop and an action, and get it working here.',
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
          if (!has(source, 'to ')) return 'Include an action of your own.';
          if (!lines.length) return 'Show something at the end so you can compare the answers.';
          return true;
        }
      },
      {
        task: 'Press <b>Translate</b> below the editor and read the JavaScript and Python. Find the loop you wrote in both of them.',
        check: ({ translated }) => {
          if (!translated) return 'Press Translate to see your program in the other languages.';
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
