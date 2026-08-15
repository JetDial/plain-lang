// Plain - working out which names only ever hold numbers.
//
// Everything in a translated Plain program is a Value: a small box that
// might hold a number, or a piece of text, or a list. That is what makes the
// language easy to write and it is also, measurably, what makes the compiled
// programs about twenty times slower than the same thing written by hand in
// Rust or C++ - every add is a function call that looks inside two boxes,
// works out they are both numbers, and puts the answer in a third box.
//
// Most names never need the box. A loop counter, a running total, a
// distance, an angle: these hold a number when they are made and a number
// every time after. If we can prove that about a name, the translator can
// use the machine's own number for it and the machine's own add.
//
// This is the proof, and it is deliberately timid. Anything it has not been
// taught to recognise disqualifies the name, because being wrong here does
// not produce a slow program, it produces a wrong one.

// Reading these of a name is still reading a number.
const NUMERIC_FIELDS = new Set(['length', 'size', 'count']);

export function numericNames(block, params = [], lists = null) {
  // Walking a run of plain numbers hands out plain numbers, so the name in
  // that loop is one too.
  const numberLists = lists || new Set();

  // The rule, and it took two goes to get right.
  //
  // The first version banned a name the moment it was *read* anywhere that
  // wanted a real Value - inside a piece of text, handed to an action. That
  // is far too strict, and it is strict for no reason: reading is always
  // safe, because the translator can put the number in a box at that one
  // spot and hand it over. A total that is added up as a number and then
  // shown in a sentence is still a number the whole time it is being added.
  //
  // What actually matters is what a name is *given*. If every single thing
  // ever put into it is a number, it is a number. If one of them might not
  // be, it is not, and no amount of reading changes that either way.
  const numeric = new Set();
  const banned = new Set();
  const lower = (name) => String(name).toLowerCase();
  const ban = (name) => { if (name) banned.add(lower(name)); };

  const isNumber = (node) => {
    if (!node) return false;
    switch (node.type) {
      case 'Number': return true;
      case 'Var': {
        const name = lower(node.name);
        return numeric.has(name) && !banned.has(name);
      }
      case 'Negate': return isNumber(node.value);
      case 'Math':
        // Plain joins text with the same word it adds numbers with, so this
        // is only arithmetic when both sides are certainly numbers.
        return isNumber(node.left) && isNumber(node.right);
      default: return false;
    }
  };

  const give = (name, value) => {
    const key = lower(name);
    if (isNumber(value)) { if (!banned.has(key)) numeric.add(key); }
    else ban(key);
  };

  const statements = (nodes) => { for (const one of nodes || []) statement(one); };

  const statement = (node) => {
    if (!node) return;
    switch (node.type) {
      case 'Make': give(node.name, node.value); return;
      case 'Set':
        if (node.target && node.target.type === 'Var') give(node.target.name, node.value);
        return;
      case 'If':
        // An "if" keeps its parts in "branches", not in a block of its own.
        // Reading that wrong made every assignment inside an if invisible,
        // which is not a missed optimisation - it is a name being called a
        // number because the line that made it text was never looked at.
        for (const branch of node.branches || []) statements(branch.block && branch.block.body);
        statements(node.otherwise && node.otherwise.body);
        return;
      case 'While':
        statements(node.block && node.block.body);
        return;
      case 'Count': {
        // A counter is a number by the shape of the sentence.
        const counter = lower(node.name);
        if (!banned.has(counter)) numeric.add(counter);
        statements(node.block && node.block.body);
        return;
      }
      case 'Repeat':
        if (!banned.has('count')) numeric.add('count');
        statements(node.block && node.block.body);
        return;
      case 'ForEach': {
        const each = lower(node.name);
        if (node.list && node.list.type === 'Var' && numberLists.has(lower(node.list.name))) {
          if (!banned.has(each)) numeric.add(each);
        } else {
          ban(each);
        }
        statements(node.block && node.block.body);
        return;
      }
      case 'Phrase': {
        // The sentences that put something into a name. Everything else
        // only reads, and reading is always safe.
        const spec = String(node.spec || '');
        const args = node.args || {};
        if (spec === 'add $value to #name') {
          // This adds numbers and appends to lists, so it only keeps a name
          // numeric when what is given is certainly a number.
          give(args.name, args.value);
          return;
        }
        if (spec === 'take $value from #name') { give(args.name, args.value); return; }
        if (spec === 'put $value into #name') { give(args.name, args.value); return; }
        if (args.name !== undefined && typeof args.name === 'string') ban(args.name);
        return;
      }
      case 'Try':
        statements(node.block && node.block.body);
        statements(node.rescue && node.rescue.body);
        return;
      case 'Block':
        statements(node.body);
        return;
      case 'Function': case 'Kind':
        return;
      default:
        // Anything with a block inside it still has to be walked, because a
        // name can be given something in there.
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (child && typeof child === 'object' && Array.isArray(child.body)) statements(child.body);
        }
    }
  };

  // A parameter could be handed anything at all.
  for (const param of params) ban(param);

  // Twice, because a name can look like a number until a later line spoils
  // it, and nothing may be trusted that the second pass takes back.
  statements(block && block.body);
  const first = new Set([...numeric].filter(name => !banned.has(name)));
  numeric.clear();
  banned.clear();
  for (const param of params) ban(param);
  statements(block && block.body);

  const out = new Set();
  for (const name of numeric) if (!banned.has(name) && first.has(name)) out.add(name);
  return out;
}


// Which names hold a list of nothing but numbers.
//
// This is the same idea one step out, and it is what unlocks the two things
// C++ is usually reached for. A list of boxed values is a list of pointers
// to numbers scattered across memory; a list of plain numbers is one run of
// memory, which is the only shape a processor can do several at a time, and
// the only shape that can be handed to another thread without the counting
// of shares going wrong.
//
// The rules are the same as for a single number, and just as timid: made
// empty or from numbers, only ever added to with numbers, and only ever
// used in ways a run of numbers can answer.
export function numericLists(block, params = []) {
  const made = new Set();
  const banned = new Set();
  const lower = (name) => String(name).toLowerCase();

  const allNumbers = (node) => {
    if (!node) return false;
    if (node.type !== 'List') return false;
    return (node.items || []).every(item => item.type === 'Number'
      || (item.type === 'Negate' && item.value && item.value.type === 'Number'));
  };

  const walk = (node, listPlace, holder) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Var') {
      // A list name read anywhere except the places below has to be a real
      // list again, so it stops qualifying.
      if (!listPlace) banned.add(lower(node.name));
      return;
    }
    if (node.type === 'Field') {
      const field = String(node.name || '').toLowerCase();
      // Reading how long it is, or an item of it, is fine.
      if (['length', 'size', 'count', 'first', 'last'].includes(field)
          && node.object && node.object.type === 'Var') return;
      walk(node.object, false);
      return;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) for (const one of child) walk(one, false);
      else if (child && typeof child === 'object' && child.type) walk(child, false);
    }
  };

  const statements = (nodes) => { for (const one of nodes || []) statement(one); };

  const statement = (node) => {
    if (!node) return;
    switch (node.type) {
      case 'Make': {
        const name = lower(node.name);
        const value = node.value;
        const empty = value && value.type === 'List' && (value.items || []).length === 0;
        if (empty || allNumbers(value)) made.add(name);
        else banned.add(name);
        walk(value, false);
        return;
      }
      case 'Set':
        if (node.target && node.target.type === 'Var') banned.add(lower(node.target.name));
        walk(node.target, false);
        walk(node.value, false);
        return;
      case 'ForEach':
        // Walking one is exactly what a run of numbers is for.
        if (node.list && node.list.type === 'Var') { /* allowed */ }
        else walk(node.list, false);
        statements(node.block && node.block.body);
        return;
      case 'Phrase': {
        // "add 3 to numbers" keeps it a run of numbers; anything else that
        // takes the name does not.
        const spec = String(node.spec || '');
        if (spec === 'add $value to #name') {
          const value = (node.values || {}).value || (node.args || {}).value;
          if (!value || !isPlainNumeric(value)) banned.add(lower(nameOf(node)));
          return;
        }
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (child && typeof child === 'object') walk(child, false);
        }
        if (nameOf(node)) banned.add(lower(nameOf(node)));
        return;
      }
      case 'If':
        walk(node.condition, false);
        statements(node.block && node.block.body);
        for (const other of node.others || []) {
          walk(other.condition, false);
          statements(other.block && other.block.body);
        }
        statements(node.otherwise && node.otherwise.body);
        return;
      case 'While':
        walk(node.condition, false);
        statements(node.block && node.block.body);
        return;
      case 'Count': case 'Repeat':
        walk(node.from, false); walk(node.to, false); walk(node.times, false);
        statements(node.block && node.block.body);
        return;
      case 'Block':
        statements(node.body);
        return;
      case 'Function': case 'Kind':
        return;
      default:
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (Array.isArray(child)) for (const one of child) walk(one, false);
          else if (child && typeof child === 'object' && child.type) walk(child, false);
        }
    }
  };

  const nameOf = (node) => {
    const bag = node.names || node.args || node.values || {};
    return bag.name || null;
  };

  const isPlainNumeric = (node) => {
    if (!node) return false;
    switch (node.type) {
      case 'Number': return true;
      case 'Negate': return isPlainNumeric(node.value);
      case 'Math': return isPlainNumeric(node.left) && isPlainNumeric(node.right);
      case 'Var': return true;      // checked against the number analysis by the caller
      default: return false;
    }
  };

  for (const param of params) banned.add(lower(param));
  statements(block && block.body);

  const out = new Set();
  for (const name of made) if (!banned.has(name)) out.add(name);
  return out;
}
