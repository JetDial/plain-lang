// Plain -> Java.
//
// Everything is an Object, which is how Plain thinks: a name holds whatever
// you put in it. Kinds become classes inside the program, actions become
// static methods, and the rest becomes main.

import { Emitter } from './emitter.js';

const RESERVED = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while', 'var', 'record', 'yield',
  'true', 'false', 'null', 'main', 'program', 'plain', 'string', 'object',
  'system', 'math', 'list', 'map'
]);

export class JavaEmitter extends Emitter {
  get name() { return 'Java'; }
  get extension() { return '.java'; }
  get indentText() { return '    '; }
  get reserved() { return RESERVED; }

  helperCall(name, args) { return `Plain.${name}(${args.join(', ')})`; }
  declare(name, value) { return `Object ${name} = ${value}`; }
  forEachHeader(name, iterable) { return `for (Object ${name} : ${iterable}) {`; }
  functionHeader(name, params) {
    return `static Object ${name}(${params.map(p => `Object ${p}`).join(', ')}) {`;
  }
  methodHeader(name, params) {
    return `public Object ${name}(${params.map(p => `Object ${p}`).join(', ')}) {`;
  }
  classHeader(name, base) { return `static class ${name}${base ? ` extends ${base}` : ''} {`; }
  catchHeader(name) { return `catch (Exception ${name}) {`; }
  problemText(name) { return `${name}.getMessage()`; }
  showStatement(value) { return `System.out.println(${value})`; }
  exitProgram() { return 'System.exit(0)'; }
  raiseProblem(message) { return `throw new RuntimeException(String.valueOf(${message}))`; }
  power(left, right) { return `Math.pow(Plain.number(${left}), Plain.number(${right}))`; }
  isKindOf(value, kind) { return `(${value} instanceof ${kind})`; }
  kindNameOf(value) { return `${value}.getClass().getSimpleName()`; }
  numberLiteral(value) { return `${value}d`; }
  listLiteral(items) { return this.helper('list', items); }
  recordLiteral(pairs) {
    return this.helper('thing', pairs.flatMap(([key, value]) => [JSON.stringify(key), value]));
  }
  newInstance(kind, pairs) { return `new ${kind}(${this.recordLiteral(pairs)})`; }

  // Java cannot call a method on something typed Object, so every one goes
  // through the same helper, which finds it by name.
  methodCall(object, method, args) {
    return this.helper('tell', [object, JSON.stringify(method), ...args]);
  }

  callValue(action, args) { return this.helper('run', [action, ...args]); }
  callFunction(name, args) { return `${name}(${args.join(', ')})`; }
  actionReference(name) { return `(java.util.function.Function<Object, Object>) Program::${name}`; }

  fieldAccess(object, field) {
    if (object === 'this') return `this.${field}`;
    return this.helper('field', [object, JSON.stringify(field)]);
  }

  assignField(object, field, value) {
    if (object === 'this') return `this.${field} = ${value}`;
    return this.helper('setField', [object, JSON.stringify(field), value]);
  }

  finishFunctionBody(block) {
    const last = block && block.body.length ? block.body[block.body.length - 1] : null;
    if (!last || last.type !== 'Return') this.writeLine('return null');
  }

  emitConstructor(node) {
    const inherited = this.inheritedFields(node);
    this.write('');
    for (const field of node.fields) {
      const name = this.fieldName(field.name);
      if (!inherited.has(name)) this.writeLine(`public Object ${name}`);
    }
    this.write('');
    this.open(`${this.kindName(node.name)}(java.util.Map<String, Object> values) {`);
    if (node.base) this.writeLine('super(values)');
    for (const field of node.fields) {
      this.writeLine(`this.${this.fieldName(field.name)} = ${field.value ? this.expression(field.value) : 'null'}`);
    }
    this.writeLine(this.helper('fill', ['this', 'values']));
    this.close();
  }

  // Kinds and actions go inside one class, and the rest becomes main.
  translate(program, meta = {}) {
    this.collectKinds(program);

    this.depth = 1;
    const kinds = this.capture(() => {
      for (const node of program.body) if (node.type === 'Kind') this.statement(node);
    });
    const actions = this.capture(() => {
      for (const node of program.body) if (node.type === 'Function') this.statement(node);
    });

    this.depth = 2;
    const main = this.capture(() => {
      for (const node of program.body) {
        if (node.type === 'Kind' || node.type === 'Function') continue;
        this.statement(node);
      }
    });
    this.depth = 0;

    if (this.unsupported.length) return Emitter.prototype.translate.call(this, program, meta);

    const out = [
      this.comment(`Translated from ${meta.file || 'a Plain program'} by Plain ${meta.version || ''}`.trim()),
      this.comment('Plain is the source; this file is what it means in Java.'),
      '',
      'import java.util.*;',
      ''
    ];

    // Java runs the first class in a file, so the program goes above the
    // helpers rather than below them.
    out.push('public class Program {');
    if (kinds.length) out.push(...kinds, '');
    if (actions.length) out.push(...actions, '');
    out.push('    public static void main(String[] args) {');
    out.push(...main);
    out.push('    }');
    out.push('}');

    const helpers = this.emitHelpers();
    if (helpers) out.push('', helpers);

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

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
    return ['class Plain {', ...body, '}'].join('\n');
  }
}

const HELPERS = {
  text: {
    code: `    // Values written the way Plain writes them.
    static String text(Object value) { return text(value, 0); }

    static String text(Object value, int depth) {
        if (value == null) return "nothing";
        if (value instanceof Boolean) return ((Boolean) value) ? "yes" : "no";
        if (value instanceof Number) return numberText((Number) value);
        if (value instanceof String) return depth == 0 ? (String) value : "\\"" + value + "\\"";
        if (value instanceof List<?> list) {
            List<String> parts = new ArrayList<>();
            for (Object item : list) parts.add(text(item, depth + 1));
            return "[" + String.join(", ", parts) + "]";
        }
        if (value instanceof Map<?, ?> map) {
            List<String> parts = new ArrayList<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) parts.add(entry.getKey() + ": " + text(entry.getValue(), depth + 1));
            return "{" + String.join(", ", parts) + "}";
        }
        if (value instanceof java.util.function.Function) return "<action>";
        List<String> parts = new ArrayList<>();
        for (java.lang.reflect.Field one : value.getClass().getFields()) {
            try { parts.add(one.getName() + ": " + text(one.get(value), depth + 1)); } catch (Exception ignored) { }
        }
        return "a " + value.getClass().getSimpleName() + " (" + String.join(", ", parts) + ")";
    }`,
    needs: ['numberText']
  },

  numberText: {
    code: `    static String numberText(Number value) {
        double number = value.doubleValue();
        if (number == Math.floor(number) && !Double.isInfinite(number)) return String.valueOf((long) number);
        java.math.BigDecimal rounded = new java.math.BigDecimal(number).round(new java.math.MathContext(12));
        return rounded.stripTrailingZeros().toPlainString();
    }`
  },

  number: {
    code: `    static double number(Object value) {
        if (value == null) return 0;
        if (value instanceof Boolean) return ((Boolean) value) ? 1 : 0;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try { return Double.parseDouble(String.valueOf(value)); } catch (Exception problem) { return 0; }
    }`
  },

  truthy: {
    code: `    static boolean truthy(Object value) {
        if (value == null) return false;
        if (value instanceof Boolean) return (Boolean) value;
        if (value instanceof String) return !((String) value).isEmpty();
        if (value instanceof List<?> list) return !list.isEmpty();
        if (value instanceof Number) return number(value) != 0;
        return true;
    }`,
    needs: ['number']
  },

  same: {
    code: `    static boolean same(Object a, Object b) {
        if (a == null || b == null) return a == null && b == null;
        if (a instanceof Boolean || b instanceof Boolean) return truthy(a) == truthy(b);
        if (a instanceof Number || b instanceof Number) return number(a) == number(b);
        if (a instanceof List<?> left && b instanceof List<?> right) {
            if (left.size() != right.size()) return false;
            for (int at = 0; at < left.size(); at++) if (!same(left.get(at), right.get(at))) return false;
            return true;
        }
        return a.equals(b);
    }`,
    needs: ['number', 'truthy']
  },

  list: {
    code: `    static List<Object> list(Object... items) {
        List<Object> out = new ArrayList<>();
        for (Object item : items) out.add(item);
        return out;
    }`
  },

  thing: {
    code: `    static Map<String, Object> thing(Object... pairs) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int at = 0; at + 1 < pairs.length; at += 2) out.put(String.valueOf(pairs[at]), pairs[at + 1]);
        return out;
    }`
  },

  add: {
    code: `    static Object add(Object a, Object b) {
        if (a instanceof String || b instanceof String) return text(a) + text(b);
        return number(a) + number(b);
    }`,
    needs: ['text', 'number']
  },

  join2: { code: `    static String join2(Object a, Object b) { return text(a) + text(b); }`, needs: ['text'] },

  divide: {
    code: `    static double divide(Object a, Object b) {
        if (number(b) == 0) throw new RuntimeException("I cannot divide by zero");
        return number(a) / number(b);
    }`,
    needs: ['number']
  },

  remainder: {
    code: `    static double remainder(Object a, Object b) {
        if (number(b) == 0) throw new RuntimeException("I cannot divide by zero");
        return number(a) % number(b);
    }`,
    needs: ['number']
  },

  items: {
    code: `    static List<Object> items(Object value) {
        List<Object> out = new ArrayList<>();
        if (value == null) return out;
        if (value instanceof String text) {
            for (char letter : text.toCharArray()) out.add(String.valueOf(letter));
            return out;
        }
        if (value instanceof Map<?, ?> map) { for (Object key : map.keySet()) out.add(key); return out; }
        if (value instanceof List<?> list) { out.addAll(list); return out; }
        return out;
    }`
  },

  range: {
    code: `    // Plain counts up or down depending on the two numbers.
    static List<Object> range(Object from, Object to, Object step) {
        List<Object> out = new ArrayList<>();
        double move = Math.abs(number(step));
        if (move == 0) move = 1;
        double finish = number(to);
        if (finish < number(from)) move = -move;
        for (double at = number(from); move > 0 ? at <= finish : at >= finish; at += move) out.add(at);
        return out;
    }`,
    needs: ['number']
  },

  item: {
    code: `    // Lists count from 1 in Plain.
    static Object item(Object collection, Object index) {
        int at = (int) number(index);
        if (collection instanceof String text) {
            int place = at < 0 ? text.length() + at : at - 1;
            return place >= 0 && place < text.length() ? String.valueOf(text.charAt(place)) : null;
        }
        if (collection instanceof List<?> list) {
            int place = at < 0 ? list.size() + at : at - 1;
            return place >= 0 && place < list.size() ? list.get(place) : null;
        }
        return null;
    }`,
    needs: ['number']
  },

  setItem: {
    code: `    @SuppressWarnings("unchecked")
    static Object setItem(Object collection, Object index, Object value) {
        int at = (int) number(index);
        if (collection instanceof List<?> list) {
            int place = at < 0 ? list.size() + at : at - 1;
            if (place >= 0 && place < list.size()) ((List<Object>) list).set(place, value);
        }
        return collection;
    }`,
    needs: ['number']
  },

  first: { code: `    static Object first(Object collection) { return item(collection, 1d); }`, needs: ['item'] },
  last: { code: `    static Object last(Object collection) { return item(collection, (double) length(collection)); }`, needs: ['item', 'length'] },

  length: {
    code: `    static int length(Object value) {
        if (value instanceof String text) return text.length();
        if (value instanceof List<?> list) return list.size();
        if (value instanceof Map<?, ?> map) return map.size();
        return 0;
    }`
  },

  total: { code: `    static double total(Object collection) { double sum = 0; for (Object item : items(collection)) sum += number(item); return sum; }`, needs: ['items', 'number'] },
  average: { code: `    static double average(Object collection) { List<Object> all = items(collection); return all.isEmpty() ? 0 : total(all) / all.size(); }`, needs: ['items', 'total'] },
  highest: { code: `    static Object highest(Object collection) { Object best = null; for (Object item : items(collection)) if (best == null || number(item) > number(best)) best = item; return best; }`, needs: ['items', 'number'] },
  lowest: { code: `    static Object lowest(Object collection) { Object best = null; for (Object item : items(collection)) if (best == null || number(item) < number(best)) best = item; return best; }`, needs: ['items', 'number'] },

  sorted: {
    code: `    static List<Object> sorted(Object collection) {
        List<Object> copy = new ArrayList<>(items(collection));
        boolean numbers = true;
        for (Object item : copy) if (!(item instanceof Number)) numbers = false;
        if (numbers) copy.sort((a, b) -> Double.compare(number(a), number(b)));
        else copy.sort((a, b) -> text(a).compareTo(text(b)));
        return copy;
    }`,
    needs: ['items', 'number', 'text']
  },

  reversed: { code: `    static List<Object> reversed(Object collection) { List<Object> copy = new ArrayList<>(items(collection)); Collections.reverse(copy); return copy; }`, needs: ['items'] },
  shuffled: { code: `    static List<Object> shuffled(Object collection) { List<Object> mixed = new ArrayList<>(items(collection)); for (int at = mixed.size() - 1; at > 0; at--) { int other = dice.nextInt(at + 1); Object held = mixed.get(at); mixed.set(at, mixed.get(other)); mixed.set(other, held); } return mixed; }`, needs: ['items', 'randomBetween'] },
  copy: { code: `    static Object copy(Object value) { if (value instanceof List<?> list) return new ArrayList<Object>(list); if (value instanceof Map<?, ?> map) return new LinkedHashMap<Object, Object>(map); return value; }` },
  joinWith: {
    code: `    static String joinWith(Object collection, Object separator) {
        List<String> parts = new ArrayList<>();
        for (Object item : items(collection)) parts.add(text(item));
        return String.join(text(separator), parts);
    }`,
    needs: ['items', 'text']
  },
  position: {
    code: `    static int position(Object collection, Object value) {
        if (collection instanceof String text) return text.indexOf(text(value)) + 1;
        List<Object> all = items(collection);
        for (int at = 0; at < all.size(); at++) if (same(all.get(at), value)) return at + 1;
        return 0;
    }`,
    needs: ['items', 'same', 'text']
  },

  has: {
    code: `    static boolean has(Object container, Object value) {
        if (container instanceof String text) return text.contains(text(value));
        for (Object item : items(container)) if (same(item, value)) return true;
        return false;
    }`,
    needs: ['items', 'same', 'text']
  },

  addTo: {
    code: `    // "add x to name" grows a list, adds to a number, or joins text.
    @SuppressWarnings("unchecked")
    static Object addTo(Object current, Object value) {
        if (current instanceof List<?> list) { ((List<Object>) list).add(value); return list; }
        if (current instanceof String text) return text + text(value);
        return number(current) + number(value);
    }`,
    needs: ['text', 'number']
  },

  removeValue: {
    code: `    static Object removeValue(Object collection, Object value) {
        if (collection instanceof List<?> list) {
            for (int at = 0; at < list.size(); at++) if (same(list.get(at), value)) { list.remove(at); break; }
        }
        return collection;
    }`,
    needs: ['same']
  },

  removeAt: {
    code: `    static Object removeAt(Object collection, Object index) {
        int at = (int) number(index);
        if (collection instanceof List<?> list && at >= 1 && at <= list.size()) list.remove(at - 1);
        return collection;
    }`,
    needs: ['number']
  },

  emptied: { code: `    static Object emptied(Object value) { if (value instanceof List<?> list) { list.clear(); return list; } return null; }` },

  field: {
    code: `    // "name of thing" - a key in a map, or a value on one of your kinds.
    static Object field(Object thing, String name) {
        if (thing == null) return null;
        if (thing instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (String.valueOf(entry.getKey()).equalsIgnoreCase(name)) return entry.getValue();
            }
            return null;
        }
        if (thing instanceof List<?> || thing instanceof String) {
            String lowered = name.toLowerCase();
            if (lowered.equals("length") || lowered.equals("size") || lowered.equals("count")) return (double) length(thing);
        }
        for (java.lang.reflect.Field one : thing.getClass().getFields()) {
            if (one.getName().equalsIgnoreCase(name)) {
                try { return one.get(thing); } catch (Exception ignored) { return null; }
            }
        }
        return null;
    }`,
    needs: ['length']
  },

  setField: {
    code: `    @SuppressWarnings("unchecked")
    static void setField(Object thing, String name, Object value) {
        if (thing instanceof Map<?, ?> map) {
            for (Object key : new ArrayList<>(map.keySet())) {
                if (String.valueOf(key).equalsIgnoreCase(name)) { ((Map<Object, Object>) map).put(key, value); return; }
            }
            ((Map<Object, Object>) map).put(name, value);
            return;
        }
        for (java.lang.reflect.Field one : thing.getClass().getFields()) {
            if (one.getName().equalsIgnoreCase(name)) {
                try { one.set(thing, value); } catch (Exception ignored) { }
                return;
            }
        }
    }`
  },

  fill: {
    code: `    // The values handed to "a new Dog with ..." land on the thing itself.
    static void fill(Object thing, Map<String, Object> values) {
        if (values == null) return;
        for (Map.Entry<String, Object> pair : values.entrySet()) setField(thing, pair.getKey(), pair.getValue());
    }`,
    needs: ['setField']
  },

  tell: {
    code: `    // Java cannot call a method on something typed Object, so it is found
    // by name here.
    static Object tell(Object thing, String action, Object... args) {
        if (thing == null) throw new RuntimeException("There is nothing here to ask");
        Class<?>[] shapes = new Class<?>[args.length];
        for (int at = 0; at < args.length; at++) shapes[at] = Object.class;
        try {
            java.lang.reflect.Method found = thing.getClass().getMethod(action, shapes);
            return found.invoke(thing, args);
        } catch (java.lang.reflect.InvocationTargetException problem) {
            Throwable inside = problem.getCause();
            throw inside instanceof RuntimeException ? (RuntimeException) inside : new RuntimeException(String.valueOf(inside.getMessage()));
        } catch (Exception problem) {
            throw new RuntimeException("A " + thing.getClass().getSimpleName() + " does not know how to \\"" + action + "\\"");
        }
    }`
  },

  run: {
    code: `    @SuppressWarnings("unchecked")
    static Object run(Object action, Object... args) {
        if (action instanceof java.util.function.Function) {
            return ((java.util.function.Function<Object, Object>) action).apply(args.length > 0 ? args[0] : null);
        }
        throw new RuntimeException("That is not an action, so I cannot run it");
    }`
  },

  keys: {
    code: `    static List<Object> keys(Object thing) {
        List<Object> out = new ArrayList<>();
        if (thing instanceof Map<?, ?> map) { for (Object key : map.keySet()) out.add(key); return out; }
        if (thing != null) for (java.lang.reflect.Field one : thing.getClass().getFields()) out.add(one.getName());
        return out;
    }`
  },
  values: { code: `    static List<Object> values(Object thing) { List<Object> out = new ArrayList<>(); for (Object key : keys(thing)) out.add(field(thing, String.valueOf(key))); return out; }`, needs: ['keys', 'field'] },
  value: { code: `    static Object value(Object thing, Object key) { return field(thing, text(key)); }`, needs: ['field', 'text'] },
  setValue: { code: `    static void setValue(Object thing, Object key, Object value) { setField(thing, text(key), value); }`, needs: ['setField', 'text'] },
  hasKey: { code: `    static boolean hasKey(Object thing, Object key) { for (Object name : keys(thing)) if (text(name).equalsIgnoreCase(text(key))) return true; return false; }`, needs: ['keys', 'text'] },

  upper: { code: `    static String upper(Object text) { return text(text).toUpperCase(); }`, needs: ['text'] },
  lower: { code: `    static String lower(Object text) { return text(text).toLowerCase(); }`, needs: ['text'] },
  trimmed: { code: `    static String trimmed(Object text) { return text(text).trim(); }`, needs: ['text'] },
  split: {
    code: `    static List<Object> split(Object whole, Object separator) {
        List<Object> out = new ArrayList<>();
        for (String part : text(whole).split(java.util.regex.Pattern.quote(text(separator)), -1)) out.add(part);
        return out;
    }`,
    needs: ['text']
  },
  part: {
    code: `    static String part(Object whole, Object start, Object finish) {
        String all = text(whole);
        int from = Math.max(0, (int) number(start) - 1);
        int to = Math.min(all.length(), (int) number(finish));
        return from >= to ? "" : all.substring(from, to);
    }`,
    needs: ['text', 'number']
  },
  replace: { code: `    static String replace(Object whole, Object find, Object instead) { return text(whole).replace(text(find), text(instead)); }`, needs: ['text'] },
  startsWith: { code: `    static boolean startsWith(Object whole, Object prefix) { return text(whole).startsWith(text(prefix)); }`, needs: ['text'] },
  endsWith: { code: `    static boolean endsWith(Object whole, Object suffix) { return text(whole).endsWith(text(suffix)); }`, needs: ['text'] },

  matches: { code: `    static boolean matches(Object whole, Object mark) { return java.util.regex.Pattern.compile(text(mark)).matcher(text(whole)).find(); }`, needs: ['text'] },
  firstMatch: {
    code: `    static String firstMatch(Object whole, Object mark) {
        java.util.regex.Matcher found = java.util.regex.Pattern.compile(text(mark)).matcher(text(whole));
        return found.find() ? found.group() : "";
    }`,
    needs: ['text']
  },
  allMatches: {
    code: `    static List<Object> allMatches(Object whole, Object mark) {
        List<Object> out = new ArrayList<>();
        java.util.regex.Matcher found = java.util.regex.Pattern.compile(text(mark)).matcher(text(whole));
        while (found.find()) out.add(found.group());
        return out;
    }`,
    needs: ['text']
  },
  replacePattern: { code: `    static String replacePattern(Object whole, Object mark, Object instead) { return text(whole).replaceAll(text(mark), text(instead)); }`, needs: ['text'] },

  whole: { code: `    static long whole(Object value) { double n = number(value); return Double.isFinite(n) ? (long) n : 0; }`, needs: ['number'] },

  round: { code: `    static double round(Object value) { return Math.floor(number(value) + 0.5); }`, needs: ['number'] },
  roundTo: { code: `    static double roundTo(Object value, Object places) { double scale = Math.pow(10, Math.floor(number(places))); return Math.floor(number(value) * scale + 0.5) / scale; }`, needs: ['number'] },
  floor: { code: `    static double floor(Object value) { return Math.floor(number(value)); }`, needs: ['number'] },
  ceiling: { code: `    static double ceiling(Object value) { return Math.ceil(number(value)); }`, needs: ['number'] },
  absolute: { code: `    static double absolute(Object value) { return Math.abs(number(value)); }`, needs: ['number'] },
  squareRoot: { code: `    static double squareRoot(Object value) { return Math.sqrt(Math.max(0, number(value))); }`, needs: ['number'] },
  sine: { code: `    static double sine(Object value) { return Math.sin(number(value)); }`, needs: ['number'] },
  cosine: { code: `    static double cosine(Object value) { return Math.cos(number(value)); }`, needs: ['number'] },
  tangent: { code: `    static double tangent(Object value) { return Math.tan(number(value)); }`, needs: ['number'] },
  exponent: { code: `    static double exponent(Object value) { return Math.exp(number(value)); }`, needs: ['number'] },
  logarithm: { code: `    static double logarithm(Object value) { return Math.log(Math.max(1e-300, number(value))); }`, needs: ['number'] },
  smaller: { code: `    static double smaller(Object a, Object b) { return Math.min(number(a), number(b)); }`, needs: ['number'] },
  bigger: { code: `    static double bigger(Object a, Object b) { return Math.max(number(a), number(b)); }`, needs: ['number'] },
  pi: { code: `    static double pi() { return Math.PI; }` },
  e: { code: `    static double e() { return Math.E; }` },

  randomBetween: {
    code: `    static final Random dice = new Random();
    static double randomBetween(Object low, Object high) {
        int from = (int) Math.ceil(number(low));
        int to = (int) Math.floor(number(high));
        return from + dice.nextInt(Math.max(1, to - from + 1));
    }`,
    needs: ['number']
  },
  randomNumber: { code: `    static double randomNumber() { return dice.nextDouble(); }`, needs: ['randomBetween'] },
  randomItem: { code: `    static Object randomItem(Object collection) { List<Object> all = items(collection); return all.isEmpty() ? null : all.get(dice.nextInt(all.size())); }`, needs: ['items', 'randomBetween'] },

  timeNow: { code: `    static double timeNow() { return System.currentTimeMillis(); }` },
  today: { code: `    static String today() { return java.time.LocalDate.now().toString(); }` },

  kindOf: {
    code: `    static String kindOf(Object value) {
        if (value == null) return "nothing";
        if (value instanceof Boolean) return "a yes/no";
        if (value instanceof List<?>) return "a list";
        if (value instanceof Number) return "a number";
        if (value instanceof String) return "text";
        if (value instanceof java.util.function.Function) return "an action";
        return "a thing";
    }`
  },

  changedBy: { code: `    static List<Object> changedBy(Object collection, Object action) { List<Object> out = new ArrayList<>(); for (Object item : items(collection)) out.add(run(action, item)); return out; }`, needs: ['items', 'run'] },
  keptWhere: { code: `    static List<Object> keptWhere(Object collection, Object action) { List<Object> out = new ArrayList<>(); for (Object item : items(collection)) if (truthy(run(action, item))) out.add(item); return out; }`, needs: ['items', 'truthy', 'run'] },
  addedUpBy: { code: `    static double addedUpBy(Object collection, Object action) { double sum = 0; for (Object item : items(collection)) sum += number(run(action, item)); return sum; }`, needs: ['items', 'number', 'run'] },

  ask: {
    code: `    static final Scanner listening = new Scanner(System.in);
    // Reads one line, the way "ask ... into ..." does in Plain.
    static Object ask(Object question) {
        System.out.print(text(question));
        String answer = listening.hasNextLine() ? listening.nextLine() : "";
        try { return Double.parseDouble(answer); } catch (Exception problem) { return answer; }
    }`,
    needs: ['text']
  }
};
