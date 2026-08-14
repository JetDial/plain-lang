// Plain -> Python.

import { Emitter } from './emitter.js';

const RESERVED = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
  'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if',
  'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield', 'True', 'False', 'None', 'print',
  'list', 'dict', 'str', 'int', 'float', 'input', 'type', 'sum', 'min', 'max'
]);

export class PythonEmitter extends Emitter {
  get name() { return 'Python'; }
  get extension() { return '.py'; }
  get indentText() { return '    '; }
  get lineEnd() { return ''; }
  get reserved() { return RESERVED; }
  get selfWord() { return 'self'; }
  get trueWord() { return 'True'; }
  get falseWord() { return 'False'; }
  get nothingWord() { return 'None'; }
  get andWord() { return 'and'; }
  get orWord() { return 'or'; }
  get notWord() { return 'not '; }

  comment(text) { return '# ' + text; }
  helperCall(name, args) { return `plain_${snake(name)}(${args.join(', ')})`; }
  declare(name, value) { return `${name} = ${value}`; }
  ifHeader(condition) { return `if ${condition}:`; }
  elseIfHeader(condition) { return `elif ${condition}:`; }
  elseHeader() { return 'else:'; }
  whileHeader(condition) { return `while ${condition}:`; }
  forEachHeader(name, iterable) { return `for ${name} in ${iterable}:`; }
  functionHeader(name, params) { return `def ${name}(${params.join(', ')}):`; }
  classHeader(name, base) { return `class ${name}${base ? `(${base})` : ''}:`; }
  methodHeader(name, params) { return `def ${name}(${['self', ...params].join(', ')}):`; }
  tryHeader() { return 'try:'; }
  catchHeader(name) { return `except Exception as ${name}:`; }
  problemText(name) { return `str(${name})`; }
  closer() { return ''; }
  chainPrefix() { return ''; }
  emptyBlock() { this.write('pass'); }
  power(left, right) { return `(${left} ** ${right})`; }
  isKindOf(value, kind) { return `isinstance(${value}, ${kind})`; }
  kindNameOf(value) { return `type(${value}).__name__`; }
  recordKey(key) { return JSON.stringify(key); }

  // A Plain thing can be a dictionary or one of your own kinds, and Python
  // reaches into those two differently, so a helper does the deciding.
  fieldAccess(object, field) {
    if (object === 'self') return `self.${field}`;
    return this.helper('field', [object, JSON.stringify(field)]);
  }

  assignField(object, field, value) {
    if (object === 'self') return `self.${field} = ${value}`;
    return this.helper('setField', [object, JSON.stringify(field), value]);
  }

  newInstance(kind, pairs) {
    if (!pairs.length) return `${kind}()`;
    return `${kind}(${pairs.map(([key, value]) => `${this.identifier(key)}=${value}`).join(', ')})`;
  }

  exitProgram() {
    this.needsSys = true;
    return 'sys.exit(0)';
  }

  raiseProblem(message) { return `raise Exception(${message})`; }
  showStatement(value) { return `print(${value})`; }

  emitConstructor(node) {
    this.write('');
    this.open('def __init__(self, **values):');
    if (node.base) this.writeLine('super().__init__(**values)');
    for (const field of node.fields) {
      this.writeLine(`self.${this.fieldName(field.name)} = ${field.value ? this.expression(field.value) : 'None'}`);
    }
    this.open('for _key, _value in values.items():');
    this.writeLine('setattr(self, _key, _value)');
    this.close();
    this.close();
  }

  preamble() {
    return this.needsSys ? ['import sys'] : [];
  }

  postamble() { return []; }

  helperSource() { return HELPERS; }

  // Python has no braces, so a helper is a def; the base class already keeps
  // only the ones this program uses.
  emitHelpers() {
    const wanted = new Set();
    const add = (name) => {
      if (wanted.has(name) || !HELPERS[name]) return;
      wanted.add(name);
      for (const needed of HELPERS[name].needs || []) add(needed);
    };
    for (const name of this.used) add(name);
    if (!wanted.size) return '';
    const uses = new Set();
    for (const name of wanted) for (const module of HELPERS[name].imports || []) uses.add(module);
    const imports = [...uses].sort().map(module => `import ${module}`);
    const body = Object.keys(HELPERS).filter(name => wanted.has(name)).map(name => HELPERS[name].code.trimEnd());
    return [...imports, ...(imports.length ? [''] : []), ...body].join('\n\n');
  }
}

function snake(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

const HELPERS = {
  text: {
    code: `# Values written the way Plain writes them.
def plain_text(value, depth=0):
    if value is None:
        return "nothing"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (int, float)):
        return plain_number_text(value)
    if isinstance(value, str):
        return value if depth == 0 else '"' + value + '"'
    if isinstance(value, list):
        return "[" + ", ".join(plain_text(item, depth + 1) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ", ".join(str(key) + ": " + plain_text(item, depth + 1) for key, item in value.items()) + "}"
    if callable(value):
        return "<action>"
    own = vars(value) if hasattr(value, "__dict__") else {}
    inside = ", ".join(str(key) + ": " + plain_text(item, depth + 1) for key, item in own.items())
    return "a " + type(value).__name__ + " (" + inside + ")"`,
    needs: ['number_text']
  },

  number_text: {
    code: `def plain_number_text(value):
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, int):
        return str(value)
    return ("%.12g" % value)`
  },

  number: {
    code: `def plain_number(value):
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return value
    if value is None:
        return 0
    try:
        text = str(value)
        return int(text) if text.lstrip("-").isdigit() else float(text)
    except (TypeError, ValueError):
        return 0`
  },

  truthy: {
    code: `def plain_truthy(value):
    if value is None or value is False:
        return False
    if value == 0 or value == "":
        return False
    if isinstance(value, list):
        return len(value) > 0
    return True`
  },

  same: {
    code: `def plain_same(a, b):
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, bool) or isinstance(b, bool):
        return plain_truthy(a) == plain_truthy(b)
    if isinstance(a, (int, float)) or isinstance(b, (int, float)):
        return plain_number(a) == plain_number(b)
    return a == b`,
    needs: ['number', 'truthy']
  },

  add: {
    code: `def plain_add(a, b):
    if isinstance(a, str) or isinstance(b, str):
        return plain_text(a) + plain_text(b)
    return plain_number(a) + plain_number(b)`,
    needs: ['text', 'number']
  },

  join2: {
    code: `def plain_join2(a, b):
    return plain_text(a) + plain_text(b)`,
    needs: ['text']
  },

  divide: {
    code: `def plain_divide(a, b):
    if plain_number(b) == 0:
        raise Exception("I cannot divide by zero")
    return plain_number(a) / plain_number(b)`,
    needs: ['number']
  },

  remainder: {
    code: `def plain_remainder(a, b):
    if plain_number(b) == 0:
        raise Exception("I cannot divide by zero")
    return math.fmod(plain_number(a), plain_number(b))`,
    needs: ['number'],
    imports: ['math']
  },

  has: {
    code: `def plain_has(container, value):
    if isinstance(container, list):
        return any(plain_same(item, value) for item in container)
    if isinstance(container, str):
        return plain_text(value) in container
    return False`,
    needs: ['same', 'text']
  },

  items: {
    code: `def plain_items(value):
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return list(value)
    if isinstance(value, dict):
        return list(value.keys())
    return []`
  },

  range: {
    code: `# Plain counts up or down depending on the two numbers.
def plain_range(start, finish, step):
    move = abs(plain_number(step)) or 1
    if finish < start:
        move = -move
    out = []
    at = plain_number(start)
    while (at <= finish) if move > 0 else (at >= finish):
        out.append(at)
        at += move
    return out`,
    needs: ['number']
  },

  item: {
    code: `# Lists count from 1 in Plain.
def plain_item(collection, index):
    at = int(plain_number(index))
    if isinstance(collection, str) or isinstance(collection, list):
        place = len(collection) + at if at < 0 else at - 1
        if 0 <= place < len(collection):
            return collection[place]
    return None`,
    needs: ['number']
  },

  setItem: {
    code: `def plain_set_item(collection, index, value):
    at = int(plain_number(index))
    place = len(collection) + at if at < 0 else at - 1
    if isinstance(collection, list) and 0 <= place < len(collection):
        collection[place] = value
    return collection`,
    needs: ['number']
  },

  first: { code: `def plain_first(collection):\n    return plain_item(collection, 1)`, needs: ['item'] },
  last: { code: `def plain_last(collection):\n    return plain_item(collection, plain_length(collection))`, needs: ['item', 'length'] },

  length: {
    code: `def plain_length(value):
    if isinstance(value, (list, str, dict)):
        return len(value)
    return 0`
  },

  total: { code: `def plain_total(collection):\n    return sum(plain_number(item) for item in plain_items(collection))`, needs: ['items', 'number'] },
  average: { code: `def plain_average(collection):\n    all_items = plain_items(collection)\n    return plain_total(all_items) / len(all_items) if all_items else 0`, needs: ['items', 'total'] },
  highest: { code: `def plain_highest(collection):\n    all_items = plain_items(collection)\n    return max(all_items, key=plain_number) if all_items else None`, needs: ['items', 'number'] },
  lowest: { code: `def plain_lowest(collection):\n    all_items = plain_items(collection)\n    return min(all_items, key=plain_number) if all_items else None`, needs: ['items', 'number'] },

  sorted: {
    code: `def plain_sorted(collection):
    all_items = list(plain_items(collection))
    if all(isinstance(item, (int, float)) and not isinstance(item, bool) for item in all_items):
        return sorted(all_items)
    return sorted(all_items, key=plain_text)`,
    needs: ['items', 'text']
  },

  reversed: { code: `def plain_reversed(collection):\n    return list(reversed(plain_items(collection)))`, needs: ['items'] },
  copy: { code: `def plain_copy(value):\n    if isinstance(value, list):\n        return list(value)\n    if isinstance(value, dict):\n        return dict(value)\n    return value` },
  joinWith: { code: `def plain_join_with(collection, separator):\n    return plain_text(separator).join(plain_text(item) for item in plain_items(collection))`, needs: ['items', 'text'] },
  position: {
    code: `def plain_position(collection, value):
    if isinstance(collection, str):
        return collection.find(plain_text(value)) + 1
    for at, item in enumerate(plain_items(collection)):
        if plain_same(item, value):
            return at + 1
    return 0`,
    needs: ['items', 'same', 'text']
  },

  addTo: {
    code: `# "add x to name" grows a list, adds to a number, or joins text.
def plain_add_to(current, value):
    if isinstance(current, list):
        current.append(value)
        return current
    if isinstance(current, str):
        return current + plain_text(value)
    return plain_number(current) + plain_number(value)`,
    needs: ['text', 'number']
  },

  removeValue: {
    code: `def plain_remove_value(collection, value):
    if not isinstance(collection, list):
        return collection
    for at, item in enumerate(collection):
        if plain_same(item, value):
            del collection[at]
            break
    return collection`,
    needs: ['same']
  },

  removeAt: {
    code: `def plain_remove_at(collection, index):
    at = int(plain_number(index))
    if isinstance(collection, list) and 1 <= at <= len(collection):
        del collection[at - 1]
    return collection`,
    needs: ['number']
  },

  emptied: { code: `def plain_emptied(value):\n    if isinstance(value, list):\n        value.clear()\n        return value\n    return None` },

  field: {
    code: `# "name of thing" - a dictionary key, or a value on one of your kinds.
def plain_field(thing, name):
    if isinstance(thing, dict):
        for key in thing:
            if str(key).lower() == name.lower():
                return thing[key]
        return None
    if isinstance(thing, (list, str)):
        if name.lower() in ("length", "size", "count"):
            return len(thing)
    found = getattr(thing, name, None)
    if found is None and hasattr(thing, "__dict__"):
        for key in vars(thing):
            if str(key).lower() == name.lower():
                return vars(thing)[key]
    return found`
  },

  setField: {
    code: `def plain_set_field(thing, name, value):
    if isinstance(thing, dict):
        for key in thing:
            if str(key).lower() == name.lower():
                thing[key] = value
                return
        thing[name] = value
        return
    setattr(thing, name, value)`
  },

  keys: { code: `def plain_keys(thing):\n    if isinstance(thing, dict):\n        return list(thing.keys())\n    return list(vars(thing).keys()) if hasattr(thing, "__dict__") else []` },
  values: { code: `def plain_values(thing):\n    if isinstance(thing, dict):\n        return list(thing.values())\n    return list(vars(thing).values()) if hasattr(thing, "__dict__") else []` },
  value: {
    code: `def plain_value(thing, key):
    wanted = plain_text(key).lower()
    holder = thing if isinstance(thing, dict) else (vars(thing) if hasattr(thing, "__dict__") else {})
    for name, item in holder.items():
        if str(name).lower() == wanted:
            return item
    return None`,
    needs: ['text']
  },
  setValue: {
    code: `def plain_set_value(thing, key, value):
    wanted = plain_text(key).lower()
    holder = thing if isinstance(thing, dict) else vars(thing)
    for name in list(holder.keys()):
        if str(name).lower() == wanted:
            holder[name] = value
            return
    holder[plain_text(key)] = value`,
    needs: ['text']
  },
  hasKey: {
    code: `def plain_has_key(thing, key):
    wanted = plain_text(key).lower()
    holder = thing if isinstance(thing, dict) else (vars(thing) if hasattr(thing, "__dict__") else {})
    return any(str(name).lower() == wanted for name in holder)`,
    needs: ['text']
  },

  upper: { code: `def plain_upper(text):\n    return plain_text(text).upper()`, needs: ['text'] },
  lower: { code: `def plain_lower(text):\n    return plain_text(text).lower()`, needs: ['text'] },
  trimmed: { code: `def plain_trimmed(text):\n    return plain_text(text).strip()`, needs: ['text'] },
  split: { code: `def plain_split(text, separator):\n    return plain_text(text).split(plain_text(separator))`, needs: ['text'] },
  part: { code: `def plain_part(text, start, finish):\n    return plain_text(text)[max(0, int(plain_number(start)) - 1):int(plain_number(finish))]`, needs: ['text', 'number'] },
  replace: { code: `def plain_replace(text, find, replacement):\n    return plain_text(text).replace(plain_text(find), plain_text(replacement))`, needs: ['text'] },
  startsWith: { code: `def plain_starts_with(text, prefix):\n    return plain_text(text).startswith(plain_text(prefix))`, needs: ['text'] },
  endsWith: { code: `def plain_ends_with(text, suffix):\n    return plain_text(text).endswith(plain_text(suffix))`, needs: ['text'] },

  round: { code: `def plain_round(value):\n    return math.floor(plain_number(value) + 0.5)`, needs: ['number'], imports: ['math'] },
  roundTo: { code: `def plain_round_to(value, places):\n    scale = 10 ** int(plain_number(places))\n    return math.floor(plain_number(value) * scale + 0.5) / scale`, needs: ['number'], imports: ['math'] },
  floor: { code: `def plain_floor(value):\n    return math.floor(plain_number(value))`, needs: ['number'], imports: ['math'] },
  ceiling: { code: `def plain_ceiling(value):\n    return math.ceil(plain_number(value))`, needs: ['number'], imports: ['math'] },
  absolute: { code: `def plain_absolute(value):\n    return abs(plain_number(value))`, needs: ['number'] },
  squareRoot: { code: `def plain_square_root(value):\n    return math.sqrt(max(0, plain_number(value)))`, needs: ['number'], imports: ['math'] },
  sine: { code: `def plain_sine(value):\n    return math.sin(plain_number(value))`, needs: ['number'], imports: ['math'] },
  cosine: { code: `def plain_cosine(value):\n    return math.cos(plain_number(value))`, needs: ['number'], imports: ['math'] },
  smaller: { code: `def plain_smaller(a, b):\n    return min(plain_number(a), plain_number(b))`, needs: ['number'] },
  bigger: { code: `def plain_bigger(a, b):\n    return max(plain_number(a), plain_number(b))`, needs: ['number'] },
  pi: { code: `def plain_pi():\n    return math.pi`, imports: ['math'] },

  randomBetween: { code: `def plain_random_between(low, high):\n    return random.randint(int(plain_number(low)), int(plain_number(high)))`, needs: ['number'], imports: ['random'] },
  randomNumber: { code: `def plain_random_number():\n    return random.random()`, imports: ['random'] },
  randomItem: { code: `def plain_random_item(collection):\n    all_items = plain_items(collection)\n    return random.choice(all_items) if all_items else None`, needs: ['items'], imports: ['random'] },

  timeNow: { code: `def plain_time_now():\n    return int(time.time() * 1000)`, imports: ['time'] },
  today: { code: `def plain_today():\n    return datetime.date.today().isoformat()`, imports: ['datetime'] },

  kindOf: {
    code: `def plain_kind_of(value):
    if value is None:
        return "nothing"
    if isinstance(value, bool):
        return "a yes/no"
    if isinstance(value, list):
        return "a list"
    if isinstance(value, (int, float)):
        return "a number"
    if isinstance(value, str):
        return "text"
    if callable(value):
        return "an action"
    return "a thing"`
  },

  changedBy: { code: `def plain_changed_by(collection, action):\n    return [action(item) for item in plain_items(collection)]`, needs: ['items'] },
  keptWhere: { code: `def plain_kept_where(collection, action):\n    return [item for item in plain_items(collection) if plain_truthy(action(item))]`, needs: ['items', 'truthy'] },
  addedUpBy: { code: `def plain_added_up_by(collection, action):\n    return sum(plain_number(action(item)) for item in plain_items(collection))`, needs: ['items', 'number'] },

  ask: {
    code: `# Reads one line, the way "ask ... into ..." does in Plain.
def plain_ask(question):
    answer = input(plain_text(question))
    try:
        return int(answer) if answer.strip().lstrip("-").isdigit() else float(answer)
    except ValueError:
        return answer`,
    needs: ['text']
  }
};
