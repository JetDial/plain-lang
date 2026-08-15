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

export function numericNames(block, params = []) {
  const seen = new Map();     // name -> true while it still looks numeric
  const banned = new Set();

  const lower = (name) => String(name).toLowerCase();

  const ban = (name) => { banned.add(lower(name)); };

  // Is this expression certainly a number, given what we believe so far?
  // "Certainly" is doing a lot of work: a call might return anything, a
  // field might hold anything, so neither counts.
  const isNumber = (node) => {
    if (!node) return false;
    switch (node.type) {
      case 'Number': return true;
      case 'Var': return seen.has(lower(node.name)) && !banned.has(lower(node.name));
      case 'Negate': return isNumber(node.value);
      case 'Math': return isNumber(node.left) && isNumber(node.right);
      default: return false;
    }
  };

  // Walking an expression: anything a name is used for that is not plain
  // arithmetic or a comparison bans it, because at that point it has to be
  // a real Value again and the translator would have to box it back up.
  const walkValue = (node, numericPlace) => {
    if (!node || typeof node !== 'object') return;
    switch (node.type) {
      case 'Var':
        if (!numericPlace) ban(node.name);
        return;
      case 'Number': case 'Text': case 'Bool': case 'Nothing':
        return;
      case 'Math':
        walkValue(node.left, numericPlace);
        walkValue(node.right, numericPlace);
        return;
      case 'Negate':
        walkValue(node.value, numericPlace);
        return;
      case 'Compare':
        // Both sides of a comparison are read as numbers when both sides
        // look like numbers; otherwise it is a general comparison and the
        // names in it have to stay boxed.
        if (isNumber(node.left) && isNumber(node.right)) {
          walkValue(node.left, true);
          walkValue(node.right, true);
        } else {
          walkValue(node.left, false);
          walkValue(node.right, false);
        }
        return;
      case 'Not':
        walkValue(node.value, false);
        return;
      case 'Logic':
        walkValue(node.left, false);
        walkValue(node.right, false);
        return;
      case 'Field':
        // "length of x" reads a number out of x, but x itself is still a
        // list or a piece of text and must stay one.
        walkValue(node.object, false);
        return;
      case 'List':
        for (const item of node.items || []) walkValue(item, false);
        return;
      case 'Record':
        for (const pair of node.pairs || []) walkValue(pair.value, false);
        return;
      case 'New':
        for (const pair of node.pairs || []) walkValue(pair.value, false);
        return;
      default: {
        // Anything else - a call, a phrase, something added later - is read
        // as "this could do anything", so every name inside it is banned.
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (Array.isArray(child)) for (const one of child) walkValue(one, false);
          else if (child && typeof child === 'object' && child.type) walkValue(child, false);
        }
      }
    }
  };

  const walkStatements = (nodes) => {
    for (const node of nodes || []) walkStatement(node);
  };

  const walkStatement = (node) => {
    if (!node) return;
    switch (node.type) {
      case 'Make': {
        const name = lower(node.name);
        if (isNumber(node.value) && !banned.has(name)) {
          if (!seen.has(name)) seen.set(name, true);
        } else {
          ban(name);
        }
        walkValue(node.value, isNumber(node.value));
        return;
      }
      case 'Set': {
        // Only the simple form counts. Setting a field, or an item of a
        // list, is not a name holding a number.
        if (node.target && node.target.type === 'Var') {
          const name = lower(node.target.name);
          if (!isNumber(node.value)) ban(name);
          walkValue(node.value, isNumber(node.value));
        } else {
          walkValue(node.target, false);
          walkValue(node.value, false);
        }
        return;
      }
      case 'If':
        walkValue(node.condition, false);
        walkStatements(node.block && node.block.body);
        for (const other of node.others || []) {
          walkValue(other.condition, false);
          walkStatements(other.block && other.block.body);
        }
        walkStatements(node.otherwise && node.otherwise.body);
        return;
      case 'While':
        walkValue(node.condition, false);
        walkStatements(node.block && node.block.body);
        return;
      case 'Count': {
        // A counter is a number by the shape of the sentence - "from 1 to
        // 20" cannot hold anything else - so it counts as one, and so does
        // anything worked out from it.
        const counter = lower(node.name);
        if (!banned.has(counter)) seen.set(counter, true);
        walkValue(node.from, isNumber(node.from));
        walkValue(node.to, isNumber(node.to));
        walkValue(node.step, isNumber(node.step));
        walkStatements(node.block && node.block.body);
        return;
      }
      case 'ForEach':
        ban(node.name);
        walkValue(node.list, false);
        walkStatements(node.block && node.block.body);
        return;
      case 'Repeat': {
        // "repeat 3 times" hands the block a name called count, which is a
        // number for the same reason.
        if (!banned.has('count')) seen.set('count', true);
        walkValue(node.times, isNumber(node.times));
        walkStatements(node.block && node.block.body);
        return;
      }
      case 'Return':
        // Giving a number back is allowed: the translator puts it in a box
        // on the way out, once, rather than on every line.
        if (node.value && node.value.type === 'Var' && isNumber(node.value)) return;
        walkValue(node.value, false);
        return;
      case 'Block':
        walkStatements(node.body);
        return;
      case 'Function': case 'Kind':
        // A nested one has its own names; nothing here can be trusted after
        // it, so the simplest correct answer is to look no further.
        return;
      default: {
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (Array.isArray(child)) {
            for (const one of child) {
              if (one && one.type) (one.type in { Make: 1, Set: 1, If: 1, While: 1 }) ? walkStatement(one) : walkValue(one, false);
            }
          } else if (child && typeof child === 'object' && child.type) {
            walkValue(child, false);
          }
        }
      }
    }
  };

  // A parameter could be handed anything at all, so it never qualifies.
  for (const param of params) ban(param);

  // Twice, because a name can look numeric until a later line spoils it -
  // and a name banned on the second pass must not have been trusted by
  // anything on the first.
  walkStatements(block && block.body);
  const firstRound = new Set([...seen.keys()].filter(name => !banned.has(name)));
  seen.clear();
  banned.clear();
  for (const param of params) ban(param);
  walkStatements(block && block.body);

  const out = new Set();
  for (const name of seen.keys()) {
    if (!banned.has(name) && firstRound.has(name)) out.add(name);
  }
  return out;
}
