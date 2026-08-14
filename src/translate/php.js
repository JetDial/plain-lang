// Plain -> PHP.
//
// PHP writes a $ in front of every name and keeps its arrays in the order
// things went in, which is what Plain means by a list and by a thing.

import { Emitter } from './emitter.js';

const RESERVED = new Set([
  'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch',
  'class', 'clone', 'const', 'continue', 'declare', 'default', 'do', 'echo',
  'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach', 'endif',
  'endswitch', 'endwhile', 'enum', 'extends', 'final', 'finally', 'fn', 'for',
  'foreach', 'function', 'global', 'goto', 'if', 'implements', 'include',
  'instanceof', 'insteadof', 'interface', 'isset', 'list', 'match', 'namespace',
  'new', 'or', 'print', 'private', 'protected', 'public', 'readonly', 'require',
  'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use', 'var',
  'while', 'xor', 'yield', 'true', 'false', 'null', 'plain'
]);

export class PhpEmitter extends Emitter {
  get name() { return 'PHP'; }
  get extension() { return '.php'; }
  get indentText() { return '    '; }
  get reserved() { return RESERVED; }
  get selfWord() { return '$this'; }
  get nothingWord() { return 'null'; }

  comment(text) { return '// ' + text; }
  helperCall(name, args) { return `plain_${snake(name)}(${args.join(', ')})`; }

  // Every name in PHP wears a $.
  variable(plainName) { return '$' + super.variable(plainName); }
  loopName(plainName) { return super.loopName(String(plainName).replace(/^\$/, '')); }
  bindLoop(plainName, actual) { super.bindLoop(String(plainName).replace(/^\$/, ''), actual.replace(/^\$/, '')); }
  known(name) { return super.known(String(name).replace(/^\$/, '')); }
  remember(name) { super.remember(String(name).replace(/^\$/, '')); }

  declare(name, value) { return `${name} = ${value}`; }
  forEachHeader(name, iterable) { return `foreach (${iterable} as $${name}) {`; }
  countHeader(name, from, to, step) {
    return this.forEachHeader(name, this.helper('range', [from, to, step]));
  }
  functionHeader(name, params) {
    return `function ${name}(${params.map(p => `$${p}`).join(', ')}) {`;
  }
  methodHeader(name, params) {
    return `public function ${name}(${params.map(p => `$${p}`).join(', ')}) {`;
  }
  classHeader(name, base) { return `class ${name}${base ? ` extends ${base}` : ''} {`; }
  catchHeader(name) { return `catch (Throwable $${name}) {`; }
  problemText(name) { return `$${name}->getMessage()`; }
  showStatement(value) { return `echo ${value}, PHP_EOL`; }
  exitProgram() { return 'exit(0)'; }
  raiseProblem(message) { return `throw new Exception(${message})`; }
  power(left, right) { return `(${this.helper('number', [left])} ** ${this.helper('number', [right])})`; }
  isKindOf(value, kind) { return `(${value} instanceof ${kind})`; }
  kindNameOf(value) { return `get_class(${value})`; }
  listLiteral(items) { return `[${items.join(', ')}]`; }
  recordLiteral(pairs) {
    if (!pairs.length) return '[]';
    return `[${pairs.map(([key, value]) => `${JSON.stringify(key)} => ${value}`).join(', ')}]`;
  }
  newInstance(kind, pairs) { return `new ${kind}(${this.recordLiteral(pairs)})`; }
  methodCall(object, method, args) { return `${object}->${method}(${args.join(', ')})`; }
  callValue(action, args) { return `${action}(${args.join(', ')})`; }
  callFunction(name, args) { return `${name}(${args.join(', ')})`; }
  actionReference(name) { return `'${name}'`; }

  // PHP fills in $names inside double quotes, so text is written with
  // single quotes and only those escaped.
  textLiteral(text) {
    return "'" + String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  fieldAccess(object, field) {
    if (object === '$this') return `$this->${field}`;
    return this.helper('field', [object, JSON.stringify(field)]);
  }

  assignField(object, field, value) {
    if (object === '$this') return `$this->${field} = ${value}`;
    return this.helper('setField', [object, JSON.stringify(field), value]);
  }

  // A list handed to a function is copied in PHP, so anything that changes
  // one has to hand it back and be assigned.
  emitConstructor(node) {
    const inherited = this.inheritedFields(node);
    this.write('');
    for (const field of node.fields) {
      const name = this.fieldName(field.name);
      if (!inherited.has(name)) this.writeLine(`public $${name}`);
    }
    this.write('');
    this.open('public function __construct($values = []) {');
    if (node.base) this.writeLine('parent::__construct($values)');
    for (const field of node.fields) {
      this.writeLine(`$this->${this.fieldName(field.name)} = ${field.value ? this.expression(field.value) : 'null'}`);
    }
    this.open('foreach ($values as $key => $value) {');
    this.writeLine(this.helper('setField', ['$this', '$key', '$value']));
    this.close();
    this.close();
  }

  preamble() { return []; }

  // Anything before <?php is printed as it stands, so the opening tag has
  // to come first, above even the comments saying where this came from.
  translate(program, meta = {}) {
    const written = Emitter.prototype.translate.call(this, program, meta);
    return '<?php\n\n' + written;
  }

  helperSource() { return HELPERS; }

  emitHelpers() {
    const wanted = new Set();
    const add = (name) => {
      if (wanted.has(name) || !HELPERS[name]) return;
      wanted.add(name);
      for (const needed of HELPERS[name].needs || []) add(needed);
    };
    for (const name of this.used) add(name);
    if (!wanted.size) return '';
    return Object.keys(HELPERS).filter(name => wanted.has(name)).map(name => HELPERS[name].code.trimEnd()).join('\n\n');
  }
}

function snake(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

const HELPERS = {
  // Not every PHP has mbstring switched on, and a translated program should
  // run on the one you have.
  mbshim: {
    code: `if (!function_exists('mb_strtoupper')) {
    function mb_strtoupper($text) { return strtoupper($text); }
    function mb_strtolower($text) { return strtolower($text); }
    function mb_strlen($text) { return strlen($text); }
    function mb_substr($text, $from, $length = null) {
        return $length === null ? substr($text, $from) : substr($text, $from, $length);
    }
    function mb_strpos($text, $find) { return strpos($text, $find); }
}`
  },

  text: {
    code: `// Values written the way Plain writes them.
function plain_text($value, $depth = 0) {
    if ($value === null) return 'nothing';
    if (is_bool($value)) return $value ? 'yes' : 'no';
    if (is_int($value) || is_float($value)) return plain_number_text($value);
    if (is_string($value)) return $depth === 0 ? $value : '"' . $value . '"';
    if (is_array($value)) {
        if (array_is_list($value)) {
            $parts = [];
            foreach ($value as $item) $parts[] = plain_text($item, $depth + 1);
            return '[' . implode(', ', $parts) . ']';
        }
        $parts = [];
        foreach ($value as $key => $item) $parts[] = $key . ': ' . plain_text($item, $depth + 1);
        return '{' . implode(', ', $parts) . '}';
    }
    if (is_callable($value)) return '<action>';
    $parts = [];
    foreach (get_object_vars($value) as $key => $item) $parts[] = $key . ': ' . plain_text($item, $depth + 1);
    return 'a ' . get_class($value) . ' (' . implode(', ', $parts) . ')';
}`,
    needs: ['numberText']
  },

  numberText: {
    code: `function plain_number_text($value) {
    if (is_int($value) || $value == floor($value)) {
        if (is_finite($value)) return (string) (int) $value;
    }
    return rtrim(rtrim(sprintf('%.12G', $value), '0'), '.');
}`
  },

  number: {
    code: `function plain_number($value) {
    if (is_int($value) || is_float($value)) return $value;
    if (is_bool($value)) return $value ? 1 : 0;
    if ($value === null) return 0;
    if (is_string($value) && is_numeric($value)) return $value + 0;
    return 0;
}`
  },

  truthy: {
    code: `function plain_truthy($value) {
    if ($value === null || $value === false) return false;
    if ($value === 0 || $value === 0.0 || $value === '') return false;
    if (is_array($value)) return count($value) > 0;
    return true;
}`
  },

  same: {
    code: `function plain_same($a, $b) {
    if ($a === null || $b === null) return $a === null && $b === null;
    if (is_bool($a) || is_bool($b)) return plain_truthy($a) === plain_truthy($b);
    if (is_int($a) || is_float($a) || is_int($b) || is_float($b)) return plain_number($a) == plain_number($b);
    return $a === $b;
}`,
    needs: ['number', 'truthy']
  },

  add: {
    code: `function plain_add($a, $b) {
    if (is_string($a) || is_string($b)) return plain_text($a) . plain_text($b);
    return plain_number($a) + plain_number($b);
}`,
    needs: ['text', 'number']
  },

  join2: { code: `function plain_join2($a, $b) {\n    return plain_text($a) . plain_text($b);\n}`, needs: ['text'] },

  divide: {
    code: `function plain_divide($a, $b) {
    if (plain_number($b) == 0) throw new Exception('I cannot divide by zero');
    return plain_number($a) / plain_number($b);
}`,
    needs: ['number']
  },

  remainder: {
    code: `function plain_remainder($a, $b) {
    if (plain_number($b) == 0) throw new Exception('I cannot divide by zero');
    return fmod(plain_number($a), plain_number($b));
}`,
    needs: ['number']
  },

  items: {
    code: `function plain_items($value) {
    if (is_array($value)) return array_is_list($value) ? $value : array_map('strval', array_keys($value));
    if (is_string($value)) return $value === '' ? [] : preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
    if (is_object($value)) return array_map('strval', array_keys(get_object_vars($value)));
    return [];
}`
  },

  range: {
    code: `// Plain counts up or down depending on the two numbers.
function plain_range($from, $to, $step) {
    $move = abs(plain_number($step));
    if ($move == 0) $move = 1;
    if (plain_number($to) < plain_number($from)) $move = -$move;
    $out = [];
    for ($at = plain_number($from); $move > 0 ? $at <= plain_number($to) : $at >= plain_number($to); $at += $move) {
        $out[] = $at;
    }
    return $out;
}`,
    needs: ['number']
  },

  item: {
    code: `// Lists count from 1 in Plain.
function plain_item($collection, $index) {
    $at = (int) plain_number($index);
    if (is_string($collection)) {
        $letters = preg_split('//u', $collection, -1, PREG_SPLIT_NO_EMPTY);
        $place = $at < 0 ? count($letters) + $at : $at - 1;
        return $place >= 0 && $place < count($letters) ? $letters[$place] : null;
    }
    if (!is_array($collection)) return null;
    $place = $at < 0 ? count($collection) + $at : $at - 1;
    return array_key_exists($place, $collection) ? $collection[$place] : null;
}`,
    needs: ['number', 'mbshim']
  },

  setItem: {
    code: `function plain_set_item(&$collection, $index, $value) {
    $at = (int) plain_number($index);
    $place = $at < 0 ? count($collection) + $at : $at - 1;
    if (is_array($collection) && $place >= 0 && $place < count($collection)) $collection[$place] = $value;
    return $collection;
}`,
    needs: ['number']
  },

  first: { code: `function plain_first($collection) {\n    return plain_item($collection, 1);\n}`, needs: ['item'] },
  last: { code: `function plain_last($collection) {\n    return plain_item($collection, plain_length($collection));\n}`, needs: ['item', 'length'] },

  length: {
    needs: ['mbshim', 'mbshim'],
    code: `function plain_length($value) {
    if (is_array($value)) return count($value);
    if (is_string($value)) return mb_strlen($value);
    if (is_object($value)) return count(get_object_vars($value));
    return 0;
}`
  },

  total: { code: `function plain_total($collection) {\n    $sum = 0;\n    foreach (plain_items($collection) as $item) $sum += plain_number($item);\n    return $sum;\n}`, needs: ['items', 'number'] },
  average: { code: `function plain_average($collection) {\n    $all = plain_items($collection);\n    return count($all) ? plain_total($all) / count($all) : 0;\n}`, needs: ['items', 'total'] },
  highest: { code: `function plain_highest($collection) {\n    $best = null;\n    foreach (plain_items($collection) as $item) {\n        if ($best === null || plain_number($item) > plain_number($best)) $best = $item;\n    }\n    return $best;\n}`, needs: ['items', 'number'] },
  lowest: { code: `function plain_lowest($collection) {\n    $best = null;\n    foreach (plain_items($collection) as $item) {\n        if ($best === null || plain_number($item) < plain_number($best)) $best = $item;\n    }\n    return $best;\n}`, needs: ['items', 'number'] },

  sorted: {
    code: `function plain_sorted($collection) {
    $all = plain_items($collection);
    $numbers = true;
    foreach ($all as $item) if (!is_int($item) && !is_float($item)) $numbers = false;
    usort($all, function ($a, $b) use ($numbers) {
        if ($numbers) return plain_number($a) <=> plain_number($b);
        return strcmp(plain_text($a), plain_text($b));
    });
    return $all;
}`,
    needs: ['items', 'number', 'text']
  },

  reversed: { code: `function plain_reversed($collection) {\n    return array_reverse(plain_items($collection));\n}`, needs: ['items'] },
  copy: { code: `function plain_copy($value) {\n    return is_array($value) ? $value : $value;\n}` },
  joinWith: { code: `function plain_join_with($collection, $separator) {\n    $parts = [];\n    foreach (plain_items($collection) as $item) $parts[] = plain_text($item);\n    return implode(plain_text($separator), $parts);\n}`, needs: ['items', 'text'] },
  position: {
    code: `function plain_position($collection, $value) {
    if (is_string($collection)) {
        $at = mb_strpos($collection, plain_text($value));
        return $at === false ? 0 : $at + 1;
    }
    foreach (plain_items($collection) as $at => $item) if (plain_same($item, $value)) return $at + 1;
    return 0;
}`,
    needs: ['items', 'same', 'text', 'mbshim']
  },

  has: {
    code: `function plain_has($container, $value) {
    if (is_string($container)) return mb_strpos($container, plain_text($value)) !== false;
    foreach (plain_items($container) as $item) if (plain_same($item, $value)) return true;
    return false;
}`,
    needs: ['items', 'same', 'text', 'mbshim']
  },

  addTo: {
    code: `// "add x to name" grows a list, adds to a number, or joins text.
function plain_add_to($current, $value) {
    if (is_array($current)) {
        $current[] = $value;
        return $current;
    }
    if (is_string($current)) return $current . plain_text($value);
    return plain_number($current) + plain_number($value);
}`,
    needs: ['text', 'number']
  },

  removeValue: {
    code: `function plain_remove_value($collection, $value) {
    if (!is_array($collection)) return $collection;
    foreach ($collection as $at => $item) {
        if (plain_same($item, $value)) {
            array_splice($collection, $at, 1);
            return $collection;
        }
    }
    return $collection;
}`,
    needs: ['same']
  },

  removeAt: {
    code: `function plain_remove_at($collection, $index) {
    $at = (int) plain_number($index);
    if (is_array($collection) && $at >= 1 && $at <= count($collection)) array_splice($collection, $at - 1, 1);
    return $collection;
}`,
    needs: ['number']
  },

  emptied: { code: `function plain_emptied($value) {\n    return is_array($value) ? [] : null;\n}` },

  field: {
    code: `// "name of thing" - a key in an array, or a value on one of your kinds.
function plain_field($thing, $name) {
    if ($thing === null) return null;
    if (is_array($thing)) {
        if (array_is_list($thing)) {
            $lowered = strtolower($name);
            if ($lowered === 'length' || $lowered === 'size' || $lowered === 'count') return count($thing);
            return null;
        }
        foreach ($thing as $key => $value) if (strcasecmp((string) $key, $name) === 0) return $value;
        return null;
    }
    if (is_string($thing)) {
        $lowered = strtolower($name);
        if ($lowered === 'length' || $lowered === 'size' || $lowered === 'count') return mb_strlen($thing);
        return null;
    }
    foreach (get_object_vars($thing) as $key => $value) if (strcasecmp((string) $key, $name) === 0) return $value;
    return null;
}`, needs: ['mbshim']
  },

  setField: {
    code: `function plain_set_field(&$thing, $name, $value) {
    if (is_array($thing)) {
        foreach ($thing as $key => $held) {
            if (strcasecmp((string) $key, $name) === 0) {
                $thing[$key] = $value;
                return $thing;
            }
        }
        $thing[$name] = $value;
        return $thing;
    }
    foreach (get_object_vars($thing) as $key => $held) {
        if (strcasecmp((string) $key, $name) === 0) {
            $thing->$key = $value;
            return $thing;
        }
    }
    $thing->$name = $value;
    return $thing;
}`
  },

  keys: { code: `function plain_keys($thing) {\n    if (is_array($thing)) return array_map('strval', array_keys($thing));\n    if (is_object($thing)) return array_map('strval', array_keys(get_object_vars($thing)));\n    return [];\n}` },
  values: { code: `function plain_values($thing) {\n    if (is_array($thing)) return array_values($thing);\n    if (is_object($thing)) return array_values(get_object_vars($thing));\n    return [];\n}` },
  value: { code: `function plain_value($thing, $key) {\n    return plain_field($thing, plain_text($key));\n}`, needs: ['field', 'text'] },
  setValue: { code: `function plain_set_value(&$thing, $key, $value) {\n    return plain_set_field($thing, plain_text($key), $value);\n}`, needs: ['setField', 'text'] },
  hasKey: { code: `function plain_has_key($thing, $key) {\n    foreach (plain_keys($thing) as $name) if (strcasecmp($name, plain_text($key)) === 0) return true;\n    return false;\n}`, needs: ['keys', 'text'] },

  upper: { code: `function plain_upper($text) {\n    return mb_strtoupper(plain_text($text));\n}`, needs: ['text', 'mbshim'] },
  lower: { code: `function plain_lower($text) {\n    return mb_strtolower(plain_text($text));\n}`, needs: ['text', 'mbshim'] },
  trimmed: { code: `function plain_trimmed($text) {\n    return trim(plain_text($text));\n}`, needs: ['text', 'mbshim'] },
  split: { code: `function plain_split($text, $separator) {\n    return explode(plain_text($separator), plain_text($text));\n}`, needs: ['text'] },
  part: { code: `function plain_part($text, $start, $finish) {\n    $from = max(0, (int) plain_number($start) - 1);\n    $to = (int) plain_number($finish);\n    return $from >= $to ? '' : mb_substr(plain_text($text), $from, $to - $from);\n}`, needs: ['text', 'number', 'mbshim'] },
  replace: { code: `function plain_replace($text, $find, $instead) {\n    return str_replace(plain_text($find), plain_text($instead), plain_text($text));\n}`, needs: ['text'] },
  startsWith: { code: `function plain_starts_with($text, $prefix) {\n    return str_starts_with(plain_text($text), plain_text($prefix));\n}`, needs: ['text'] },
  endsWith: { code: `function plain_ends_with($text, $suffix) {\n    return str_ends_with(plain_text($text), plain_text($suffix));\n}`, needs: ['text'] },

  pattern: { code: `function plain_pattern($mark) {\n    return '/' . str_replace('/', '\\\\/', plain_text($mark)) . '/u';\n}`, needs: ['text'] },
  matches: { code: `function plain_matches($text, $mark) {\n    return preg_match(plain_pattern($mark), plain_text($text)) === 1;\n}`, needs: ['pattern', 'text'] },
  firstMatch: { code: `function plain_first_match($text, $mark) {\n    return preg_match(plain_pattern($mark), plain_text($text), $found) ? $found[0] : '';\n}`, needs: ['pattern', 'text'] },
  allMatches: { code: `function plain_all_matches($text, $mark) {\n    preg_match_all(plain_pattern($mark), plain_text($text), $found);\n    return $found[0];\n}`, needs: ['pattern', 'text'] },
  replacePattern: { code: `function plain_replace_pattern($text, $mark, $instead) {\n    return preg_replace(plain_pattern($mark), plain_text($instead), plain_text($text));\n}`, needs: ['pattern', 'text'] },

  whole: { code: `function plain_whole($value) {\n    return (int) plain_number($value);\n}`, needs: ['number'] },

  round: { code: `function plain_round($value) {\n    return floor(plain_number($value) + 0.5);\n}`, needs: ['number'] },
  roundTo: { code: `function plain_round_to($value, $places) {\n    $scale = pow(10, floor(plain_number($places)));\n    return floor(plain_number($value) * $scale + 0.5) / $scale;\n}`, needs: ['number'] },
  floor: { code: `function plain_floor($value) {\n    return floor(plain_number($value));\n}`, needs: ['number'] },
  ceiling: { code: `function plain_ceiling($value) {\n    return ceil(plain_number($value));\n}`, needs: ['number'] },
  absolute: { code: `function plain_absolute($value) {\n    return abs(plain_number($value));\n}`, needs: ['number'] },
  squareRoot: { code: `function plain_square_root($value) {\n    return sqrt(max(0, plain_number($value)));\n}`, needs: ['number'] },
  sine: { code: `function plain_sine($value) {\n    return sin(plain_number($value));\n}`, needs: ['number'] },
  cosine: { code: `function plain_cosine($value) {\n    return cos(plain_number($value));\n}`, needs: ['number'] },
  tangent: { code: `function plain_tangent($value) {\n    return tan(plain_number($value));\n}`, needs: ['number'] },
  exponent: { code: `function plain_exponent($value) {\n    return exp(plain_number($value));\n}`, needs: ['number'] },
  logarithm: { code: `function plain_logarithm($value) {\n    return log(max(1e-300, plain_number($value)));\n}`, needs: ['number'] },
  smaller: { code: `function plain_smaller($a, $b) {\n    return min(plain_number($a), plain_number($b));\n}`, needs: ['number'] },
  bigger: { code: `function plain_bigger($a, $b) {\n    return max(plain_number($a), plain_number($b));\n}`, needs: ['number'] },
  pi: { code: `function plain_pi() {\n    return M_PI;\n}` },
  e: { code: `function plain_e() {\n    return M_E;\n}` },

  randomBetween: { code: `function plain_random_between($low, $high) {\n    return random_int((int) ceil(plain_number($low)), (int) floor(plain_number($high)));\n}`, needs: ['number'] },
  randomNumber: { code: `function plain_random_number() {\n    return mt_rand() / mt_getrandmax();\n}` },
  randomItem: { code: `function plain_random_item($collection) {\n    $all = plain_items($collection);\n    return count($all) ? $all[array_rand($all)] : null;\n}`, needs: ['items'] },

  timeNow: { code: `function plain_time_now() {\n    return (int) (microtime(true) * 1000);\n}` },
  today: { code: `function plain_today() {\n    return date('Y-m-d');\n}` },

  kindOf: {
    code: `function plain_kind_of($value) {
    if ($value === null) return 'nothing';
    if (is_bool($value)) return 'a yes/no';
    if (is_array($value)) return 'a list';
    if (is_int($value) || is_float($value)) return 'a number';
    if (is_string($value)) return 'text';
    if (is_callable($value)) return 'an action';
    return 'a thing';
}`
  },

  changedBy: { code: `function plain_changed_by($collection, $action) {\n    $out = [];\n    foreach (plain_items($collection) as $item) $out[] = $action($item);\n    return $out;\n}`, needs: ['items'] },
  keptWhere: { code: `function plain_kept_where($collection, $action) {\n    $out = [];\n    foreach (plain_items($collection) as $item) if (plain_truthy($action($item))) $out[] = $item;\n    return $out;\n}`, needs: ['items', 'truthy'] },
  addedUpBy: { code: `function plain_added_up_by($collection, $action) {\n    $sum = 0;\n    foreach (plain_items($collection) as $item) $sum += plain_number($action($item));\n    return $sum;\n}`, needs: ['items', 'number'] },

  ask: {
    code: `// Reads one line, the way "ask ... into ..." does in Plain.
function plain_ask($question) {
    echo plain_text($question);
    $answer = fgets(STDIN);
    if ($answer === false) return '';
    $answer = rtrim($answer, "\\r\\n");
    return is_numeric($answer) ? $answer + 0 : $answer;
}`,
    needs: ['text']
  }
};
