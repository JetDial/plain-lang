// Plain -> Go.
//
// Go is strict where Plain is easy-going: everything has a type, there are
// no exceptions, and a name you do not use is an error rather than a
// shrug. So every value here is `any`, a kind of your own becomes a Thing
// with its values in a map, catching a problem is done with recover, and
// each name is followed by a small `_ = name` so Go does not object to one
// that goes unused.

import { Emitter } from './emitter.js';

const RESERVED = new Set([
  'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
  'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
  'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
  'var', 'any', 'nil', 'true', 'false', 'string', 'int', 'float64', 'bool',
  'len', 'cap', 'make', 'new', 'append', 'copy', 'delete', 'panic', 'recover',
  'print', 'println', 'main', 'init', 'fmt', 'math', 'strings', 'strconv',
  'sort', 'time', 'rand', 'regexp', 'me', 'thing', 'args'
]);

export class GoEmitter extends Emitter {
  get name() { return 'Go'; }
  get extension() { return '.go'; }
  get indentText() { return '\t'; }
  get lineEnd() { return ''; }
  get reserved() { return RESERVED; }
  get selfWord() { return 'me'; }
  get nothingWord() { return 'nil'; }

  helperCall(name, args) { return `plain${capital(name)}(${args.join(', ')})`; }
  ifHeader(condition) { return `if ${condition} {`; }
  elseIfHeader(condition) { return `else if ${condition} {`; }
  whileHeader(condition) { return `for ${condition} {`; }
  forEachHeader(name, iterable) { return `for _, ${name} := range ${iterable} {`; }
  functionHeader(name, params) {
    return `func ${name}(${params.map(p => `${p} any`).join(', ')}) any {`;
  }
  showStatement(value) { this.needs.add('fmt'); return `fmt.Println(${value})`; }
  exitProgram() { this.needs.add('os'); return 'os.Exit(0)'; }
  raiseProblem(message) { return `panic(${message})`; }
  power(left, right) { return this.helper('power', [left, right]); }
  isKindOf(value, kind) { return this.helper('isKind', [value, JSON.stringify(kind)]); }
  kindNameOf(value) { return this.helper('kindName', [value]); }
  listLiteral(items) { return `[]any{${items.join(', ')}}`; }
  recordLiteral(pairs) {
    return this.helper('thing', ['""', ...pairs.flatMap(([key, value]) => [JSON.stringify(key), value])]);
  }
  newInstance(kind, pairs) {
    return this.helper('newThing', [JSON.stringify(kind), ...pairs.flatMap(([key, value]) => [JSON.stringify(key), value])]);
  }
  methodCall(object, method, args) {
    return this.helper('tell', [object, JSON.stringify(method), `[]any{${args.join(', ')}}`]);
  }
  callValue(action, args) { return this.helper('run', [action, `[]any{${args.join(', ')}}`]); }
  callFunction(name, args) { return `${name}(${args.join(', ')})`; }
  actionReference(name) { return `any(${name})`; }
  fieldAccess(object, field) { return this.helper('field', [object, JSON.stringify(field)]); }
  assignField(object, field, value) { return this.helper('setField', [object, JSON.stringify(field), value]); }

  // Whole-looking numbers still have to be float64, or Go makes them ints.
  numberLiteral(value) {
    return Number.isInteger(value) ? `${value}.0` : String(value);
  }

  constructor(options) {
    super(options);
    this.needs = new Set();          // packages this program imports
  }

  // Go objects to a name that is never used, which Plain never worries
  // about, so each one is quietly marked as used.
  statement(node) {
    super.statement(node);
    if (node.type === 'Make') {
      const name = this.variable(node.name);
      this.writeLine(`_ = ${name}`);
    }
  }

  // Everything is declared as any, or Go pins the type from the first
  // value and then refuses the next one.
  declare(name, value) { return `var ${name} any = ${value}`; }

  emitForEach(node) {
    const name = this.loopName(node.name);
    this.open(this.forEachHeader(name, this.helper('items', [this.expression(node.list)])));
    this.bindLoop(node.name, name);
    this.writeLine(`_ = ${name}`);
    this.block(node.block);
    this.close();
  }

  emitRepeat(node) {
    const times = this.expression(node.count);
    const name = this.loopName('count');
    this.open(this.countHeader(name, '1.0', times, '1.0'));
    this.bindLoop('count', name);
    this.writeLine(`_ = ${name}`);
    this.block(node.block);
    this.close();
  }

  emitCount(node) {
    const name = this.loopName(node.name);
    const from = this.expression(node.from);
    const to = this.expression(node.to);
    const step = node.step ? this.expression(node.step) : '1.0';
    this.open(this.countHeader(name, from, to, step));
    this.bindLoop(node.name, name);
    this.writeLine(`_ = ${name}`);
    this.block(node.block);
    this.close();
  }

  finishFunctionBody(block) {
    const last = block && block.body.length ? block.body[block.body.length - 1] : null;
    if (!last || last.type !== 'Return') this.writeLine('return nil');
  }

  // Go has no exceptions. A helper runs the risky part and hands whatever
  // went wrong to the other half.
  emitTry(node) {
    this.open(`${this.helper('try', [])[0] === 'p' ? 'plainTry' : 'plainTry'}(func() {`);
    this.block(node.block);
    this.close('}, func(problem any) {');
    this.depth++;
    if (node.rescue) {
      this.remember('problem');
      this.writeLine('_ = problem');
      this.block(node.rescue);
    }
    this.depth--;
    this.write('})');
  }

  // A kind becomes a way of filling in a Thing, plus its actions, both
  // registered when the program starts.
  emitKind(node) {
    const name = this.kindName(node.name);
    this.write('');
    this.open('func init() {');
    if (node.base) this.writeLine(`plainBases[${JSON.stringify(name)}] = ${JSON.stringify(this.kindName(node.base))}`);

    this.open(`plainFills[${JSON.stringify(name)}] = func(into *Thing) {`);
    if (node.base) this.writeLine(`plainFills[${JSON.stringify(this.kindName(node.base))}](into)`);
    for (const field of node.fields) {
      this.writeLine(this.helper('own', [
        'into', JSON.stringify(this.fieldName(field.name)),
        field.value ? this.expression(field.value) : 'nil'
      ]));
    }
    this.close('}');

    this.open(`plainActions[${JSON.stringify(name)}] = map[string]func(*Thing, []any) any{`);
    for (const action of node.actions) {
      this.open(`${JSON.stringify(this.identifier(action.name.replace(/\s+/g, '_')))}: func(me *Thing, args []any) any {`);
      this.writeLine('_ = me');
      this.writeLine('_ = args');
      action.params.forEach((param, at) => {
        const named = this.identifier(param);
        this.writeLine(`${named} := ${this.helper('at', ['args', String(at)])}`);
        this.writeLine(`_ = ${named}`);
        this.remember(named);
      });
      this.block(action.block);
      this.finishFunctionBody(action.block);
      this.close('},');
    }
    this.close('}');
    this.close();
  }

  emitConstructor() { /* a kind is filled in by its registered function */ }

  translate(program, meta = {}) {
    this.collectKinds(program);

    this.depth = 0;
    const kinds = this.capture(() => {
      for (const node of program.body) if (node.type === 'Kind') this.statement(node);
    });
    const actions = this.capture(() => {
      for (const node of program.body) if (node.type === 'Function') this.statement(node);
    });

    this.depth = 1;
    const main = this.capture(() => {
      for (const node of program.body) {
        if (node.type === 'Kind' || node.type === 'Function') continue;
        this.statement(node);
      }
    });
    this.depth = 0;

    if (this.unsupported.length) return Emitter.prototype.translate.call(this, program, meta);

    const helpers = this.emitHelpers();
    const imports = [...this.needs].sort();

    const out = [
      this.comment(`Translated from ${meta.file || 'a Plain program'} by Plain ${meta.version || ''}`.trim()),
      this.comment('Plain is the source; this file is what it means in Go.'),
      '',
      'package main',
      ''
    ];
    if (imports.length) {
      out.push('import (');
      for (const one of imports) out.push(`\t"${one}"`);
      out.push(')', '');
    }
    if (helpers) out.push(helpers, '');
    if (kinds.length) out.push(...kinds, '');
    if (actions.length) out.push(...actions, '');
    out.push('func main() {');
    out.push(...main);
    out.push('}');

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  emitHelpers() {
    const wanted = new Set();
    const add = (name) => {
      if (wanted.has(name) || !HELPERS[name]) return;
      wanted.add(name);
      for (const needed of HELPERS[name].needs || []) add(needed);
    };
    add('base');
    for (const name of this.used) add(name);
    for (const name of wanted) {
      for (const one of (HELPERS[name] || {}).imports || []) this.needs.add(one);
    }
    return Object.keys(HELPERS).filter(name => wanted.has(name)).map(name => HELPERS[name].code.trimEnd()).join('\n\n');
  }
}

function capital(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const HELPERS = {
  // Always written: a Thing is both a record and one of your own kinds.
  base: {
    code: `// A Thing is a bag of named values that remembers the order they came
// in. A kind of your own is a Thing with a name on it.
type Thing struct {
	Kind   string
	Order  []string
	Fields map[string]any
}

var plainBases = map[string]string{}
var plainFills = map[string]func(*Thing){}
var plainActions = map[string]map[string]func(*Thing, []any) any{}

func plainOwn(thing *Thing, name string, value any) {
	if _, seen := thing.Fields[name]; !seen {
		thing.Order = append(thing.Order, name)
	}
	thing.Fields[name] = value
}

func plainThing(kind string, pairs ...any) *Thing {
	thing := &Thing{Kind: kind, Fields: map[string]any{}}
	for at := 0; at+1 < len(pairs); at += 2 {
		plainOwn(thing, plainText(pairs[at]), pairs[at+1])
	}
	return thing
}

func plainNewThing(kind string, pairs ...any) *Thing {
	thing := &Thing{Kind: kind, Fields: map[string]any{}}
	if fill, found := plainFills[kind]; found {
		fill(thing)
	}
	for at := 0; at+1 < len(pairs); at += 2 {
		plainSetField(thing, plainText(pairs[at]), pairs[at+1])
	}
	return thing
}

func plainAt(args []any, at int) any {
	if at < len(args) {
		return args[at]
	}
	return nil
}`,
    needs: ['text', 'setField']
  },

  text: {
    code: `// Values written the way Plain writes them.
func plainText(value any) string { return plainTextAt(value, 0) }

func plainTextAt(value any, depth int) string {
	if value == nil {
		return "nothing"
	}
	switch shape := value.(type) {
	case bool:
		if shape {
			return "yes"
		}
		return "no"
	case float64:
		return plainNumberText(shape)
	case int:
		return plainNumberText(float64(shape))
	case string:
		if depth == 0 {
			return shape
		}
		return "\\"" + shape + "\\""
	case []any:
		parts := []string{}
		for _, item := range shape {
			parts = append(parts, plainTextAt(item, depth+1))
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case *Thing:
		parts := []string{}
		for _, name := range shape.Order {
			parts = append(parts, name+": "+plainTextAt(shape.Fields[name], depth+1))
		}
		if shape.Kind == "" {
			return "{" + strings.Join(parts, ", ") + "}"
		}
		return "a " + shape.Kind + " (" + strings.Join(parts, ", ") + ")"
	}
	return "<action>"
}`,
    needs: ['numberText'],
    imports: ['strings']
  },

  numberText: {
    code: `func plainNumberText(value float64) string {
	if value == math.Trunc(value) && !math.IsInf(value, 0) {
		return strconv.FormatFloat(value, 'f', 0, 64)
	}
	return strconv.FormatFloat(value, 'g', 12, 64)
}`,
    imports: ['math', 'strconv']
  },

  number: {
    code: `func plainNumber(value any) float64 {
	switch shape := value.(type) {
	case float64:
		return shape
	case int:
		return float64(shape)
	case bool:
		if shape {
			return 1
		}
		return 0
	case string:
		found, problem := strconv.ParseFloat(shape, 64)
		if problem != nil {
			return 0
		}
		return found
	}
	return 0
}`,
    imports: ['strconv']
  },

  truthy: {
    code: `func plainTruthy(value any) bool {
	switch shape := value.(type) {
	case nil:
		return false
	case bool:
		return shape
	case string:
		return shape != ""
	case float64:
		return shape != 0
	case []any:
		return len(shape) > 0
	}
	return true
}`
  },

  same: {
    code: `func plainSame(a any, b any) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	_, aBool := a.(bool)
	_, bBool := b.(bool)
	if aBool || bBool {
		return plainTruthy(a) == plainTruthy(b)
	}
	_, aNumber := a.(float64)
	_, bNumber := b.(float64)
	if aNumber || bNumber {
		return plainNumber(a) == plainNumber(b)
	}
	left, aList := a.([]any)
	right, bList := b.([]any)
	if aList && bList {
		if len(left) != len(right) {
			return false
		}
		for at := range left {
			if !plainSame(left[at], right[at]) {
				return false
			}
		}
		return true
	}
	return a == b
}`,
    needs: ['number', 'truthy']
  },

  add: {
    code: `func plainAdd(a any, b any) any {
	_, aText := a.(string)
	_, bText := b.(string)
	if aText || bText {
		return plainText(a) + plainText(b)
	}
	return plainNumber(a) + plainNumber(b)
}`,
    needs: ['text', 'number']
  },

  join2: { code: `func plainJoin2(a any, b any) any { return plainText(a) + plainText(b) }`, needs: ['text'] },

  divide: {
    code: `func plainDivide(a any, b any) any {
	if plainNumber(b) == 0 {
		panic("I cannot divide by zero")
	}
	return plainNumber(a) / plainNumber(b)
}`,
    needs: ['number']
  },

  remainder: {
    code: `func plainRemainder(a any, b any) any {
	if plainNumber(b) == 0 {
		panic("I cannot divide by zero")
	}
	return math.Mod(plainNumber(a), plainNumber(b))
}`,
    needs: ['number'],
    imports: ['math']
  },

  power: { code: `func plainPower(a any, b any) any { return math.Pow(plainNumber(a), plainNumber(b)) }`, needs: ['number'], imports: ['math'] },

  items: {
    code: `func plainItems(value any) []any {
	switch shape := value.(type) {
	case []any:
		return shape
	case string:
		out := []any{}
		for _, letter := range shape {
			out = append(out, string(letter))
		}
		return out
	case *Thing:
		out := []any{}
		for _, name := range shape.Order {
			out = append(out, name)
		}
		return out
	}
	return []any{}
}`
  },

  range: {
    code: `// Plain counts up or down depending on the two numbers.
func plainRange(from any, to any, step any) []any {
	move := math.Abs(plainNumber(step))
	if move == 0 {
		move = 1
	}
	finish := plainNumber(to)
	if finish < plainNumber(from) {
		move = -move
	}
	out := []any{}
	for at := plainNumber(from); map[bool]bool{true: at <= finish, false: at >= finish}[move > 0]; at += move {
		out = append(out, at)
	}
	return out
}`,
    needs: ['number'],
    imports: ['math']
  },

  item: {
    code: `// Lists count from 1 in Plain.
func plainItem(collection any, index any) any {
	at := int(plainNumber(index))
	switch shape := collection.(type) {
	case string:
		letters := []rune(shape)
		place := at - 1
		if at < 0 {
			place = len(letters) + at
		}
		if place < 0 || place >= len(letters) {
			return nil
		}
		return string(letters[place])
	case []any:
		place := at - 1
		if at < 0 {
			place = len(shape) + at
		}
		if place < 0 || place >= len(shape) {
			return nil
		}
		return shape[place]
	}
	return nil
}`,
    needs: ['number']
  },

  setItem: {
    code: `func plainSetItem(collection any, index any, value any) any {
	at := int(plainNumber(index))
	if list, ok := collection.([]any); ok {
		place := at - 1
		if at < 0 {
			place = len(list) + at
		}
		if place >= 0 && place < len(list) {
			list[place] = value
		}
	}
	return collection
}`,
    needs: ['number']
  },

  first: { code: `func plainFirst(collection any) any { return plainItem(collection, 1.0) }`, needs: ['item'] },
  last: { code: `func plainLast(collection any) any { return plainItem(collection, float64(plainLength(collection))) }`, needs: ['item', 'length'] },

  length: {
    code: `func plainLength(value any) int {
	switch shape := value.(type) {
	case string:
		return len([]rune(shape))
	case []any:
		return len(shape)
	case *Thing:
		return len(shape.Order)
	}
	return 0
}`
  },

  total: { code: `func plainTotal(collection any) any {\n\tsum := 0.0\n\tfor _, item := range plainItems(collection) {\n\t\tsum += plainNumber(item)\n\t}\n\treturn sum\n}`, needs: ['items', 'number'] },
  average: { code: `func plainAverage(collection any) any {\n\tall := plainItems(collection)\n\tif len(all) == 0 {\n\t\treturn 0.0\n\t}\n\treturn plainNumber(plainTotal(all)) / float64(len(all))\n}`, needs: ['items', 'total'] },
  highest: { code: `func plainHighest(collection any) any {\n\tvar best any\n\tfor _, item := range plainItems(collection) {\n\t\tif best == nil || plainNumber(item) > plainNumber(best) {\n\t\t\tbest = item\n\t\t}\n\t}\n\treturn best\n}`, needs: ['items', 'number'] },
  lowest: { code: `func plainLowest(collection any) any {\n\tvar best any\n\tfor _, item := range plainItems(collection) {\n\t\tif best == nil || plainNumber(item) < plainNumber(best) {\n\t\t\tbest = item\n\t\t}\n\t}\n\treturn best\n}`, needs: ['items', 'number'] },

  sorted: {
    code: `func plainSorted(collection any) any {
	all := plainItems(collection)
	copied := make([]any, len(all))
	copy(copied, all)
	numbers := true
	for _, item := range copied {
		if _, ok := item.(float64); !ok {
			numbers = false
		}
	}
	sort.SliceStable(copied, func(a int, b int) bool {
		if numbers {
			return plainNumber(copied[a]) < plainNumber(copied[b])
		}
		return plainText(copied[a]) < plainText(copied[b])
	})
	return copied
}`,
    needs: ['items', 'number', 'text'],
    imports: ['sort']
  },

  reversed: { code: `func plainReversed(collection any) any {\n\tall := plainItems(collection)\n\tout := []any{}\n\tfor at := len(all) - 1; at >= 0; at-- {\n\t\tout = append(out, all[at])\n\t}\n\treturn out\n}`, needs: ['items'] },
  shuffled: { code: `func plainShuffled(collection any) any {\n\tall := plainItems(collection)\n\tmixed := make([]any, len(all))\n\tcopy(mixed, all)\n\tfor at := len(mixed) - 1; at > 0; at-- {\n\t\tother := rand.Intn(at + 1)\n\t\tmixed[at], mixed[other] = mixed[other], mixed[at]\n\t}\n\treturn mixed\n}`, needs: ['items'], imports: ['math/rand'] },
  copy: { code: `func plainCopy(value any) any {\n\tif list, ok := value.([]any); ok {\n\t\tout := make([]any, len(list))\n\t\tcopy(out, list)\n\t\treturn out\n\t}\n\treturn value\n}` },
  joinWith: { code: `func plainJoinWith(collection any, separator any) any {\n\tparts := []string{}\n\tfor _, item := range plainItems(collection) {\n\t\tparts = append(parts, plainText(item))\n\t}\n\treturn strings.Join(parts, plainText(separator))\n}`, needs: ['items', 'text'], imports: ['strings'] },
  position: {
    code: `func plainPosition(collection any, value any) any {
	if text, ok := collection.(string); ok {
		return float64(strings.Index(text, plainText(value)) + 1)
	}
	for at, item := range plainItems(collection) {
		if plainSame(item, value) {
			return float64(at + 1)
		}
	}
	return 0.0
}`,
    needs: ['items', 'same', 'text'],
    imports: ['strings']
  },

  has: {
    code: `func plainHas(container any, value any) bool {
	if text, ok := container.(string); ok {
		return strings.Contains(text, plainText(value))
	}
	for _, item := range plainItems(container) {
		if plainSame(item, value) {
			return true
		}
	}
	return false
}`,
    needs: ['items', 'same', 'text'],
    imports: ['strings']
  },

  addTo: {
    code: `// "add x to name" grows a list, adds to a number, or joins text.
func plainAddTo(current any, value any) any {
	switch shape := current.(type) {
	case []any:
		return append(shape, value)
	case string:
		return shape + plainText(value)
	}
	return plainNumber(current) + plainNumber(value)
}`,
    needs: ['text', 'number']
  },

  removeValue: {
    code: `func plainRemoveValue(collection any, value any) any {
	list, ok := collection.([]any)
	if !ok {
		return collection
	}
	for at, item := range list {
		if plainSame(item, value) {
			return append(list[:at], list[at+1:]...)
		}
	}
	return list
}`,
    needs: ['same']
  },

  removeAt: {
    code: `func plainRemoveAt(collection any, index any) any {
	at := int(plainNumber(index))
	list, ok := collection.([]any)
	if ok && at >= 1 && at <= len(list) {
		return append(list[:at-1], list[at:]...)
	}
	return collection
}`,
    needs: ['number']
  },

  emptied: { code: `func plainEmptied(value any) any {\n\tif _, ok := value.([]any); ok {\n\t\treturn []any{}\n\t}\n\treturn nil\n}` },

  field: {
    code: `// "name of thing" - a value on a Thing, or the length of a list or text.
func plainField(thing any, name string) any {
	switch shape := thing.(type) {
	case *Thing:
		for key, value := range shape.Fields {
			if strings.EqualFold(key, name) {
				return value
			}
		}
		return nil
	case []any, string:
		lowered := strings.ToLower(name)
		if lowered == "length" || lowered == "size" || lowered == "count" {
			return float64(plainLength(shape))
		}
	}
	return nil
}`,
    needs: ['length'],
    imports: ['strings']
  },

  setField: {
    code: `func plainSetField(thing any, name string, value any) {
	holder, ok := thing.(*Thing)
	if !ok {
		return
	}
	for key := range holder.Fields {
		if strings.EqualFold(key, name) {
			holder.Fields[key] = value
			return
		}
	}
	plainOwn(holder, name, value)
}`,
    imports: ['strings']
  },

  keys: { code: `func plainKeys(thing any) any {\n\tout := []any{}\n\tif holder, ok := thing.(*Thing); ok {\n\t\tfor _, name := range holder.Order {\n\t\t\tout = append(out, name)\n\t\t}\n\t}\n\treturn out\n}` },
  values: { code: `func plainValues(thing any) any {\n\tout := []any{}\n\tif holder, ok := thing.(*Thing); ok {\n\t\tfor _, name := range holder.Order {\n\t\t\tout = append(out, holder.Fields[name])\n\t\t}\n\t}\n\treturn out\n}` },
  value: { code: `func plainValue(thing any, key any) any { return plainField(thing, plainText(key)) }`, needs: ['field', 'text'] },
  setValue: { code: `func plainSetValue(thing any, key any, value any) { plainSetField(thing, plainText(key), value) }`, needs: ['setField', 'text'] },
  hasKey: { code: `func plainHasKey(thing any, key any) bool {\n\tif holder, ok := thing.(*Thing); ok {\n\t\tfor name := range holder.Fields {\n\t\t\tif strings.EqualFold(name, plainText(key)) {\n\t\t\t\treturn true\n\t\t\t}\n\t\t}\n\t}\n\treturn false\n}`, needs: ['text'], imports: ['strings'] },

  tell: {
    code: `// Kinds keep their actions in a table, looked up by name, walking up
// through whatever they were based on.
func plainTell(thing any, action string, args []any) any {
	holder, ok := thing.(*Thing)
	if !ok {
		panic("I can only tell one of your own kinds to do something")
	}
	for kind := holder.Kind; kind != ""; kind = plainBases[kind] {
		if table, found := plainActions[kind]; found {
			if doing, found := table[action]; found {
				return doing(holder, args)
			}
		}
	}
	panic("A " + holder.Kind + " does not know how to \\"" + action + "\\"")
}`
  },

  isKind: {
    code: `func plainIsKind(thing any, wanted string) bool {
	holder, ok := thing.(*Thing)
	if !ok {
		return false
	}
	for kind := holder.Kind; kind != ""; kind = plainBases[kind] {
		if kind == wanted {
			return true
		}
	}
	return false
}`
  },

  kindName: {
    code: `func plainKindName(thing any) any {
	if holder, ok := thing.(*Thing); ok && holder.Kind != "" {
		return holder.Kind
	}
	return plainKindOf(thing)
}`,
    needs: ['kindOf']
  },

  run: {
    code: `func plainRun(action any, args []any) any {
	switch doing := action.(type) {
	case func() any:
		return doing()
	case func(any) any:
		return doing(plainAt(args, 0))
	case func(any, any) any:
		return doing(plainAt(args, 0), plainAt(args, 1))
	}
	panic("That is not an action, so I cannot run it")
}`
  },

  try: {
    code: `// Go has no exceptions; recover is how something that went wrong is
// caught, so the two halves of a "try" are handed over as functions.
func plainTry(risky func(), instead func(problem any)) {
	defer func() {
		if wrong := recover(); wrong != nil {
			instead(plainProblemText(wrong))
		}
	}()
	risky()
}

func plainProblemText(wrong any) string {
	if problem, ok := wrong.(error); ok {
		return problem.Error()
	}
	return plainText(wrong)
}`,
    needs: ['text']
  },

  upper: { code: `func plainUpper(text any) any { return strings.ToUpper(plainText(text)) }`, needs: ['text'], imports: ['strings'] },
  lower: { code: `func plainLower(text any) any { return strings.ToLower(plainText(text)) }`, needs: ['text'], imports: ['strings'] },
  trimmed: { code: `func plainTrimmed(text any) any { return strings.TrimSpace(plainText(text)) }`, needs: ['text'], imports: ['strings'] },
  split: { code: `func plainSplit(text any, separator any) any {\n\tout := []any{}\n\tfor _, part := range strings.Split(plainText(text), plainText(separator)) {\n\t\tout = append(out, part)\n\t}\n\treturn out\n}`, needs: ['text'], imports: ['strings'] },
  part: {
    code: `func plainPart(text any, start any, finish any) any {
	letters := []rune(plainText(text))
	from := int(plainNumber(start)) - 1
	if from < 0 {
		from = 0
	}
	to := int(plainNumber(finish))
	if to > len(letters) {
		to = len(letters)
	}
	if from >= to {
		return ""
	}
	return string(letters[from:to])
}`,
    needs: ['text', 'number']
  },
  replace: { code: `func plainReplace(text any, find any, instead any) any { return strings.ReplaceAll(plainText(text), plainText(find), plainText(instead)) }`, needs: ['text'], imports: ['strings'] },
  startsWith: { code: `func plainStartsWith(text any, prefix any) bool { return strings.HasPrefix(plainText(text), plainText(prefix)) }`, needs: ['text'], imports: ['strings'] },
  endsWith: { code: `func plainEndsWith(text any, suffix any) bool { return strings.HasSuffix(plainText(text), plainText(suffix)) }`, needs: ['text'], imports: ['strings'] },

  matches: { code: `func plainMatches(text any, mark any) bool {\n\tfound, problem := regexp.MatchString(plainText(mark), plainText(text))\n\tif problem != nil {\n\t\tpanic(problem.Error())\n\t}\n\treturn found\n}`, needs: ['text'], imports: ['regexp'] },
  firstMatch: { code: `func plainFirstMatch(text any, mark any) any { return regexp.MustCompile(plainText(mark)).FindString(plainText(text)) }`, needs: ['text'], imports: ['regexp'] },
  allMatches: { code: `func plainAllMatches(text any, mark any) any {\n\tout := []any{}\n\tfor _, one := range regexp.MustCompile(plainText(mark)).FindAllString(plainText(text), -1) {\n\t\tout = append(out, one)\n\t}\n\treturn out\n}`, needs: ['text'], imports: ['regexp'] },
  replacePattern: { code: `func plainReplacePattern(text any, mark any, instead any) any { return regexp.MustCompile(plainText(mark)).ReplaceAllString(plainText(text), plainText(instead)) }`, needs: ['text'], imports: ['regexp'] },

  whole: { code: `func plainWhole(value any) int64 { return int64(plainNumber(value)) }`, needs: ['number'] },

  round: { code: `func plainRound(value any) any { return math.Floor(plainNumber(value) + 0.5) }`, needs: ['number'], imports: ['math'] },
  roundTo: { code: `func plainRoundTo(value any, places any) any {\n\tscale := math.Pow(10, math.Floor(plainNumber(places)))\n\treturn math.Floor(plainNumber(value)*scale+0.5) / scale\n}`, needs: ['number'], imports: ['math'] },
  floor: { code: `func plainFloor(value any) any { return math.Floor(plainNumber(value)) }`, needs: ['number'], imports: ['math'] },
  ceiling: { code: `func plainCeiling(value any) any { return math.Ceil(plainNumber(value)) }`, needs: ['number'], imports: ['math'] },
  absolute: { code: `func plainAbsolute(value any) any { return math.Abs(plainNumber(value)) }`, needs: ['number'], imports: ['math'] },
  squareRoot: { code: `func plainSquareRoot(value any) any { return math.Sqrt(math.Max(0, plainNumber(value))) }`, needs: ['number'], imports: ['math'] },
  sine: { code: `func plainSine(value any) any { return math.Sin(plainNumber(value)) }`, needs: ['number'], imports: ['math'] },
  cosine: { code: `func plainCosine(value any) any { return math.Cos(plainNumber(value)) }`, needs: ['number'], imports: ['math'] },
  tangent: { code: `func plainTangent(value any) any { return math.Tan(plainNumber(value)) }`, needs: ['number'], imports: ['math'] },
  exponent: { code: `func plainExponent(value any) any { return math.Exp(plainNumber(value)) }`, needs: ['number'], imports: ['math'] },
  logarithm: { code: `func plainLogarithm(value any) any { return math.Log(math.Max(1e-300, plainNumber(value))) }`, needs: ['number'], imports: ['math'] },
  smaller: { code: `func plainSmaller(a any, b any) any { return math.Min(plainNumber(a), plainNumber(b)) }`, needs: ['number'], imports: ['math'] },
  bigger: { code: `func plainBigger(a any, b any) any { return math.Max(plainNumber(a), plainNumber(b)) }`, needs: ['number'], imports: ['math'] },
  pi: { code: `func plainPi() any { return math.Pi }`, imports: ['math'] },
  e: { code: `func plainE() any { return math.E }`, imports: ['math'] },

  randomBetween: { code: `func plainRandomBetween(low any, high any) any {\n\tfrom := int(math.Ceil(plainNumber(low)))\n\tto := int(math.Floor(plainNumber(high)))\n\tif to < from {\n\t\treturn float64(from)\n\t}\n\treturn float64(from + rand.Intn(to-from+1))\n}`, needs: ['number'], imports: ['math', 'math/rand'] },
  randomNumber: { code: `func plainRandomNumber() any { return rand.Float64() }`, imports: ['math/rand'] },
  randomItem: { code: `func plainRandomItem(collection any) any {\n\tall := plainItems(collection)\n\tif len(all) == 0 {\n\t\treturn nil\n\t}\n\treturn all[rand.Intn(len(all))]\n}`, needs: ['items'], imports: ['math/rand'] },

  timeNow: { code: `func plainTimeNow() any { return float64(time.Now().UnixMilli()) }`, imports: ['time'] },
  today: { code: `func plainToday() any { return time.Now().Format("2006-01-02") }`, imports: ['time'] },

  kindOf: {
    code: `func plainKindOf(value any) any {
	switch shape := value.(type) {
	case nil:
		return "nothing"
	case bool:
		return "a yes/no"
	case float64:
		return "a number"
	case string:
		return "text"
	case []any:
		return "a list"
	case *Thing:
		_ = shape
		return "a thing"
	}
	return "an action"
}`
  },

  changedBy: { code: `func plainChangedBy(collection any, action any) any {\n\tout := []any{}\n\tfor _, item := range plainItems(collection) {\n\t\tout = append(out, plainRun(action, []any{item}))\n\t}\n\treturn out\n}`, needs: ['items', 'run'] },
  keptWhere: { code: `func plainKeptWhere(collection any, action any) any {\n\tout := []any{}\n\tfor _, item := range plainItems(collection) {\n\t\tif plainTruthy(plainRun(action, []any{item})) {\n\t\t\tout = append(out, item)\n\t\t}\n\t}\n\treturn out\n}`, needs: ['items', 'truthy', 'run'] },
  addedUpBy: { code: `func plainAddedUpBy(collection any, action any) any {\n\tsum := 0.0\n\tfor _, item := range plainItems(collection) {\n\t\tsum += plainNumber(plainRun(action, []any{item}))\n\t}\n\treturn sum\n}`, needs: ['items', 'number', 'run'] },

  ask: {
    code: `// Reads one line, the way "ask ... into ..." does in Plain.
func plainAsk(question any) any {
	fmt.Print(plainText(question))
	reader := bufio.NewReader(os.Stdin)
	answer, _ := reader.ReadString('\\n')
	answer = strings.TrimRight(answer, "\\r\\n")
	if found, problem := strconv.ParseFloat(answer, 64); problem == nil {
		return found
	}
	return answer
}`,
    needs: ['text'],
    imports: ['bufio', 'fmt', 'os', 'strconv', 'strings']
  }
};
