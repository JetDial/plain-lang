// Plain - checking the course.
//
// Every lesson and every project step gets a worked answer here. The test
// runs that answer for real and asks the course's own check whether it
// passes - so a broken lesson fails the build, not the learner.

import assert from 'node:assert/strict';

import { createRuntime } from '../src/runtime.js';
import { installGame } from '../engines/game/engine.js';
import { installWorld } from '../engines/world/engine.js';
import { installWeb } from '../engines/web/engine.js';
import { installVideo } from '../engines/video/engine.js';
import { installStore } from '../engines/store/engine.js';
import { installData } from '../engines/data/engine.js';
import { installParts } from '../engines/parts/engine.js';
import { installNet } from '../engines/net/engine.js';
import { LESSONS, PROJECTS, totalSteps } from '../engines/learn/course.js';

export function runCourseChecks(check) {
  // What the checker sees when a program has been run.
  const attempt = (source, extra = {}) => {
    const lines = [];
    const runtime = createRuntime({ onOutput: text => lines.push(text) });
    const game = installGame(runtime, {});
    const world = installWorld(runtime, {});
    const site = installWeb(runtime, {});
    const studio = installVideo(runtime, {});
    installStore(runtime, {});
    const tables = installData(runtime, {});
    installParts(runtime);
    const server = installNet(runtime, {});
    runtime.run(source, 'answer.plain');
    return { lines, source, runtime, game, world, site, studio, server, tables, ...extra };
  };

  const passes = (item, source, extra) => item.check(attempt(source, extra));

  // ------------------------------------------------------------- lessons

  const ANSWERS = {
    showing: 'show "Good morning!"\nshow 12 times 12\n',

    names: 'make score be 0\nadd 10 to score\nadd 10 to score\nshow score\n',

    text: 'make name be "Ada"\nmake age be 36\nshow "{name} is {age} years old"\n',

    questions: [
      'make age be 15',
      'if age is at least 18',
      '    show "grown up"',
      'otherwise if age is at least 13',
      '    show "teenager"',
      'otherwise',
      '    show "child"',
      'end'
    ].join('\n'),

    repeating: 'repeat with n from 1 to 10\n    show "7 times {n} is {n times 7}"\nend\n',

    lists: [
      'make shopping be a list of "bread", "milk", "apples"',
      'add "cheese" to shopping',
      'for each item in shopping',
      '    show item',
      'end'
    ].join('\n'),

    things: [
      'make player be { name: "Ada", health: 100 }',
      'set the health of player to health of player minus 30',
      'show "{name of player} has {health of player} health"'
    ].join('\n'),

    actions: [
      'to double with n',
      '    give back n times 2',
      'end',
      'show double with 4',
      'show double with 21'
    ].join('\n'),

    kinds: [
      'a kind called Dog',
      '    has name',
      '    has sound be "woof"',
      '    to speak',
      '        show "{name of me} says {sound of me}"',
      '    end',
      'end',
      'make rex be a new Dog with name "Rex"',
      'make pip be a new Dog with name "Pip" and sound "yip"',
      'tell rex to speak',
      'tell pip to speak'
    ].join('\n'),

    keeping: [
      'make best be remembered "best score" or 0',
      'make score be 25',
      'remember score as "best score" if it is bigger',
      'show "this run: {score}"',
      'show "best ever: {remembered \\"best score\\" or 0}"'
    ].join('\n'),

    shapes: [
      "make place be thing from json '{\"town\": \"Bath\", \"founded\": 60}'",
      'show value "town" of place',
      'show json of place'
    ].join('\n'),

    ownmarkup: [
      'make a website called "Mine"',
      'set the page background to "#0f1020"',
      'add a title "Handmade" named crown',
      "style crown with 'color: #ffd166'"
    ].join('\n'),

    serving: [
      'when someone visits "/"',
      '    answer with "<h1>Hello from me</h1>"',
      'end',
      'when someone visits "/about"',
      '    answer with "<p>I am learning Plain.</p>"',
      'end'
    ].join('\n'),

    tables: [
      'make notes be a table called "practice"',
      'empty the table notes',
      'save { title: "Buy bread" } in notes',
      'save { title: "Ring Bob" } in notes',
      'show number of rows in notes',
      'show title of row 1 of notes'
    ].join('\n'),

    bytes: [
      'make packet be []',
      'add the byte 7 to packet',
      'add the number 2024 in 2 bytes to packet',
      'add the text "Ada" to packet',
      'show hex of packet',
      'show the number in packet at 2 over 2 bytes'
    ].join('\n'),

    tour: [
      'start a game called "Mine" sized 640 by 480',
      'make ball be a circle at 320 , 240 sized 20 colored "#ffd166"'
    ].join('\n'),

    forms: [
      'when someone sends to "/hello"',
      '    sign this visitor in as the form field "name"',
      '    send them to "/"',
      'end'
    ].join('\n'),

    problems: [
      'to share with sweets and people',
      '    if people is 0',
      '        report a problem saying "there is nobody to share with"',
      '    end',
      '    give back sweets divided by people',
      'end',
      'try',
      '    show share with 12 and 4',
      '    show share with 12 and 0',
      'if it fails',
      '    show "I could not: {the problem}"',
      'end'
    ].join('\n')
  };

  for (const lesson of LESSONS) {
    check(`course: lesson "${lesson.title}" can be passed`, () => {
      const answer = ANSWERS[lesson.id];
      assert.ok(answer, `no worked answer written for the "${lesson.id}" lesson`);
      const verdict = passes(lesson, answer);
      assert.equal(verdict, true, typeof verdict === 'string' ? verdict : 'the check said no');
    });

    check(`course: lesson "${lesson.title}" does not pass an empty answer`, () => {
      let verdict;
      try { verdict = passes(lesson, lesson.start || 'show "nothing"'); }
      catch { verdict = 'it did not even run'; }
      assert.notEqual(verdict, true, 'the starter code passes on its own, so the check asks nothing');
    });
  }

  // ------------------------------------------------------------ projects

  const QUIZ = [
    'make questions be [',
    '    { ask: "2 plus 2", answer: 4 },',
    '    { ask: "5 times 3", answer: 15 },',
    '    { ask: "9 minus 4", answer: 5 }',
    ']',
    'show length of questions'
  ].join('\n');

  const QUIZ_LISTED = [
    QUIZ.replace('show length of questions', ''),
    'repeat with number from 1 to length of questions',
    '    make question be item number of questions',
    '    show "{number}. {ask of question}"',
    'end'
  ].join('\n');

  const QUIZ_MARKED = [
    QUIZ_LISTED,
    'to mark with given and wanted',
    '    give back given is wanted',
    'end',
    'make score be 0',
    'make guesses be a list of 4, 15, 1',
    'repeat with number from 1 to length of questions',
    '    make question be item number of questions',
    '    if mark with item number of guesses and answer of question',
    '        add 1 to score',
    '    end',
    'end',
    'show "score {score}"'
  ].join('\n');

  const QUIZ_DONE = [
    QUIZ_MARKED.replace('show "score {score}"', ''),
    'if score is length of questions',
    '    show "Full marks! {score} out of {length of questions}"',
    'otherwise',
    '    show "You got {score} out of {length of questions}"',
    'end'
  ].join('\n');

  const SITE_1 = [
    'make a website called "About Me"',
    'add a title "About Me"',
    'add text "Written in Plain."'
  ].join('\n');

  const SITE_2 = [
    SITE_1,
    'add a card called "Things I like"',
    '    add a list of "rain", "maps", "old radios"',
    'end'
  ].join('\n');

  const SITE_3 = [
    SITE_2,
    'add a button "Say hello"',
    '    show a message "Hello!"',
    'end'
  ].join('\n');

  const SITE_4 = [
    SITE_3.replace('make a website called "About Me"', 'make a website called "About Me"\nset the theme to "dark"'),
    'make a page called "Projects" at "/projects"',
    'add a title "Projects"',
    'add text "Things I have made."'
  ].join('\n');

  const GAME_1 = [
    'start a game called "Catch" sized 640 by 480',
    'set the background to "#141225"',
    'make basket be a box at 320 , 440 sized 90 by 18 colored "#ffd166"',
    'make star be a circle at 320 , 0 sized 22 colored "#ef476f"'
  ].join('\n');

  const GAME_2 = `${GAME_1}\nset the speed of star to 0 , 4`;

  const GAME_3 = [
    GAME_2,
    'every frame',
    '    if key "left" is held',
    '        move basket left by 9',
    '    end',
    '    if key "right" is held',
    '        move basket right by 9',
    '    end',
    '    keep basket on the screen',
    'end'
  ].join('\n');

  const GAME_4 = [
    GAME_2,
    'make score be 0',
    'every frame',
    '    if key "left" is held',
    '        move basket left by 9',
    '    end',
    '    if key "right" is held',
    '        move basket right by 9',
    '    end',
    '    keep basket on the screen',
    '    draw "score {score}" at 18 , 16',
    'end',
    'when star touches basket',
    '    add 1 to score',
    '    move star to random 40 to 600 , 0',
    'end'
  ].join('\n');

  const WORLD_1 = [
    'start a world called "Moon Walk" sized 900 by 600',
    'set the sky to "#0b1020"',
    'set world gravity to 0.02',
    'make ground be a floor at 0 , 0 , 0 sized 60 by 60 colored "#2c3a4f"',
    'make hero be a cube at 0 , 1 , 0 sized 1.6 colored "#ffd166"'
  ].join('\n');

  const WORLD_2 = `${WORLD_1}\nfollow hero with the camera`;

  const WORLD_3 = [
    WORLD_2,
    'every frame',
    '    if key "left" is held',
    '        turn hero left by 3',
    '    end',
    '    if key "right" is held',
    '        turn hero right by 3',
    '    end',
    '    if key "up" is held',
    '        move hero forward by 0.2',
    '    end',
    'end'
  ].join('\n');

  const WORLD_4 = [
    WORLD_3.replace('follow hero with the camera',
      'make prize be a ball at -6 , 1 , -8 sized 1.4 colored "#ef476f"\nfollow hero with the camera'),
    'make score be 0',
    'when hero touches prize',
    '    add 1 to score',
    '    move prize to random -20 to 20 , 1 , random -20 to 20',
    'end'
  ].join('\n');

  const FILM_1 = [
    'make a video called "My Film" sized 1280 by 720',
    'add a title "My Film" for 3 seconds'
  ].join('\n');

  const FILM_2 = [
    FILM_1,
    'fade the last clip in over 1 seconds',
    'add a background "#1b2a41" for 3 seconds',
    'put the words "One summer" on the last clip',
    'add a background "#22304a" for 3 seconds',
    'put the words "and then another" on the last clip'
  ].join('\n');

  const FILM_3 = [
    FILM_2,
    'add a title "The end" for 4 seconds',
    'fade the last clip out over 1 seconds'
  ].join('\n');

  const TRANSLATE_1 = [
    'to double with n',
    '    give back n times 2',
    'end',
    'make total be 0',
    'repeat with n from 1 to 5',
    '    add double with n to total',
    'end',
    'show "total is {total}"'
  ].join('\n');

  const TRANSLATE_SORTED = [
    'make scores be a list of 5, 3, 9, 1',
    'show join sorted scores with " < "'
  ].join('\n');


  const BOOK_1 = [
    'make book be a table called "guestbook"',
    'empty the table book',
    'when someone visits "/"',
    '    answer with "{number of rows in book} so far"',
    'end'
  ].join('\n');

  const BOOK_FORM = "<form method='post' action='/write'><input name='words'><button>Sign</button></form>";

  const BOOK_2 = [
    'make book be a table called "guestbook"',
    'empty the table book',
    'when someone visits "/"',
    `    answer with "{number of rows in book} so far ${BOOK_FORM}"`,
    'end',
    'when someone sends to "/write"',
    '    save { words: the form field "words" } in book',
    '    send them to "/"',
    'end'
  ].join('\n');

  // From here on the messages go on the page, so they have to be made safe
  // first - which is the point of the step.
  const SAFELY = [
    'to safely with words',
    '    make out be text of words',
    '    set out to replace "&" with "&amp;" in out',
    '    set out to replace "<" with "&lt;" in out',
    '    give back out',
    'end'
  ].join('\n');

  const BOOK_3 = [
    'make book be a table called "guestbook"',
    'empty the table book',
    SAFELY,
    'when someone visits "/"',
    '    make page be ""',
    '    for each one in every row of book',
    '        set page to page joined with "<p>{safely with words of one}</p>"',
    '    end',
    `    answer with "${BOOK_FORM}{page}"`,
    'end',
    'when someone sends to "/write"',
    '    save { words: the form field "words" } in book',
    '    send them to "/"',
    'end'
  ].join('\n');

  const BOOK_4 = [
    'make book be a table called "guestbook"',
    'empty the table book',
    SAFELY,
    'when someone visits "/"',
    '    make page be ""',
    '    for each one in every row of book',
    // Not "who": a name of your own beats a phrase that starts with the same
    // word, and "who is signed in" would stop being a phrase.
    '        make named be value "by" of one',
    '        if named is nothing',
    '            set named to "somebody"',
    '        end',
    '        set page to page joined with "<p>{safely with named} wrote {safely with words of one}</p>"',
    '    end',
    `    answer with "${BOOK_FORM}{page}"`,
    'end',
    'when someone sends to "/write"',
    '    make said be the form field "words"',
    '    sign this visitor in as the form field "who"',
    '    make caller be who is signed in',
    '    save { words: said, by: caller } in book',
    '    send them to "/"',
    'end'
  ].join('\n');

  const PROTO_1 = [
    'make packet be []',
    'add the byte 1 to packet',
    'add the number 4096 in 2 bytes to packet',
    'add the number 1200 in 2 bytes to packet',
    'add the number 800 in 2 bytes to packet',
    'show hex of packet'
  ].join('\n');

  const PROTO_2 = PROTO_1 + '\n' + [
    'show the number in packet at 2 over 2 bytes',
    'show the number in packet at 4 over 2 bytes',
    'show the number in packet at 6 over 2 bytes'
  ].join('\n');

  const PROTO_3 = [
    'make packet be []',
    'make squeezed be round (1234.5 times 512)',
    'add the number squeezed in 3 bytes to packet',
    'make back be the number in packet at 1 over 3 bytes',
    'show back divided by 512'
  ].join('\n');

  const PROJECT_ANSWERS = {
    quiz: [QUIZ, QUIZ_LISTED, QUIZ_MARKED, QUIZ_DONE],
    site: [SITE_1, SITE_2, SITE_3, SITE_4],
    game: [GAME_1, GAME_2, GAME_3, GAME_4],
    world: [WORLD_1, WORLD_2, WORLD_3, WORLD_4],
    video: [FILM_1, FILM_2, FILM_3],
    translate: [TRANSLATE_1, TRANSLATE_1, TRANSLATE_1, TRANSLATE_SORTED, TRANSLATE_SORTED],
    protocol: [PROTO_1, PROTO_2, PROTO_3],
    guestbook: [BOOK_1, BOOK_2, BOOK_3, BOOK_4]
  };

  for (const project of PROJECTS) {
    const answers = PROJECT_ANSWERS[project.id];
    check(`course: "${project.title}" has an answer for every step`, () => {
      assert.ok(answers, `no worked answers for the "${project.id}" project`);
      assert.equal(answers.length, project.steps.length);
    });

    project.steps.forEach((step, index) => {
      check(`course: "${project.id}" step ${index + 1} can be passed`, () => {
        const answer = answers[index];
        // The last step of the translate project needs the button pressed.
        const extra = project.id === 'translate' && index >= 1 ? { translated: true } : {};
        const verdict = passes(step, answer, extra);
        assert.equal(verdict, true, typeof verdict === 'string' ? verdict : 'the check said no');
      });
    });
  }

  check('course: the step count matches what is taught', () => {
    const counted = LESSONS.length + PROJECTS.reduce((sum, project) => sum + project.steps.length, 0);
    assert.equal(totalSteps(), counted);
  });

  check('course: every project step explains what to do', () => {
    for (const project of PROJECTS) {
      for (const step of project.steps) {
        assert.ok(step.task && step.task.length > 20, `a step of "${project.id}" has no real task`);
        assert.equal(typeof step.check, 'function');
      }
    }
  });
}
