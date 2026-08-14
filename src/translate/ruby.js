// Plain -> Ruby.
//
// Ruby closes its blocks with `end`, the way Plain does, so the shape of a
// translated program is nearly the shape of the one that was written.

import { Emitter } from './emitter.js';

const RESERVED = new Set([
  'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined', 'do',
  'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in', 'module',
  'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return', 'self',
  'super', 'then', 'true', 'undef', 'unless', 'until', 'when', 'while',
  'yield', 'puts', 'print', 'loop', 'proc', 'lambda', 'raise', 'require',
  'method', 'class_eval', 'p', 'format', 'test'
]);

export class RubyEmitter extends Emitter {
  get name() { return 'Ruby'; }
  get extension() { return '.rb'; }
  get indentText() { return '  '; }
  get lineEnd() { return ''; }
  get reserved() { return RESERVED; }
  get selfWord() { return 'self'; }
  get nothingWord() { return 'nil'; }

  comment(text) { return '# ' + text; }
  helperCall(name, args) { return `plain_${snake(name)}(${args.join(', ')})`; }
  declare(name, value) { return `${name} = ${value}`; }
  ifHeader(condition) { return `if ${condition}`; }
  elseIfHeader(condition) { return `elsif ${condition}`; }
  elseHeader() { return 'else'; }
  whileHeader(condition) { return `while ${condition}`; }
  forEachHeader(name, iterable) { return `for ${name} in ${iterable}`; }
  functionHeader(name, params) { return `def ${name}(${params.join(', ')})`; }
  classHeader(name, base) { return `class ${name}${base ? ` < ${base}` : ''}`; }
  methodHeader(name, params) { return `def ${name}(${params.join(', ')})`; }
  tryHeader() { return 'begin'; }
  catchHeader(name) { return `rescue => ${name}`; }
  problemText(name) { return `${name}.message`; }
  closer() { return 'end'; }
  chainPrefix() { return ''; }
  // Ruby says "next" where most languages say "continue".
  continueStatement() { return 'next'; }
  power(left, right) { return `(${this.helper('number', [left])} ** ${this.helper('number', [right])})`; }
  showStatement(value) { return `puts(${value})`; }
  exitProgram() { return 'exit(0)'; }
  raiseProblem(message) { return `raise(${message})`; }
  isKindOf(value, kind) { return `${value}.is_a?(${kind})`; }
  kindNameOf(value) { return `${value}.class.name`; }
  listLiteral(items) { return `[${items.join(', ')}]`; }
  recordLiteral(pairs) {
    if (!pairs.length) return '{}';
    return `{ ${pairs.map(([key, value]) => `${JSON.stringify(key)} => ${value}`).join(', ')} }`;
  }
  newInstance(kind, pairs) { return `${kind}.new(${this.recordLiteral(pairs)})`; }
  methodCall(object, method, args) { return `${object}.${method}(${args.join(', ')})`; }
  callValue(action, args) { return `${action}.call(${args.join(', ')})`; }
  callFunction(name, args) { return `${name}(${args.join(', ')})`; }
  actionReference(name) { return `method(:${name})`; }

  // Ruby fills in #{...} inside double quotes, which a piece of Plain text
  // must never trigger.
  textLiteral(text) {
    return JSON.stringify(String(text)).replace(/#/g, '\\#');
  }

  // A thing may be a Hash or one of your own kinds.
  fieldAccess(object, field) {
    if (object === 'self') return `@${field}`;
    return this.helper('field', [object, JSON.stringify(field)]);
  }

  assignField(object, field, value) {
    if (object === 'self') return `@${field} = ${value}`;
    return this.helper('setField', [object, JSON.stringify(field), value]);
  }

  emitConstructor(node) {
    const inherited = this.inheritedFields(node);
    const own = node.fields.map(field => this.fieldName(field.name));
    const shown = own.filter(name => !inherited.has(name));
    this.write('');
    if (shown.length) this.writeLine(`attr_accessor ${shown.map(name => ':' + name).join(', ')}`);
    this.write('');
    this.open('def initialize(values = {})');
    if (node.base) this.writeLine('super(values)');
    for (const field of node.fields) {
      this.writeLine(`@${this.fieldName(field.name)} = ${field.value ? this.expression(field.value) : 'nil'}`);
    }
    this.open('values.each do |key, value|');
    this.writeLine('plain_set_field(self, key.to_s, value)');
    this.close();
    this.close();
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
  text: {
    code: `# Values written the way Plain writes them.
def plain_text(value, depth = 0)
  return "nothing" if value.nil?
  return (value ? "yes" : "no") if value == true || value == false
  return plain_number_text(value) if value.is_a?(Numeric)
  return depth == 0 ? value : '"' + value + '"' if value.is_a?(String)
  return "[" + value.map { |item| plain_text(item, depth + 1) }.join(", ") + "]" if value.is_a?(Array)
  if value.is_a?(Hash)
    return "{" + value.map { |key, item| key.to_s + ": " + plain_text(item, depth + 1) }.join(", ") + "}"
  end
  return "<action>" if value.is_a?(Proc) || value.is_a?(Method)
  inside = value.instance_variables.map do |name|
    name.to_s.delete("@") + ": " + plain_text(value.instance_variable_get(name), depth + 1)
  end
  "a " + value.class.name + " (" + inside.join(", ") + ")"
end`,
    needs: ['numberText']
  },

  numberText: {
    code: `def plain_number_text(value)
  return value.to_s if value.is_a?(Integer)
  return value.to_i.to_s if value == value.to_i
  ("%.12g" % value)
end`
  },

  number: {
    code: `def plain_number(value)
  return 0 if value.nil?
  return (value ? 1 : 0) if value == true || value == false
  return value if value.is_a?(Numeric)
  begin
    text = value.to_s
    return text.include?(".") ? Float(text) : Integer(text)
  rescue ArgumentError, TypeError
    return 0
  end
end`
  },

  truthy: {
    code: `def plain_truthy(value)
  return false if value.nil? || value == false
  return false if value == 0 || value == ""
  return value.length > 0 if value.is_a?(Array)
  true
end`
  },

  same: {
    code: `def plain_same(a, b)
  return a.nil? && b.nil? if a.nil? || b.nil?
  return plain_truthy(a) == plain_truthy(b) if a == true || a == false || b == true || b == false
  return plain_number(a) == plain_number(b) if a.is_a?(Numeric) || b.is_a?(Numeric)
  a == b
end`,
    needs: ['number', 'truthy']
  },

  add: {
    code: `def plain_add(a, b)
  return plain_text(a) + plain_text(b) if a.is_a?(String) || b.is_a?(String)
  plain_number(a) + plain_number(b)
end`,
    needs: ['text', 'number']
  },

  join2: { code: `def plain_join2(a, b)\n  plain_text(a) + plain_text(b)\nend`, needs: ['text'] },

  divide: {
    code: `def plain_divide(a, b)
  raise "I cannot divide by zero" if plain_number(b) == 0
  plain_number(a).to_f / plain_number(b)
end`,
    needs: ['number']
  },

  remainder: {
    code: `def plain_remainder(a, b)
  raise "I cannot divide by zero" if plain_number(b) == 0
  plain_number(a) % plain_number(b)
end`,
    needs: ['number']
  },

  items: {
    code: `def plain_items(value)
  return value if value.is_a?(Array)
  return value.chars if value.is_a?(String)
  return value.keys.map(&:to_s) if value.is_a?(Hash)
  []
end`
  },

  range: {
    code: `# Plain counts up or down depending on the two numbers.
def plain_range(from, to, step)
  move = plain_number(step).abs
  move = 1 if move == 0
  move = -move if plain_number(to) < plain_number(from)
  out = []
  at = plain_number(from)
  while move > 0 ? at <= plain_number(to) : at >= plain_number(to)
    out << at
    at += move
  end
  out
end`,
    needs: ['number']
  },

  item: {
    code: `# Lists count from 1 in Plain.
def plain_item(collection, index)
  at = plain_number(index).to_i
  return nil unless collection.is_a?(Array) || collection.is_a?(String)
  place = at < 0 ? collection.length + at : at - 1
  return nil if place < 0 || place >= collection.length
  collection.is_a?(String) ? collection[place] : collection[place]
end`,
    needs: ['number']
  },

  setItem: {
    code: `def plain_set_item(collection, index, value)
  at = plain_number(index).to_i
  place = at < 0 ? collection.length + at : at - 1
  collection[place] = value if collection.is_a?(Array) && place >= 0 && place < collection.length
  collection
end`,
    needs: ['number']
  },

  first: { code: `def plain_first(collection)\n  plain_item(collection, 1)\nend`, needs: ['item'] },
  last: { code: `def plain_last(collection)\n  plain_item(collection, plain_length(collection))\nend`, needs: ['item', 'length'] },

  length: {
    code: `def plain_length(value)
  return value.length if value.is_a?(Array) || value.is_a?(String) || value.is_a?(Hash)
  0
end`
  },

  total: { code: `def plain_total(collection)\n  plain_items(collection).sum { |item| plain_number(item) }\nend`, needs: ['items', 'number'] },
  average: { code: `def plain_average(collection)\n  all = plain_items(collection)\n  all.empty? ? 0 : plain_total(all).to_f / all.length\nend`, needs: ['items', 'total'] },
  highest: { code: `def plain_highest(collection)\n  plain_items(collection).max_by { |item| plain_number(item) }\nend`, needs: ['items', 'number'] },
  lowest: { code: `def plain_lowest(collection)\n  plain_items(collection).min_by { |item| plain_number(item) }\nend`, needs: ['items', 'number'] },

  sorted: {
    code: `def plain_sorted(collection)
  all = plain_items(collection)
  return all.sort_by { |item| plain_number(item) } if all.all? { |item| item.is_a?(Numeric) }
  all.sort_by { |item| plain_text(item) }
end`,
    needs: ['items', 'number', 'text']
  },

  reversed: { code: `def plain_reversed(collection)\n  plain_items(collection).reverse\nend`, needs: ['items'] },
  copy: { code: `def plain_copy(value)\n  value.is_a?(Array) || value.is_a?(Hash) ? value.dup : value\nend` },
  joinWith: { code: `def plain_join_with(collection, separator)\n  plain_items(collection).map { |item| plain_text(item) }.join(plain_text(separator))\nend`, needs: ['items', 'text'] },
  position: {
    code: `def plain_position(collection, value)
  return (collection.index(plain_text(value)) || -1) + 1 if collection.is_a?(String)
  plain_items(collection).each_with_index { |item, at| return at + 1 if plain_same(item, value) }
  0
end`,
    needs: ['items', 'same', 'text']
  },

  has: {
    code: `def plain_has(container, value)
  return container.include?(plain_text(value)) if container.is_a?(String)
  plain_items(container).any? { |item| plain_same(item, value) }
end`,
    needs: ['items', 'same', 'text']
  },

  addTo: {
    code: `# "add x to name" grows a list, adds to a number, or joins text.
def plain_add_to(current, value)
  if current.is_a?(Array)
    current << value
    return current
  end
  return current + plain_text(value) if current.is_a?(String)
  plain_number(current) + plain_number(value)
end`,
    needs: ['text', 'number']
  },

  removeValue: {
    code: `def plain_remove_value(collection, value)
  return collection unless collection.is_a?(Array)
  at = collection.index { |item| plain_same(item, value) }
  collection.delete_at(at) unless at.nil?
  collection
end`,
    needs: ['same']
  },

  removeAt: {
    code: `def plain_remove_at(collection, index)
  at = plain_number(index).to_i
  collection.delete_at(at - 1) if collection.is_a?(Array) && at >= 1 && at <= collection.length
  collection
end`,
    needs: ['number']
  },

  emptied: { code: `def plain_emptied(value)\n  return value.clear if value.is_a?(Array)\n  nil\nend` },

  field: {
    code: `# "name of thing" - a key in a Hash, or a value on one of your kinds.
def plain_field(thing, name)
  return nil if thing.nil?
  if thing.is_a?(Hash)
    found = thing.keys.find { |key| key.to_s.downcase == name.downcase }
    return found.nil? ? nil : thing[found]
  end
  if thing.is_a?(Array) || thing.is_a?(String)
    return thing.length if ["length", "size", "count"].include?(name.downcase)
  end
  found = thing.instance_variables.find { |one| one.to_s.delete("@").downcase == name.downcase }
  found.nil? ? nil : thing.instance_variable_get(found)
end`
  },

  setField: {
    code: `def plain_set_field(thing, name, value)
  if thing.is_a?(Hash)
    found = thing.keys.find { |key| key.to_s.downcase == name.downcase }
    thing[found.nil? ? name : found] = value
    return
  end
  found = thing.instance_variables.find { |one| one.to_s.delete("@").downcase == name.downcase }
  thing.instance_variable_set(found.nil? ? "@" + name : found, value)
end`
  },

  keys: {
    code: `def plain_keys(thing)
  return thing.keys.map(&:to_s) if thing.is_a?(Hash)
  return thing.instance_variables.map { |one| one.to_s.delete("@") } if thing.respond_to?(:instance_variables)
  []
end`
  },
  values: { code: `def plain_values(thing)\n  plain_keys(thing).map { |key| plain_field(thing, key) }\nend`, needs: ['keys', 'field'] },
  value: { code: `def plain_value(thing, key)\n  plain_field(thing, plain_text(key))\nend`, needs: ['field', 'text'] },
  setValue: { code: `def plain_set_value(thing, key, value)\n  plain_set_field(thing, plain_text(key), value)\nend`, needs: ['setField', 'text'] },
  hasKey: { code: `def plain_has_key(thing, key)\n  plain_keys(thing).any? { |name| name.downcase == plain_text(key).downcase }\nend`, needs: ['keys', 'text'] },

  upper: { code: `def plain_upper(text)\n  plain_text(text).upcase\nend`, needs: ['text'] },
  lower: { code: `def plain_lower(text)\n  plain_text(text).downcase\nend`, needs: ['text'] },
  trimmed: { code: `def plain_trimmed(text)\n  plain_text(text).strip\nend`, needs: ['text'] },
  split: { code: `def plain_split(text, separator)\n  plain_text(text).split(plain_text(separator), -1)\nend`, needs: ['text'] },
  part: { code: `def plain_part(text, start, finish)\n  from = [0, plain_number(start).to_i - 1].max\n  to = plain_number(finish).to_i\n  from >= to ? "" : plain_text(text)[from...to].to_s\nend`, needs: ['text', 'number'] },
  replace: { code: `def plain_replace(text, find, instead)\n  plain_text(text).gsub(plain_text(find), plain_text(instead))\nend`, needs: ['text'] },
  startsWith: { code: `def plain_starts_with(text, prefix)\n  plain_text(text).start_with?(plain_text(prefix))\nend`, needs: ['text'] },
  endsWith: { code: `def plain_ends_with(text, suffix)\n  plain_text(text).end_with?(plain_text(suffix))\nend`, needs: ['text'] },

  matches: { code: `def plain_matches(text, mark)\n  !Regexp.new(plain_text(mark)).match(plain_text(text)).nil?\nend`, needs: ['text'] },
  firstMatch: { code: `def plain_first_match(text, mark)\n  found = Regexp.new(plain_text(mark)).match(plain_text(text))\n  found.nil? ? "" : found[0]\nend`, needs: ['text'] },
  allMatches: { code: `def plain_all_matches(text, mark)\n  plain_text(text).scan(Regexp.new(plain_text(mark))).map { |one| one.is_a?(Array) ? one[0] : one }\nend`, needs: ['text'] },
  replacePattern: { code: `def plain_replace_pattern(text, mark, instead)\n  plain_text(text).gsub(Regexp.new(plain_text(mark)), plain_text(instead))\nend`, needs: ['text'] },

  whole: { code: `def plain_whole(value)\n  plain_number(value).to_i\nend`, needs: ['number'] },

  round: { code: `def plain_round(value)\n  (plain_number(value) + 0.5).floor\nend`, needs: ['number'] },
  roundTo: { code: `def plain_round_to(value, places)\n  scale = 10 ** plain_number(places).to_i\n  (plain_number(value) * scale + 0.5).floor.to_f / scale\nend`, needs: ['number'] },
  floor: { code: `def plain_floor(value)\n  plain_number(value).floor\nend`, needs: ['number'] },
  ceiling: { code: `def plain_ceiling(value)\n  plain_number(value).ceil\nend`, needs: ['number'] },
  absolute: { code: `def plain_absolute(value)\n  plain_number(value).abs\nend`, needs: ['number'] },
  squareRoot: { code: `def plain_square_root(value)\n  Math.sqrt([0, plain_number(value)].max)\nend`, needs: ['number'] },
  sine: { code: `def plain_sine(value)\n  Math.sin(plain_number(value))\nend`, needs: ['number'] },
  cosine: { code: `def plain_cosine(value)\n  Math.cos(plain_number(value))\nend`, needs: ['number'] },
  tangent: { code: `def plain_tangent(value)\n  Math.tan(plain_number(value))\nend`, needs: ['number'] },
  exponent: { code: `def plain_exponent(value)\n  Math.exp(plain_number(value))\nend`, needs: ['number'] },
  logarithm: { code: `def plain_logarithm(value)\n  Math.log([1e-300, plain_number(value)].max)\nend`, needs: ['number'] },
  smaller: { code: `def plain_smaller(a, b)\n  [plain_number(a), plain_number(b)].min\nend`, needs: ['number'] },
  bigger: { code: `def plain_bigger(a, b)\n  [plain_number(a), plain_number(b)].max\nend`, needs: ['number'] },
  pi: { code: `def plain_pi\n  Math::PI\nend` },
  e: { code: `def plain_e\n  Math::E\nend` },

  randomBetween: { code: `def plain_random_between(low, high)\n  rand(plain_number(low).ceil..plain_number(high).floor)\nend`, needs: ['number'] },
  randomNumber: { code: `def plain_random_number\n  rand\nend` },
  randomItem: { code: `def plain_random_item(collection)\n  all = plain_items(collection)\n  all.empty? ? nil : all.sample\nend`, needs: ['items'] },

  timeNow: { code: `def plain_time_now\n  (Time.now.to_f * 1000).to_i\nend` },
  today: { code: `def plain_today\n  Time.now.strftime("%Y-%m-%d")\nend` },

  kindOf: {
    code: `def plain_kind_of(value)
  return "nothing" if value.nil?
  return "a yes/no" if value == true || value == false
  return "a list" if value.is_a?(Array)
  return "a number" if value.is_a?(Numeric)
  return "text" if value.is_a?(String)
  return "an action" if value.is_a?(Proc) || value.is_a?(Method)
  "a thing"
end`
  },

  changedBy: { code: `def plain_changed_by(collection, action)\n  plain_items(collection).map { |item| action.call(item) }\nend`, needs: ['items'] },
  keptWhere: { code: `def plain_kept_where(collection, action)\n  plain_items(collection).select { |item| plain_truthy(action.call(item)) }\nend`, needs: ['items', 'truthy'] },
  addedUpBy: { code: `def plain_added_up_by(collection, action)\n  plain_items(collection).sum { |item| plain_number(action.call(item)) }\nend`, needs: ['items', 'number'] },

  ask: {
    code: `# Reads one line, the way "ask ... into ..." does in Plain.
def plain_ask(question)
  print plain_text(question)
  answer = STDIN.gets
  answer = answer.nil? ? "" : answer.chomp
  begin
    return answer.include?(".") ? Float(answer) : Integer(answer)
  rescue ArgumentError
    return answer
  end
end`,
    needs: ['text']
  }
};
