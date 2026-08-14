// Plain -> C#.
//
// Everything is `dynamic`, which is how Plain thinks: a name holds whatever
// you put in it. Kinds become classes, actions become static methods, and the
// rest of the program becomes Main.

import { Emitter } from './emitter.js';

const RESERVED = new Set([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char',
  'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
  'do', 'double', 'dynamic', 'else', 'enum', 'event', 'explicit', 'extern',
  'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if',
  'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long',
  'namespace', 'new', 'null', 'object', 'operator', 'out', 'override',
  'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return',
  'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string',
  'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint',
  'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'var', 'virtual', 'void',
  'volatile', 'while', 'main', 'program', 'plain'
]);

export class CSharpEmitter extends Emitter {
  get name() { return 'C#'; }
  get extension() { return '.cs'; }
  get indentText() { return '    '; }
  get reserved() { return RESERVED; }

  helperCall(name, args) { return `Plain.${capital(name)}(${args.join(', ')})`; }
  declare(name, value) { return `dynamic ${name} = ${value}`; }
  forEachHeader(name, iterable) { return `foreach (dynamic ${name} in ${iterable}) {`; }
  functionHeader(name, params) {
    return `static dynamic ${name}(${params.map(p => `dynamic ${p}`).join(', ')}) {`;
  }
  methodHeader(name, params) {
    return `public dynamic ${name}(${params.map(p => `dynamic ${p}`).join(', ')}) {`;
  }
  classHeader(name, base) { return `public class ${name}${base ? ` : ${base}` : ''} {`; }
  catchHeader(name) { return `catch (Exception ${name}) {`; }
  problemText(name) { return `${name}.Message`; }
  showStatement(value) { return `Console.WriteLine(${value})`; }
  exitProgram() { return 'Environment.Exit(0)'; }
  raiseProblem(message) { return `throw new Exception(${message})`; }
  power(left, right) { return `Math.Pow(Plain.Number(${left}), Plain.Number(${right}))`; }
  isKindOf(value, kind) { return `(${value} is ${kind})`; }
  kindNameOf(value) { return `((object)${value}).GetType().Name`; }
  actionReference(name) { return `(Func<dynamic, dynamic>)${name}`; }
  callValue(action, args) { return `${action}(${args.join(', ')})`; }
  listLiteral(items) { return `new List<dynamic> { ${items.join(', ')} }`; }
  recordLiteral(pairs) {
    if (!pairs.length) return 'new Dictionary<string, dynamic>()';
    return `new Dictionary<string, dynamic> { ${pairs.map(([k, v]) => `{ ${JSON.stringify(k)}, ${v} }`).join(', ')} }`;
  }
  newInstance(kind, pairs) { return `new ${kind}(${this.recordLiteral(pairs)})`; }

  // A Plain thing may be a dictionary or one of your own kinds; a helper
  // decides which at the moment it is used.
  fieldAccess(object, field) {
    if (object === 'this') return `this.${field}`;
    return this.helper('field', [object, JSON.stringify(field)]);
  }

  assignField(object, field, value) {
    if (object === 'this') return `this.${field} = ${value}`;
    return this.helper('setField', [object, JSON.stringify(field), value]);
  }

  // Every action is declared `dynamic`, and C# will not accept a way out
  // that returns nothing at all.
  finishFunctionBody(block) {
    const last = block && block.body.length ? block.body[block.body.length - 1] : null;
    if (!last || last.type !== 'Return') this.writeLine('return null');
  }

  emitConstructor(node) {
    this.write('');
    // A value the kind above already has is not declared again, or it would
    // hide the one the base constructor fills in.
    const inherited = this.inheritedFields(node);
    for (const field of node.fields) {
      const name = this.fieldName(field.name);
      if (!inherited.has(name)) this.writeLine(`public dynamic ${name}`);
    }
    this.write('');
    const base = node.base ? ' : base(values)' : '';
    this.open(`public ${this.kindName(node.name)}(Dictionary<string, dynamic> values = null)${base} {`);
    for (const field of node.fields) {
      this.writeLine(`this.${this.fieldName(field.name)} = ${field.value ? this.expression(field.value) : 'null'}`);
    }
    this.writeLine(this.helper('fill', ['this', 'values']));
    this.close();
  }

  // Kinds go top level, actions become static methods, and everything else
  // becomes the body of Main.
  translate(program, meta = {}) {
    this.collectKinds(program);
    const kinds = this.capture(() => {
      for (const node of program.body) if (node.type === 'Kind') this.statement(node);
    });

    this.depth = 1;
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

    if (this.unsupported.length) {
      // Same complaint the other targets make.
      return Emitter.prototype.translate.call(this, program, meta);
    }

    const out = [
      this.comment(`Translated from ${meta.file || 'a Plain program'} by Plain ${meta.version || ''}`.trim()),
      this.comment('Plain is the source; this file is what it means in C#.'),
      '',
      'using System;',
      'using System.Collections;',
      'using System.Collections.Generic;',
      'using System.Linq;',
      ''
    ];

    const helpers = this.emitHelpers();
    if (helpers) out.push(helpers, '');
    if (kinds.length) out.push(...kinds, '');

    out.push('public static class Program {');
    if (actions.length) out.push(...actions, '');
    out.push('    public static void Main() {');
    out.push(...main);
    out.push('    }');
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
    for (const name of this.used) add(name);
    if (!wanted.size) return '';
    const body = Object.keys(HELPERS).filter(name => wanted.has(name)).map(name => HELPERS[name].code.trimEnd());
    return ['public static class Plain {', ...body, '}'].join('\n');
  }
}

function capital(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const HELPERS = {
  text: {
    code: `    // Values written the way Plain writes them.
    public static string Text(dynamic value, int depth = 0) {
        if (value == null) return "nothing";
        if (value is bool) return ((bool)value) ? "yes" : "no";
        if (value is int || value is long || value is double || value is float || value is decimal) return NumberText(value);
        if (value is string) return depth == 0 ? (string)value : "\\"" + value + "\\"";
        if (value is IList list) {
            var parts = new List<string>();
            foreach (var item in list) parts.Add(Text(item, depth + 1));
            return "[" + string.Join(", ", parts) + "]";
        }
        if (value is IDictionary map) {
            var parts = new List<string>();
            foreach (DictionaryEntry entry in map) parts.Add(entry.Key + ": " + Text(entry.Value, depth + 1));
            return "{" + string.Join(", ", parts) + "}";
        }
        if (value is Delegate) return "<action>";
        var fields = new List<string>();
        foreach (var field in ((object)value).GetType().GetFields()) {
            fields.Add(field.Name + ": " + Text(field.GetValue(value), depth + 1));
        }
        return "a " + ((object)value).GetType().Name + " (" + string.Join(", ", fields) + ")";
    }`,
    needs: ['numberText']
  },

  numberText: {
    code: `    public static string NumberText(dynamic value) {
        double number = Convert.ToDouble(value);
        if (number == Math.Floor(number) && !double.IsInfinity(number)) return ((long)number).ToString();
        return number.ToString("G12", System.Globalization.CultureInfo.InvariantCulture);
    }`
  },

  number: {
    code: `    public static double Number(dynamic value) {
        if (value == null) return 0;
        if (value is bool) return ((bool)value) ? 1 : 0;
        if (value is string) { double parsed; return double.TryParse((string)value, out parsed) ? parsed : 0; }
        try { return Convert.ToDouble(value); } catch { return 0; }
    }`
  },

  truthy: {
    code: `    public static bool Truthy(dynamic value) {
        if (value == null) return false;
        if (value is bool) return (bool)value;
        if (value is string) return ((string)value).Length > 0;
        if (value is IList list) return list.Count > 0;
        if (value is int || value is long || value is double || value is float) return Number(value) != 0;
        return true;
    }`,
    needs: ['number']
  },

  same: {
    code: `    public static bool Same(dynamic a, dynamic b) {
        if (a == null || b == null) return a == null && b == null;
        if (a is bool || b is bool) return Truthy(a) == Truthy(b);
        if (IsNumber(a) || IsNumber(b)) return Number(a) == Number(b);
        if (a is IList left && b is IList right) {
            if (left.Count != right.Count) return false;
            for (int at = 0; at < left.Count; at++) if (!Same(left[at], right[at])) return false;
            return true;
        }
        return a.Equals(b);
    }

    static bool IsNumber(dynamic value) {
        return value is int || value is long || value is double || value is float || value is decimal;
    }`,
    needs: ['number', 'truthy']
  },

  add: {
    code: `    public static dynamic Add(dynamic a, dynamic b) {
        if (a is string || b is string) return Text(a) + Text(b);
        return Number(a) + Number(b);
    }`,
    needs: ['text', 'number']
  },

  join2: { code: `    public static string Join2(dynamic a, dynamic b) { return Text(a) + Text(b); }`, needs: ['text'] },

  divide: {
    code: `    public static double Divide(dynamic a, dynamic b) {
        if (Number(b) == 0) throw new Exception("I cannot divide by zero");
        return Number(a) / Number(b);
    }`,
    needs: ['number']
  },

  remainder: {
    code: `    public static double Remainder(dynamic a, dynamic b) {
        if (Number(b) == 0) throw new Exception("I cannot divide by zero");
        return Number(a) % Number(b);
    }`,
    needs: ['number']
  },

  items: {
    code: `    public static List<dynamic> Items(dynamic value) {
        var out_ = new List<dynamic>();
        if (value == null) return out_;
        if (value is string text) { foreach (char letter in text) out_.Add(letter.ToString()); return out_; }
        if (value is IDictionary map) { foreach (var key in map.Keys) out_.Add(key); return out_; }
        if (value is IEnumerable list) { foreach (var item in list) out_.Add(item); return out_; }
        return out_;
    }`
  },

  range: {
    code: `    // Plain counts up or down depending on the two numbers.
    public static List<dynamic> Range(dynamic from, dynamic to, dynamic step) {
        var out_ = new List<dynamic>();
        double move = Math.Abs(Number(step));
        if (move == 0) move = 1;
        double finish = Number(to);
        if (finish < Number(from)) move = -move;
        for (double at = Number(from); move > 0 ? at <= finish : at >= finish; at += move) out_.Add(at);
        return out_;
    }`,
    needs: ['number']
  },

  item: {
    code: `    // Lists count from 1 in Plain.
    public static dynamic Item(dynamic collection, dynamic index) {
        int at = (int)Number(index);
        if (collection is string text) {
            int place = at < 0 ? text.Length + at : at - 1;
            return place >= 0 && place < text.Length ? text[place].ToString() : null;
        }
        if (collection is IList list) {
            int place = at < 0 ? list.Count + at : at - 1;
            return place >= 0 && place < list.Count ? list[place] : null;
        }
        return null;
    }`,
    needs: ['number']
  },

  setItem: {
    code: `    public static dynamic SetItem(dynamic collection, dynamic index, dynamic value) {
        int at = (int)Number(index);
        if (collection is IList list) {
            int place = at < 0 ? list.Count + at : at - 1;
            if (place >= 0 && place < list.Count) list[place] = value;
        }
        return collection;
    }`,
    needs: ['number']
  },

  length: {
    code: `    public static int Length(dynamic value) {
        if (value is string text) return text.Length;
        if (value is IList list) return list.Count;
        if (value is IDictionary map) return map.Count;
        return 0;
    }`
  },

  first: { code: `    public static dynamic First(dynamic collection) { return Item(collection, 1); }`, needs: ['item'] },
  last: { code: `    public static dynamic Last(dynamic collection) { return Item(collection, Length(collection)); }`, needs: ['item', 'length'] },

  total: { code: `    public static double Total(dynamic collection) { double sum = 0; foreach (var item in Items(collection)) sum += Number(item); return sum; }`, needs: ['items', 'number'] },
  average: { code: `    public static double Average(dynamic collection) { var all = Items(collection); return all.Count > 0 ? Total(all) / all.Count : 0; }`, needs: ['items', 'total'] },
  highest: { code: `    public static dynamic Highest(dynamic collection) { dynamic best = null; foreach (var item in Items(collection)) if (best == null || Number(item) > Number(best)) best = item; return best; }`, needs: ['items', 'number'] },
  lowest: { code: `    public static dynamic Lowest(dynamic collection) { dynamic best = null; foreach (var item in Items(collection)) if (best == null || Number(item) < Number(best)) best = item; return best; }`, needs: ['items', 'number'] },

  // Plain loops, not LINQ: a lambda over `dynamic` cannot be compiled
  // (CS1977), so every list helper here is written out longhand.
  sorted: {
    code: `    public static List<dynamic> Sorted(dynamic collection) {
        var all = Items(collection);
        bool numbers = true;
        foreach (var item in all) if (item == null || item is string) numbers = false;
        var copy = new List<dynamic>(all);
        if (numbers) copy.Sort((a, b) => Number(a).CompareTo(Number(b)));
        else copy.Sort((a, b) => string.CompareOrdinal(Text(a), Text(b)));
        return copy;
    }`,
    needs: ['items', 'number', 'text']
  },

  reversed: { code: `    public static List<dynamic> Reversed(dynamic collection) { var copy = new List<dynamic>(Items(collection)); copy.Reverse(); return copy; }`, needs: ['items'] },
  copy: { code: `    public static dynamic Copy(dynamic value) { if (value is IList list) return new List<dynamic>(Items(list)); return value; }`, needs: ['items'] },
  joinWith: {
    code: `    public static string JoinWith(dynamic collection, dynamic separator) {
        var parts = new List<string>();
        foreach (var item in Items(collection)) parts.Add(Text(item));
        return string.Join(Text(separator), parts);
    }`,
    needs: ['items', 'text']
  },
  position: {
    code: `    public static int Position(dynamic collection, dynamic value) {
        if (collection is string text) return text.IndexOf(Text(value)) + 1;
        var all = Items(collection);
        for (int at = 0; at < all.Count; at++) if (Same(all[at], value)) return at + 1;
        return 0;
    }`,
    needs: ['items', 'same', 'text']
  },

  has: {
    code: `    public static bool Has(dynamic container, dynamic value) {
        if (container is string text) return text.Contains(Text(value));
        foreach (var item in Items(container)) if (Same(item, value)) return true;
        return false;
    }`,
    needs: ['items', 'same', 'text']
  },

  addTo: {
    code: `    // "add x to name" grows a list, adds to a number, or joins text.
    public static dynamic AddTo(dynamic current, dynamic value) {
        if (current is IList list) { list.Add(value); return list; }
        if (current is string text) return text + Text(value);
        return Number(current) + Number(value);
    }`,
    needs: ['text', 'number']
  },

  removeValue: {
    code: `    public static dynamic RemoveValue(dynamic collection, dynamic value) {
        if (collection is IList list) {
            for (int at = 0; at < list.Count; at++) if (Same(list[at], value)) { list.RemoveAt(at); break; }
        }
        return collection;
    }`,
    needs: ['same']
  },

  removeAt: {
    code: `    public static dynamic RemoveAt(dynamic collection, dynamic index) {
        int at = (int)Number(index);
        if (collection is IList list && at >= 1 && at <= list.Count) list.RemoveAt(at - 1);
        return collection;
    }`,
    needs: ['number']
  },

  emptied: { code: `    public static dynamic Emptied(dynamic value) { if (value is IList list) { list.Clear(); return list; } return null; }` },

  field: {
    code: `    // "name of thing" - a dictionary key, or a value on one of your kinds.
    public static dynamic Field(dynamic thing, string name) {
        if (thing == null) return null;
        if (thing is IDictionary map) {
            foreach (DictionaryEntry entry in map) {
                if (string.Equals(entry.Key.ToString(), name, StringComparison.OrdinalIgnoreCase)) return entry.Value;
            }
            return null;
        }
        if (thing is IList || thing is string) {
            if (name.ToLower() == "length" || name.ToLower() == "size" || name.ToLower() == "count") return Length(thing);
        }
        var found = ((object)thing).GetType().GetFields()
            .FirstOrDefault(one => string.Equals(one.Name, name, StringComparison.OrdinalIgnoreCase));
        return found == null ? null : found.GetValue(thing);
    }`,
    needs: ['length']
  },

  setField: {
    code: `    public static void SetField(dynamic thing, string name, dynamic value) {
        if (thing is IDictionary map) {
            foreach (var key in map.Keys.Cast<object>().ToList()) {
                if (string.Equals(key.ToString(), name, StringComparison.OrdinalIgnoreCase)) { map[key] = value; return; }
            }
            map[name] = value;
            return;
        }
        var found = ((object)thing).GetType().GetFields()
            .FirstOrDefault(one => string.Equals(one.Name, name, StringComparison.OrdinalIgnoreCase));
        if (found != null) found.SetValue(thing, value);
    }`
  },

  fill: {
    code: `    // The values handed to "a new Dog with ..." land on the thing itself.
    public static void Fill(dynamic thing, Dictionary<string, dynamic> values) {
        if (values == null) return;
        foreach (var pair in values) SetField(thing, pair.Key, pair.Value);
    }`,
    needs: ['setField']
  },

  keys: { code: `    public static List<dynamic> Keys(dynamic thing) { var out_ = new List<dynamic>(); if (thing is IDictionary map) { foreach (var key in map.Keys) out_.Add(key); } else if (thing != null) { foreach (var field in ((object)thing).GetType().GetFields()) out_.Add(field.Name); } return out_; }` },
  values: { code: `    public static List<dynamic> Values(dynamic thing) { var out_ = new List<dynamic>(); if (thing is IDictionary map) { foreach (var item in map.Values) out_.Add(item); } else if (thing != null) { foreach (var field in ((object)thing).GetType().GetFields()) out_.Add(field.GetValue(thing)); } return out_; }` },
  value: { code: `    public static dynamic Value(dynamic thing, dynamic key) { return Field(thing, Text(key)); }`, needs: ['field', 'text'] },
  setValue: { code: `    public static void SetValue(dynamic thing, dynamic key, dynamic value) { SetField(thing, Text(key), value); }`, needs: ['setField', 'text'] },
  hasKey: {
    code: `    public static bool HasKey(dynamic thing, dynamic key) {
        foreach (var name in Keys(thing)) {
            if (string.Equals(Text(name), Text(key), StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }`,
    needs: ['keys', 'text']
  },

  upper: { code: `    public static string Upper(dynamic text) { return Text(text).ToUpper(); }`, needs: ['text'] },
  lower: { code: `    public static string Lower(dynamic text) { return Text(text).ToLower(); }`, needs: ['text'] },
  trimmed: { code: `    public static string Trimmed(dynamic text) { return Text(text).Trim(); }`, needs: ['text'] },
  // Anything called with a dynamic argument gives back dynamic, so the
  // result is pinned to a string first and the loop is written out.
  split: {
    code: `    public static List<dynamic> Split(dynamic text, dynamic separator) {
        string whole = Text(text);
        string mark = Text(separator);
        var out_ = new List<dynamic>();
        foreach (var part in whole.Split(new string[] { mark }, StringSplitOptions.None)) out_.Add(part);
        return out_;
    }`,
    needs: ['text']
  },
  part: { code: `    public static string Part(dynamic text, dynamic start, dynamic finish) { string whole = Text(text); int from = Math.Max(0, (int)Number(start) - 1); int to = Math.Min(whole.Length, (int)Number(finish)); return from >= to ? "" : whole.Substring(from, to - from); }`, needs: ['text', 'number'] },
  replace: { code: `    public static string Replace(dynamic text, dynamic find, dynamic replacement) { return Text(text).Replace(Text(find), Text(replacement)); }`, needs: ['text'] },
  startsWith: { code: `    public static bool StartsWith(dynamic text, dynamic prefix) { return Text(text).StartsWith(Text(prefix)); }`, needs: ['text'] },
  endsWith: { code: `    public static bool EndsWith(dynamic text, dynamic suffix) { return Text(text).EndsWith(Text(suffix)); }`, needs: ['text'] },

  round: { code: `    public static double Round(dynamic value) { return Math.Floor(Number(value) + 0.5); }`, needs: ['number'] },
  roundTo: { code: `    public static double RoundTo(dynamic value, dynamic places) { double scale = Math.Pow(10, Math.Floor(Number(places))); return Math.Floor(Number(value) * scale + 0.5) / scale; }`, needs: ['number'] },
  floor: { code: `    public static double Floor(dynamic value) { return Math.Floor(Number(value)); }`, needs: ['number'] },
  ceiling: { code: `    public static double Ceiling(dynamic value) { return Math.Ceiling(Number(value)); }`, needs: ['number'] },
  absolute: { code: `    public static double Absolute(dynamic value) { return Math.Abs(Number(value)); }`, needs: ['number'] },
  squareRoot: { code: `    public static double SquareRoot(dynamic value) { return Math.Sqrt(Math.Max(0, Number(value))); }`, needs: ['number'] },
  sine: { code: `    public static double Sine(dynamic value) { return Math.Sin(Number(value)); }`, needs: ['number'] },
  cosine: { code: `    public static double Cosine(dynamic value) { return Math.Cos(Number(value)); }`, needs: ['number'] },
  smaller: { code: `    public static double Smaller(dynamic a, dynamic b) { return Math.Min(Number(a), Number(b)); }`, needs: ['number'] },
  bigger: { code: `    public static double Bigger(dynamic a, dynamic b) { return Math.Max(Number(a), Number(b)); }`, needs: ['number'] },
  pi: { code: `    public static double Pi() { return Math.PI; }` },

  randomBetween: { code: `    static readonly Random Dice = new Random();\n    public static int RandomBetween(dynamic low, dynamic high) { return Dice.Next((int)Math.Ceiling(Number(low)), (int)Math.Floor(Number(high)) + 1); }`, needs: ['number'] },
  randomNumber: { code: `    public static double RandomNumber() { return Dice.NextDouble(); }`, needs: ['randomBetween'] },
  randomItem: { code: `    public static dynamic RandomItem(dynamic collection) { var all = Items(collection); return all.Count > 0 ? all[Dice.Next(all.Count)] : null; }`, needs: ['items', 'randomBetween'] },

  timeNow: { code: `    public static long TimeNow() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }` },
  today: { code: `    public static string Today() { return DateTime.Now.ToString("yyyy-MM-dd"); }` },

  kindOf: {
    code: `    public static string KindOf(dynamic value) {
        if (value == null) return "nothing";
        if (value is bool) return "a yes/no";
        if (value is IList) return "a list";
        if (value is string) return "text";
        if (value is Delegate) return "an action";
        if (IsNumber(value)) return "a number";
        return "a thing";
    }`,
    needs: ['same']
  },

  changedBy: {
    code: `    public static List<dynamic> ChangedBy(dynamic collection, dynamic action) {
        var out_ = new List<dynamic>();
        foreach (var item in Items(collection)) out_.Add(action(item));
        return out_;
    }`,
    needs: ['items']
  },
  keptWhere: {
    code: `    public static List<dynamic> KeptWhere(dynamic collection, dynamic action) {
        var out_ = new List<dynamic>();
        foreach (var item in Items(collection)) if (Truthy(action(item))) out_.Add(item);
        return out_;
    }`,
    needs: ['items', 'truthy']
  },
  addedUpBy: { code: `    public static double AddedUpBy(dynamic collection, dynamic action) { double sum = 0; foreach (var item in Items(collection)) sum += Number(action(item)); return sum; }`, needs: ['items', 'number'] },

  ask: {
    code: `    // Reads one line, the way "ask ... into ..." does in Plain.
    public static dynamic Ask(dynamic question) {
        Console.Write(Text(question));
        string answer = Console.ReadLine() ?? "";
        double parsed;
        if (answer.Trim().Length > 0 && double.TryParse(answer, out parsed)) return parsed;
        return answer;
    }`,
    needs: ['text']
  }
};
