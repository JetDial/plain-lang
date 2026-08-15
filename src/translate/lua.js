// Plain -> Lua.
//
// Lua already counts tables from 1, which is one thing less to explain.
// Kinds become tables with metatables, and "try" becomes pcall.

import { Emitter } from './emitter.js';

const RESERVED = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while', 'print', 'pairs', 'ipairs', 'type', 'table',
  'string', 'math', 'os', 'io', 'plain', 'self'
]);

export class LuaEmitter extends Emitter {
  get name() { return 'Lua'; }
  get extension() { return '.lua'; }
  get indentText() { return '  '; }
  get lineEnd() { return ''; }
  get reserved() { return RESERVED; }
  get selfWord() { return 'self'; }
  get nothingWord() { return 'nil'; }
  get andWord() { return 'and'; }
  get orWord() { return 'or'; }
  get notWord() { return 'not '; }

  // Lua has patterns of its own, but they are not the patterns Plain means,
  // and quietly writing something that behaves differently would be worse
  // than saying so.
  get cannotDo() {
    return new Set([
      '$text matches $pattern',
      'first match of $pattern in $text',
      'parts of $text matching $pattern',
      'replace pattern $pattern with $replacement in $text'
    ]);
  }

  // In Lua "^" raises to a power; the exclusive-or is "~".
  bitwise(sign, left, right) {
    const real = sign === '^' ? '~' : sign;
    return `(${this.helper('whole', [left])} ${real} ${this.helper('whole', [right])})`;
  }

  comment(text) { return '-- ' + text; }
  helperCall(name, args) { return `plain.${name}(${args.join(', ')})`; }
  declare(name, value) { return `local ${name} = ${value}`; }
  ifHeader(condition) { return `if ${condition} then`; }
  elseIfHeader(condition) { return `elseif ${condition} then`; }
  elseHeader() { return 'else'; }
  whileHeader(condition) { return `while ${condition} do`; }
  forEachHeader(name, iterable) { return `for _, ${name} in ipairs(${iterable}) do`; }
  functionHeader(name, params) { return `function ${name}(${params.join(', ')})`; }
  closer() { return 'end'; }
  chainPrefix() { return ''; }
  breakStatement() { return 'break'; }
  // Lua has no "continue"; goto is the usual way, and it needs a label.
  continueStatement() { return 'goto continue'; }
  returnStatement(value) { return value === null ? 'return' : `return ${value}`; }
  showStatement(value) { return `print(${value})`; }
  exitProgram() { return 'os.exit(0)'; }
  raiseProblem(message) { return `error(${message}, 0)`; }
  power(left, right) { return `(${this.helper('number', [left])} ^ ${this.helper('number', [right])})`; }
  listLiteral(items) { return `{ ${items.join(', ')} }`; }
  // A Lua table forgets the order its keys went in, and Plain does not, so
  // the order is carried alongside as __order.
  recordLiteral(pairs) {
    if (!pairs.length) return '{}';
    this.used.add('keys');
    const values = pairs.map(([key, value]) => `[${JSON.stringify(key)}] = ${value}`);
    const order = pairs.map(([key]) => JSON.stringify(key));
    return `{ ${values.join(', ')}, __order = { ${order.join(', ')} } }`;
  }
  fieldAccess(object, field) { return this.helper('field', [object, JSON.stringify(field)]); }
  assignField(object, field, value) { return this.helper('setField', [object, JSON.stringify(field), value]); }
  methodCall(object, method, args) { return `${object}:${method}(${[...args].join(', ')})`; }
  newInstance(kind, pairs) { return `${kind}.new(${this.recordLiteral(pairs)})`; }
  isKindOf(value, kind) { return this.helper('isKindOf', [value, kind]); }
  kindNameOf(value) { return this.helper('kindName', [value]); }
  actionReference(name) { return name; }

  // Lua's arrays are already 1-based, but everything else about Plain's
  // lists (holes, text, things) still goes through the helper.
  emitFunction(node) {
    this.write('');
    const name = this.identifier(node.name.replace(/\s+/g, '_'));
    this.open(`local function ${name}(${node.params.map(p => this.identifier(p)).join(', ')})`);
    for (const param of node.params) this.remember(this.identifier(param));
    this.block(node.block);
    this.close();
    this.remember(name);
  }

  // A kind is a table with a metatable, which is how Lua does objects.
  emitKind(node) {
    const name = this.kindName(node.name);
    this.write('');
    this.writeLine(`local ${name} = {}`);
    this.writeLine(`${name}.__index = ${name}`);
    if (node.base) this.writeLine(`setmetatable(${name}, { __index = ${this.kindName(node.base)} })`);

    this.writeLine(`${name}.__name = ${JSON.stringify(name)}`);

    // The starting values, base ones first so this kind can change them.
    this.open(`function ${name}.fill(into)`);
    if (node.base) this.writeLine(`${this.kindName(node.base)}.fill(into)`);
    for (const field of node.fields) {
      this.writeLine(this.helper('own', [
        'into',
        JSON.stringify(this.fieldName(field.name)),
        field.value ? this.expression(field.value) : 'nil'
      ]));
    }
    this.close();

    this.open(`function ${name}.new(values)`);
    this.writeLine(`local thing = setmetatable({}, ${name})`);
    this.writeLine(`${name}.fill(thing)`);
    // Copied one at a time, so the kind's own order of values is kept and
    // the bookkeeping key is not copied over the top of it.
    this.open(`for _, key in ipairs(${this.helper('keys', ['values or {}'])}) do`);
    this.writeLine(this.helper('setField', ['thing', 'key', 'values[key]']));
    this.close();
    this.writeLine('return thing');
    this.close();

    for (const action of node.actions) {
      this.write('');
      this.open(`function ${name}:${this.identifier(action.name.replace(/\s+/g, '_'))}(${action.params.map(p => this.identifier(p)).join(', ')})`);
      for (const param of action.params) this.remember(this.identifier(param));
      this.block(action.block);
      this.close();
    }
  }

  // Lua has no try/catch: pcall runs something and hands back what went wrong.
  emitTry(node) {
    this.open('local ok, caught = pcall(function()');
    this.block(node.block);
    this.close('end)');
    this.open('if not ok then');
    if (node.rescue) {
      this.remember('problem');
      this.writeLine('local problem = tostring(caught)');
      this.block(node.rescue);
    }
    this.close();
  }

  // "next" needs a label in Lua, so loops that use it get one.
  emitForEach(node) {
    this.open(this.forEachHeader(this.identifier(node.name), this.helper('items', [this.expression(node.list)])));
    this.remember(this.identifier(node.name));
    this.block(node.block);
    if (usesNext(node.block)) this.write('::continue::');
    this.close();
  }

  emitWhile(node) {
    this.open(this.whileHeader(this.truth(node.condition)));
    this.block(node.block);
    if (usesNext(node.block)) this.write('::continue::');
    this.close();
  }

  // Counting loops need the label too, or "next" has nowhere to jump.
  emitRepeat(node) {
    const times = this.expression(node.count);
    this.open(this.countHeader('count', '1', times, '1'));
    this.remember('count');
    this.block(node.block);
    if (usesNext(node.block)) this.write('::continue::');
    this.close();
  }

  emitCount(node) {
    const name = this.identifier(node.name);
    const from = this.expression(node.from);
    const to = this.expression(node.to);
    const step = node.step ? this.expression(node.step) : '1';
    this.open(this.countHeader(name, from, to, step));
    this.remember(name);
    this.block(node.block);
    if (usesNext(node.block)) this.write('::continue::');
    this.close();
  }

  emitConstructor() { /* handled inside emitKind */ }

  preamble() { return []; }

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
    const body = Object.keys(HELPERS).filter(name => wanted.has(name)).map(name => HELPERS[name].code.trimEnd());
    return ['local plain = {}', ...body].join('\n\n');
  }
}

function usesNext(block) {
  if (!block || !block.body) return false;
  return block.body.some(node => {
    if (node.type === 'Continue') return true;
    if (node.type === 'If') {
      return node.branches.some(branch => usesNext(branch.block)) || usesNext(node.otherwise);
    }
    return false;
  });
}

const HELPERS = {
  text: {
    code: `-- Values written the way Plain writes them.
function plain.text(value, depth)
  depth = depth or 0
  if value == nil then return "nothing" end
  if type(value) == "boolean" then return value and "yes" or "no" end
  if type(value) == "number" then return plain.numberText(value) end
  if type(value) == "string" then
    if depth == 0 then return value end
    return '"' .. value .. '"'
  end
  if type(value) == "function" then return "<action>" end
  if type(value) == "table" then
    if plain.isList(value) then
      local parts = {}
      for _, item in ipairs(value) do parts[#parts + 1] = plain.text(item, depth + 1) end
      return "[" .. table.concat(parts, ", ") .. "]"
    end
    local parts = {}
    for _, key in ipairs(plain.keys(value)) do
      parts[#parts + 1] = tostring(key) .. ": " .. plain.text(value[key], depth + 1)
    end
    local kind = plain.kindName(value)
    if kind ~= "thing" then return "a " .. kind .. " (" .. table.concat(parts, ", ") .. ")" end
    return "{" .. table.concat(parts, ", ") .. "}"
  end
  return tostring(value)
end`,
    needs: ['numberText', 'isList', 'keys', 'kindName']
  },

  numberText: {
    code: `function plain.numberText(value)
  if value == math.floor(value) and value == value and value ~= math.huge and value ~= -math.huge then
    return string.format("%d", value)
  end
  return (string.format("%.12g", value))
end`
  },

  isList: {
    code: `function plain.isList(value)
  if type(value) ~= "table" then return false end
  if #value > 0 then return true end
  return next(value) == nil
end`
  },

  number: {
    code: `function plain.number(value)
  if type(value) == "number" then return value end
  if type(value) == "boolean" then return value and 1 or 0 end
  if value == nil then return 0 end
  return tonumber(value) or 0
end`
  },

  truthy: {
    code: `function plain.truthy(value)
  if value == nil or value == false then return false end
  if value == 0 or value == "" then return false end
  if type(value) == "table" and plain.isList(value) then return #value > 0 end
  return true
end`,
    needs: ['isList']
  },

  same: {
    code: `function plain.same(a, b)
  if a == nil or b == nil then return a == nil and b == nil end
  if type(a) == "boolean" or type(b) == "boolean" then return plain.truthy(a) == plain.truthy(b) end
  if type(a) == "number" or type(b) == "number" then return plain.number(a) == plain.number(b) end
  if type(a) == "table" and type(b) == "table" then
    if #a ~= #b then return false end
    for at = 1, #a do if not plain.same(a[at], b[at]) then return false end end
    return true
  end
  return a == b
end`,
    needs: ['number', 'truthy']
  },

  add: {
    code: `function plain.add(a, b)
  if type(a) == "string" or type(b) == "string" then return plain.text(a) .. plain.text(b) end
  return plain.number(a) + plain.number(b)
end`,
    needs: ['text', 'number']
  },

  join2: { code: `function plain.join2(a, b)\n  return plain.text(a) .. plain.text(b)\nend`, needs: ['text'] },

  divide: {
    code: `function plain.divide(a, b)
  if plain.number(b) == 0 then error("I cannot divide by zero", 0) end
  return plain.number(a) / plain.number(b)
end`,
    needs: ['number']
  },

  remainder: {
    code: `function plain.remainder(a, b)
  if plain.number(b) == 0 then error("I cannot divide by zero", 0) end
  return math.fmod(plain.number(a), plain.number(b))
end`,
    needs: ['number']
  },

  items: {
    code: `function plain.items(value)
  if type(value) == "table" then
    if plain.isList(value) then return value end
    return plain.keys(value)
  end
  if type(value) == "string" then
    local out = {}
    for at = 1, #value do out[at] = value:sub(at, at) end
    return out
  end
  return {}
end`,
    needs: ['isList', 'keys']
  },

  range: {
    code: `-- Plain counts up or down depending on the two numbers.
function plain.range(from, to, step)
  local move = math.abs(plain.number(step))
  if move == 0 then move = 1 end
  if plain.number(to) < plain.number(from) then move = -move end
  local out = {}
  local at = plain.number(from)
  while (move > 0 and at <= plain.number(to)) or (move < 0 and at >= plain.number(to)) do
    out[#out + 1] = at
    at = at + move
  end
  return out
end`,
    needs: ['number']
  },

  item: {
    code: `function plain.item(collection, index)
  local at = math.floor(plain.number(index))
  if type(collection) == "string" then
    if at < 0 then at = #collection + at + 1 end
    if at < 1 or at > #collection then return nil end
    return collection:sub(at, at)
  end
  if type(collection) ~= "table" then return nil end
  if at < 0 then at = #collection + at + 1 end
  return collection[at]
end`,
    needs: ['number']
  },

  setItem: {
    code: `function plain.setItem(collection, index, value)
  local at = math.floor(plain.number(index))
  if at < 0 then at = #collection + at + 1 end
  if type(collection) == "table" and at >= 1 and at <= #collection then collection[at] = value end
  return collection
end`,
    needs: ['number']
  },

  first: { code: `function plain.first(collection)\n  return plain.item(collection, 1)\nend`, needs: ['item'] },
  last: { code: `function plain.last(collection)\n  return plain.item(collection, plain.length(collection))\nend`, needs: ['item', 'length'] },

  length: {
    code: `function plain.length(value)
  if type(value) == "string" then return #value end
  if type(value) == "table" then
    if plain.isList(value) then return #value end
    return #plain.keys(value)
  end
  return 0
end`,
    needs: ['isList', 'keys']
  },

  keys: {
    code: `-- The names a thing holds, in the order they were given.
function plain.keys(thing)
  local out = {}
  if type(thing) ~= "table" then return out end
  local order = plain.orderOf(thing)
  if order then
    for _, key in ipairs(order) do out[#out + 1] = key end
    return out
  end
  for key in pairs(thing) do
    if type(key) == "string" and key ~= "__order" then out[#out + 1] = key end
  end
  table.sort(out)
  return out
end`,
    needs: ['orderOf']
  },

  orderOf: {
    code: `function plain.orderOf(thing)
  local order = rawget(thing, "__order")
  if order then return order end
  local holder = getmetatable(thing)
  while holder do
    local found = rawget(holder, "__order")
    if found then return found end
    holder = holder.__index ~= holder and holder.__index or nil
    if type(holder) ~= "table" then return nil end
  end
  return nil
end`
  },

  own: {
    code: `-- Give a thing a value, remembering where it came in the order.
function plain.own(thing, key, value)
  local order = rawget(thing, "__order")
  if not order then order = {} rawset(thing, "__order", order) end
  local seen = false
  for _, name in ipairs(order) do if name == key then seen = true break end end
  if not seen then order[#order + 1] = key end
  rawset(thing, key, value)
end`
  },

  values: { code: `function plain.values(thing)\n  local out = {}\n  for _, key in ipairs(plain.keys(thing)) do out[#out + 1] = thing[key] end\n  return out\nend`, needs: ['keys'] },

  field: {
    code: `function plain.field(thing, name)
  if thing == nil then return nil end
  if type(thing) == "string" or plain.isList(thing) then
    local lowered = name:lower()
    if lowered == "length" or lowered == "size" or lowered == "count" then return plain.length(thing) end
  end
  if type(thing) ~= "table" then return nil end
  if thing[name] ~= nil then return thing[name] end
  for key, value in pairs(thing) do
    if type(key) == "string" and key:lower() == name:lower() then return value end
  end
  return nil
end`,
    needs: ['isList', 'length']
  },

  setField: {
    code: `function plain.setField(thing, name, value)
  for _, key in ipairs(plain.keys(thing)) do
    if key:lower() == name:lower() then rawset(thing, key, value) return end
  end
  plain.own(thing, name, value)
end`,
    needs: ['keys', 'own']
  },

  value: { code: `function plain.value(thing, key)\n  return plain.field(thing, plain.text(key))\nend`, needs: ['field', 'text'] },
  setValue: { code: `function plain.setValue(thing, key, value)\n  plain.setField(thing, plain.text(key), value)\nend`, needs: ['setField', 'text'] },
  hasKey: { code: `function plain.hasKey(thing, key)\n  return plain.field(thing, plain.text(key)) ~= nil\nend`, needs: ['field', 'text'] },

  has: {
    code: `function plain.has(container, value)
  if type(container) == "string" then return container:find(plain.text(value), 1, true) ~= nil end
  for _, item in ipairs(plain.items(container)) do
    if plain.same(item, value) then return true end
  end
  return false
end`,
    needs: ['items', 'same', 'text']
  },

  total: { code: `function plain.total(collection)\n  local sum = 0\n  for _, item in ipairs(plain.items(collection)) do sum = sum + plain.number(item) end\n  return sum\nend`, needs: ['items', 'number'] },
  average: { code: `function plain.average(collection)\n  local all = plain.items(collection)\n  if #all == 0 then return 0 end\n  return plain.total(all) / #all\nend`, needs: ['items', 'total'] },
  highest: { code: `function plain.highest(collection)\n  local best = nil\n  for _, item in ipairs(plain.items(collection)) do\n    if best == nil or plain.number(item) > plain.number(best) then best = item end\n  end\n  return best\nend`, needs: ['items', 'number'] },
  lowest: { code: `function plain.lowest(collection)\n  local best = nil\n  for _, item in ipairs(plain.items(collection)) do\n    if best == nil or plain.number(item) < plain.number(best) then best = item end\n  end\n  return best\nend`, needs: ['items', 'number'] },

  sorted: {
    code: `function plain.sorted(collection)
  local copy = {}
  for at, item in ipairs(plain.items(collection)) do copy[at] = item end
  table.sort(copy, function(a, b)
    if type(a) == "number" and type(b) == "number" then return a < b end
    return plain.text(a) < plain.text(b)
  end)
  return copy
end`,
    needs: ['items', 'text']
  },

  reversed: { code: `function plain.reversed(collection)\n  local all = plain.items(collection)\n  local out = {}\n  for at = #all, 1, -1 do out[#out + 1] = all[at] end\n  return out\nend`, needs: ['items'] },
  shuffled: { code: `function plain.shuffled(collection)\n  local mixed = {}\n  for _, item in ipairs(plain.items(collection)) do mixed[#mixed + 1] = item end\n  for at = #mixed, 2, -1 do\n    local other = math.random(at)\n    mixed[at], mixed[other] = mixed[other], mixed[at]\n  end\n  return mixed\nend`, needs: ['items'] },
  copy: { code: `function plain.copy(value)\n  if type(value) ~= "table" then return value end\n  local out = {}\n  for key, item in pairs(value) do out[key] = item end\n  return out\nend` },
  joinWith: { code: `function plain.joinWith(collection, separator)\n  local parts = {}\n  for _, item in ipairs(plain.items(collection)) do parts[#parts + 1] = plain.text(item) end\n  return table.concat(parts, plain.text(separator))\nend`, needs: ['items', 'text'] },
  position: {
    code: `function plain.position(collection, value)
  if type(collection) == "string" then
    local at = collection:find(plain.text(value), 1, true)
    return at or 0
  end
  for at, item in ipairs(plain.items(collection)) do
    if plain.same(item, value) then return at end
  end
  return 0
end`,
    needs: ['items', 'same', 'text']
  },

  addTo: {
    code: `-- "add x to name" grows a list, adds to a number, or joins text.
function plain.addTo(current, value)
  if type(current) == "table" then current[#current + 1] = value return current end
  if type(current) == "string" then return current .. plain.text(value) end
  return plain.number(current) + plain.number(value)
end`,
    needs: ['text', 'number']
  },

  removeValue: { code: `function plain.removeValue(collection, value)\n  for at, item in ipairs(collection) do\n    if plain.same(item, value) then table.remove(collection, at) break end\n  end\n  return collection\nend`, needs: ['same'] },
  removeAt: { code: `function plain.removeAt(collection, index)\n  local at = math.floor(plain.number(index))\n  if at >= 1 and at <= #collection then table.remove(collection, at) end\n  return collection\nend`, needs: ['number'] },
  emptied: { code: `function plain.emptied(value)\n  if type(value) == "table" then\n    for at = #value, 1, -1 do table.remove(value, at) end\n    return value\n  end\n  return nil\nend` },

  upper: { code: `function plain.upper(text)\n  return plain.text(text):upper()\nend`, needs: ['text'] },
  lower: { code: `function plain.lower(text)\n  return plain.text(text):lower()\nend`, needs: ['text'] },
  trimmed: { code: `function plain.trimmed(text)\n  return (plain.text(text):gsub("^%s+", ""):gsub("%s+$", ""))\nend`, needs: ['text'] },
  split: {
    code: `function plain.split(text, separator)
  local whole, mark = plain.text(text), plain.text(separator)
  local out, at = {}, 1
  while true do
    local from, to = whole:find(mark, at, true)
    if not from then out[#out + 1] = whole:sub(at) break end
    out[#out + 1] = whole:sub(at, from - 1)
    at = to + 1
  end
  return out
end`,
    needs: ['text']
  },
  part: { code: `function plain.part(text, start, finish)\n  return plain.text(text):sub(math.max(1, math.floor(plain.number(start))), math.floor(plain.number(finish)))\nend`, needs: ['text', 'number'] },
  replace: { code: `function plain.replace(text, find, replacement)\n  local out = plain.split(plain.text(text), plain.text(find))\n  return table.concat(out, plain.text(replacement))\nend`, needs: ['text', 'split'] },
  startsWith: { code: `function plain.startsWith(text, prefix)\n  return plain.text(text):sub(1, #plain.text(prefix)) == plain.text(prefix)\nend`, needs: ['text'] },
  endsWith: { code: `function plain.endsWith(text, suffix)\n  local whole, tail = plain.text(text), plain.text(suffix)\n  return tail == "" or whole:sub(- #tail) == tail\nend`, needs: ['text'] },

  round: { code: `function plain.round(value)\n  return math.floor(plain.number(value) + 0.5)\nend`, needs: ['number'] },
  roundTo: { code: `function plain.roundTo(value, places)\n  local scale = 10 ^ math.floor(plain.number(places))\n  return math.floor(plain.number(value) * scale + 0.5) / scale\nend`, needs: ['number'] },
  floor: { code: `function plain.floor(value)\n  return math.floor(plain.number(value))\nend`, needs: ['number'] },
  ceiling: { code: `function plain.ceiling(value)\n  return math.ceil(plain.number(value))\nend`, needs: ['number'] },
  absolute: { code: `function plain.absolute(value)\n  return math.abs(plain.number(value))\nend`, needs: ['number'] },
  squareRoot: { code: `function plain.squareRoot(value)\n  return math.sqrt(math.max(0, plain.number(value)))\nend`, needs: ['number'] },
  sine: { code: `function plain.sine(value)\n  return math.sin(plain.number(value))\nend`, needs: ['number'] },
  cosine: { code: `function plain.cosine(value)\n  return math.cos(plain.number(value))\nend`, needs: ['number'] },
  smaller: { code: `function plain.smaller(a, b)\n  return math.min(plain.number(a), plain.number(b))\nend`, needs: ['number'] },
  bigger: { code: `function plain.bigger(a, b)\n  return math.max(plain.number(a), plain.number(b))\nend`, needs: ['number'] },
  pi: { code: `function plain.pi()\n  return math.pi\nend` },
  e: { code: `function plain.e()\n  return math.exp(1)\nend` },
  exponent: { code: `function plain.exponent(value)\n  return math.exp(plain.number(value))\nend`, needs: ['number'] },
  logarithm: { code: `function plain.logarithm(value)\n  return math.log(math.max(1e-300, plain.number(value)))\nend`, needs: ['number'] },
  tangent: { code: `function plain.tangent(value)\n  return math.tan(plain.number(value))\nend`, needs: ['number'] },

  randomBetween: { code: `function plain.randomBetween(low, high)\n  return math.random(math.ceil(plain.number(low)), math.floor(plain.number(high)))\nend`, needs: ['number'] },
  randomNumber: { code: `function plain.randomNumber()\n  return math.random()\nend` },
  randomItem: { code: `function plain.randomItem(collection)\n  local all = plain.items(collection)\n  if #all == 0 then return nil end\n  return all[math.random(#all)]\nend`, needs: ['items'] },

  whole: { code: `function plain.whole(value)\n  local n = plain.number(value)\n  return n >= 0 and math.floor(n) or -math.floor(-n)\nend`, needs: ['number'] },

  timeNow: { code: `function plain.timeNow()\n  return os.time() * 1000\nend` },
  today: { code: `function plain.today()\n  return os.date("%Y-%m-%d")\nend` },

  kindName: {
    code: `function plain.kindName(value)
  if type(value) == "table" then
    local holder = getmetatable(value)
    if holder and holder.__name then return holder.__name end
  end
  return plain.kindOf(value):gsub("^an? ", "")
end`,
    needs: ['kindOf']
  },

  kindOf: {
    code: `function plain.kindOf(value)
  if value == nil then return "nothing" end
  if type(value) == "boolean" then return "a yes/no" end
  if type(value) == "number" then return "a number" end
  if type(value) == "string" then return "text" end
  if type(value) == "function" then return "an action" end
  if plain.isList(value) then return "a list" end
  return "a thing"
end`,
    needs: ['isList']
  },

  isKindOf: {
    code: `function plain.isKindOf(value, kind)
  local holder = getmetatable(value)
  while holder do
    if holder == kind or holder.__index == kind then return true end
    local above = getmetatable(holder)
    holder = above and above.__index or nil
  end
  return false
end`
  },

  changedBy: { code: `function plain.changedBy(collection, action)\n  local out = {}\n  for _, item in ipairs(plain.items(collection)) do out[#out + 1] = action(item) end\n  return out\nend`, needs: ['items'] },
  keptWhere: { code: `function plain.keptWhere(collection, action)\n  local out = {}\n  for _, item in ipairs(plain.items(collection)) do\n    if plain.truthy(action(item)) then out[#out + 1] = item end\n  end\n  return out\nend`, needs: ['items', 'truthy'] },
  addedUpBy: { code: `function plain.addedUpBy(collection, action)\n  local sum = 0\n  for _, item in ipairs(plain.items(collection)) do sum = sum + plain.number(action(item)) end\n  return sum\nend`, needs: ['items', 'number'] },

  ask: {
    code: `-- Reads one line, the way "ask ... into ..." does in Plain.
function plain.ask(question)
  io.write(plain.text(question))
  local answer = io.read("l") or ""
  return tonumber(answer) or answer
end`,
    needs: ['text']
  }
};
