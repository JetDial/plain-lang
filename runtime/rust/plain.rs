// Plain - the value runtime for Rust.
//
// Rust wants to know the type of everything and who owns it. Plain does not
// work that way: a name holds whatever you put in it, and two names can hold
// the same list. So this file gives Rust one type that can be any Plain
// value, and hands out shared ownership with Rc.
//
// Nothing here is a garbage collector. Rc counts how many names are holding
// a thing and frees it when the last one lets go, which is enough for every
// program that does not tie a knot in itself - a list that contains itself,
// or two things that point at each other. Those leak, quietly and harmlessly,
// until the program ends.
//
// `plain translate x.plain --to rust` pastes this file above your program, so
// the result is one .rs file that needs nothing but rustc.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::io::Write as _;
use std::rc::Rc;

// --------------------------------------------------------------- the value

#[derive(Clone)]
pub enum Value {
    Nothing,
    Bool(bool),
    Number(f64),
    Text(Rc<String>),
    List(Rc<RefCell<Vec<Value>>>),
    Thing(Rc<RefCell<Thing>>),
    Action(Rc<dyn Fn(&[Value]) -> Value>),
}

// A thing is a bag of named values that remembers the order they arrived in.
// One of your own kinds is a thing with a name on it.
pub struct Thing {
    pub kind: String,
    pub fields: Vec<(String, Value)>,
}

impl Thing {
    fn find(&self, name: &str) -> Option<usize> {
        self.fields.iter().position(|(key, _)| key.eq_ignore_ascii_case(name))
    }
}

fn plain_text_value(text: String) -> Value {
    Value::Text(Rc::new(text))
}

fn plain_list_value(items: Vec<Value>) -> Value {
    Value::List(Rc::new(RefCell::new(items)))
}

#[inline(always)]
fn plain_bool(yes: bool) -> Value {
    Value::Bool(yes)
}

// A record written with curly braces: named values, no kind.
fn plain_record(pairs: Vec<(&str, Value)>) -> Value {
    let mut thing = Thing { kind: String::new(), fields: Vec::new() };
    for (name, value) in pairs {
        thing.fields.push((name.to_string(), value));
    }
    Value::Thing(Rc::new(RefCell::new(thing)))
}

// One of your own kinds. The defaults come first, so anything the program
// passed in wins.
fn plain_new(kind: &str, pairs: Vec<(&str, Value)>) -> Value {
    let mut thing = Thing { kind: kind.to_string(), fields: Vec::new() };
    plain_defaults(kind, &mut thing);
    for (name, value) in pairs {
        match thing.find(name) {
            Some(at) => thing.fields[at].1 = value,
            None => thing.fields.push((name.to_string(), value)),
        }
    }
    Value::Thing(Rc::new(RefCell::new(thing)))
}

// A kind based on another fills in the base's values first, so a value set
// again further down replaces it - but keeps the place it first appeared,
// which is the order the thing reads in.
fn plain_own(thing: &mut Thing, name: &str, value: Value) {
    match thing.find(name) {
        Some(at) => thing.fields[at].1 = value,
        None => thing.fields.push((name.to_string(), value)),
    }
}

// ---------------------------------------------------------------- writing

// Numbers read the way Plain writes them: whole ones with no decimal point,
// and the rest rounded to twelve places first so that 0.1 plus 0.2 is 0.3
// rather than a long tail of floating point noise.
fn plain_number_text(value: f64) -> String {
    if value.is_nan() {
        return String::from("not a number");
    }
    if value.is_infinite() {
        return String::from(if value > 0.0 { "infinity" } else { "-infinity" });
    }
    if value == value.trunc() {
        // -0 should read as 0, the way it does everywhere else.
        let whole = if value == 0.0 { 0.0 } else { value };
        return format!("{:.0}", whole);
    }
    format!("{}", plain_to_precision(value, 12))
}

fn plain_to_precision(value: f64, digits: i32) -> f64 {
    if value == 0.0 || !value.is_finite() {
        return value;
    }
    let places = digits - 1 - value.abs().log10().floor() as i32;
    if places > 300 || places < -300 {
        return value;
    }
    let scale = 10f64.powi(places);
    (value * scale).round() / scale
}

fn plain_write(value: &Value, depth: usize, into: &mut String) {
    match value {
        Value::Nothing => into.push_str("nothing"),
        Value::Bool(yes) => into.push_str(if *yes { "yes" } else { "no" }),
        Value::Number(number) => into.push_str(&plain_number_text(*number)),
        Value::Text(text) => {
            if depth == 0 {
                into.push_str(text);
            } else {
                let _ = write!(into, "\"{}\"", text);
            }
        }
        Value::List(items) => {
            into.push('[');
            for (at, item) in items.borrow().iter().enumerate() {
                if at > 0 {
                    into.push_str(", ");
                }
                plain_write(item, depth + 1, into);
            }
            into.push(']');
        }
        Value::Thing(holder) => {
            let thing = holder.borrow();
            let mut parts: Vec<String> = Vec::new();
            for (name, held) in thing.fields.iter() {
                let mut one = String::new();
                let _ = write!(one, "{}: ", name);
                plain_write(held, depth + 1, &mut one);
                parts.push(one);
            }
            if thing.kind.is_empty() {
                let _ = write!(into, "{{{}}}", parts.join(", "));
            } else {
                let _ = write!(into, "a {} ({})", thing.kind, parts.join(", "));
            }
        }
        Value::Action(_) => into.push_str("<action>"),
    }
}

// What `show` prints, and what "text of x" gives back.
fn plain_show(value: &Value) -> String {
    let mut out = String::new();
    plain_write(value, 0, &mut out);
    out
}

fn plain_text(value: Value) -> Value {
    plain_text_value(plain_show(&value))
}

// ------------------------------------------------------------ reading back

#[inline(always)]
fn plain_number(value: Value) -> f64 {
    match value {
        Value::Number(number) => number,
        Value::Bool(yes) => {
            if yes {
                1.0
            } else {
                0.0
            }
        }
        Value::Text(text) => text.trim().parse::<f64>().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn plain_whole(value: Value) -> i64 {
    plain_number(value) as i64
}

#[inline(always)]
fn plain_truthy(value: Value) -> bool {
    match value {
        Value::Nothing => false,
        Value::Bool(yes) => yes,
        Value::Number(number) => number != 0.0,
        Value::Text(text) => !text.is_empty(),
        Value::List(items) => !items.borrow().is_empty(),
        _ => true,
    }
}

#[inline(always)]
fn plain_same(a: Value, b: Value) -> Value {
    plain_bool(plain_alike(&a, &b))
}

fn plain_alike(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Nothing, Value::Nothing) => true,
        (Value::Nothing, _) | (_, Value::Nothing) => false,
        (Value::Bool(_), _) | (_, Value::Bool(_)) => {
            plain_truthy(a.clone()) == plain_truthy(b.clone())
        }
        (Value::Number(_), _) | (_, Value::Number(_)) => {
            plain_number(a.clone()) == plain_number(b.clone())
        }
        (Value::Text(left), Value::Text(right)) => left == right,
        (Value::List(left), Value::List(right)) => {
            let left = left.borrow();
            let right = right.borrow();
            left.len() == right.len()
                && left.iter().zip(right.iter()).all(|(one, other)| plain_alike(one, other))
        }
        (Value::Thing(left), Value::Thing(right)) => Rc::ptr_eq(left, right),
        (Value::Action(left), Value::Action(right)) => Rc::ptr_eq(left, right),
        _ => false,
    }
}

// -------------------------------------------------------------- arithmetic

// Plus joins text and adds numbers, depending on what it is given.
#[inline(always)]
fn plain_add(a: Value, b: Value) -> Value {
    if matches!(a, Value::Text(_)) || matches!(b, Value::Text(_)) {
        return plain_text_value(plain_show(&a) + &plain_show(&b));
    }
    Value::Number(plain_number(a) + plain_number(b))
}

fn plain_join2(a: Value, b: Value) -> Value {
    plain_text_value(plain_show(&a) + &plain_show(&b))
}

#[inline(always)]
fn plain_minus(a: Value, b: Value) -> Value {
    Value::Number(plain_number(a) - plain_number(b))
}

#[inline(always)]
fn plain_times(a: Value, b: Value) -> Value {
    Value::Number(plain_number(a) * plain_number(b))
}

#[inline(always)]
fn plain_divide(a: Value, b: Value) -> Value {
    let by = plain_number(b);
    if by == 0.0 {
        plain_fail("I cannot divide by zero");
    }
    Value::Number(plain_number(a) / by)
}

#[inline(always)]
fn plain_remainder(a: Value, b: Value) -> Value {
    let by = plain_number(b);
    if by == 0.0 {
        plain_fail("I cannot divide by zero");
    }
    Value::Number(plain_number(a) % by)
}

#[inline(always)]
fn plain_power(a: Value, b: Value) -> Value {
    Value::Number(plain_number(a).powf(plain_number(b)))
}

#[inline(always)]
fn plain_negate(value: Value) -> Value {
    Value::Number(-plain_number(value))
}

#[inline(always)]
fn plain_less(a: Value, b: Value) -> Value {
    plain_bool(plain_number(a) < plain_number(b))
}

#[inline(always)]
fn plain_less_equal(a: Value, b: Value) -> Value {
    plain_bool(plain_number(a) <= plain_number(b))
}

#[inline(always)]
fn plain_more(a: Value, b: Value) -> Value {
    plain_bool(plain_number(a) > plain_number(b))
}

#[inline(always)]
fn plain_more_equal(a: Value, b: Value) -> Value {
    plain_bool(plain_number(a) >= plain_number(b))
}

fn plain_bits(sign: &str, a: Value, b: Value) -> Value {
    let left = plain_whole(a);
    let right = plain_whole(b);
    let out = match sign {
        "and" => left & right,
        "or" => left | right,
        "xor" => left ^ right,
        "left" => left << right,
        _ => left >> right,
    };
    Value::Number(out as f64)
}

fn plain_bits_not(value: Value) -> Value {
    Value::Number(!plain_whole(value) as f64)
}

// ------------------------------------------------------------------ lists

// Everything a "for each" can walk over: a list, the letters of some text,
// or the names on a thing.
fn plain_items(value: Value) -> Vec<Value> {
    match value {
        Value::List(items) => items.borrow().clone(),
        Value::Text(text) => text.chars().map(|letter| plain_text_value(letter.to_string())).collect(),
        Value::Thing(holder) => holder
            .borrow()
            .fields
            .iter()
            .map(|(name, _)| plain_text_value(name.clone()))
            .collect(),
        _ => Vec::new(),
    }
}

// Plain counts up or down depending on the two numbers.
fn plain_range(from: Value, to: Value, step: Value) -> Vec<Value> {
    let start = plain_number(from);
    let finish = plain_number(to);
    let mut move_by = plain_number(step).abs();
    if move_by == 0.0 {
        move_by = 1.0;
    }
    if finish < start {
        move_by = -move_by;
    }
    let mut out = Vec::new();
    let mut at = start;
    while if move_by > 0.0 { at <= finish } else { at >= finish } {
        out.push(Value::Number(at));
        at += move_by;
    }
    out
}

fn plain_len(value: Value) -> usize {
    match value {
        Value::Text(text) => text.chars().count(),
        Value::List(items) => items.borrow().len(),
        Value::Thing(holder) => holder.borrow().fields.len(),
        _ => 0,
    }
}

fn plain_length(value: Value) -> Value {
    Value::Number(plain_len(value) as f64)
}

// Lists count from 1 in Plain, and a negative index counts from the end.
fn plain_place(index: f64, len: usize) -> Option<usize> {
    let at = index as i64;
    let place = if at < 0 { len as i64 + at } else { at - 1 };
    if place < 0 || place >= len as i64 {
        None
    } else {
        Some(place as usize)
    }
}

fn plain_item(collection: Value, index: Value) -> Value {
    let at = plain_number(index);
    match collection {
        Value::Text(text) => {
            let letters: Vec<char> = text.chars().collect();
            match plain_place(at, letters.len()) {
                Some(place) => plain_text_value(letters[place].to_string()),
                None => Value::Nothing,
            }
        }
        Value::List(items) => {
            let held = items.borrow();
            match plain_place(at, held.len()) {
                Some(place) => held[place].clone(),
                None => Value::Nothing,
            }
        }
        _ => Value::Nothing,
    }
}

fn plain_set_item(collection: Value, index: Value, value: Value) -> Value {
    let at = plain_number(index);
    if let Value::List(items) = &collection {
        let mut held = items.borrow_mut();
        let len = held.len();
        if let Some(place) = plain_place(at, len) {
            held[place] = value;
        }
    }
    collection
}

fn plain_at(args: &[Value], at: usize) -> Value {
    args.get(at).cloned().unwrap_or(Value::Nothing)
}

fn plain_first(collection: Value) -> Value {
    plain_item(collection, Value::Number(1.0))
}

fn plain_last(collection: Value) -> Value {
    let len = plain_len(collection.clone()) as f64;
    plain_item(collection, Value::Number(len))
}

fn plain_total(collection: Value) -> Value {
    let mut sum = 0.0;
    for item in plain_items(collection) {
        sum += plain_number(item);
    }
    Value::Number(sum)
}

fn plain_average(collection: Value) -> Value {
    let all = plain_items(collection);
    if all.is_empty() {
        return Value::Number(0.0);
    }
    let count = all.len() as f64;
    Value::Number(plain_number(plain_total(plain_list_value(all))) / count)
}

fn plain_highest(collection: Value) -> Value {
    let mut best: Option<Value> = None;
    for item in plain_items(collection) {
        let better = match &best {
            None => true,
            Some(held) => plain_number(item.clone()) > plain_number(held.clone()),
        };
        if better {
            best = Some(item);
        }
    }
    best.unwrap_or(Value::Nothing)
}

fn plain_lowest(collection: Value) -> Value {
    let mut best: Option<Value> = None;
    for item in plain_items(collection) {
        let better = match &best {
            None => true,
            Some(held) => plain_number(item.clone()) < plain_number(held.clone()),
        };
        if better {
            best = Some(item);
        }
    }
    best.unwrap_or(Value::Nothing)
}

// Numbers sort as numbers, anything else as the words it reads as.
fn plain_sorted(collection: Value) -> Value {
    let mut all = plain_items(collection);
    let numbers = all.iter().all(|item| matches!(item, Value::Number(_)));
    if numbers {
        all.sort_by(|a, b| {
            plain_number(a.clone())
                .partial_cmp(&plain_number(b.clone()))
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    } else {
        all.sort_by(|a, b| plain_show(a).cmp(&plain_show(b)));
    }
    plain_list_value(all)
}

fn plain_reversed(collection: Value) -> Value {
    let mut all = plain_items(collection);
    all.reverse();
    plain_list_value(all)
}

fn plain_copy(value: Value) -> Value {
    match &value {
        Value::List(items) => plain_list_value(items.borrow().clone()),
        _ => value,
    }
}

fn plain_join_with(collection: Value, separator: Value) -> Value {
    let between = plain_show(&separator);
    let parts: Vec<String> = plain_items(collection).iter().map(plain_show).collect();
    plain_text_value(parts.join(&between))
}

fn plain_position(collection: Value, value: Value) -> Value {
    if let Value::Text(text) = &collection {
        let wanted = plain_show(&value);
        return match text.find(&wanted) {
            // Counted in letters, not bytes, so that accents behave.
            Some(byte) => Value::Number((text[..byte].chars().count() + 1) as f64),
            None => Value::Number(0.0),
        };
    }
    for (at, item) in plain_items(collection).iter().enumerate() {
        if plain_alike(item, &value) {
            return Value::Number((at + 1) as f64);
        }
    }
    Value::Number(0.0)
}

fn plain_has(container: Value, value: Value) -> Value {
    if let Value::Text(text) = &container {
        return plain_bool(text.contains(&plain_show(&value)));
    }
    plain_bool(plain_items(container).iter().any(|item| plain_alike(item, &value)))
}

// "add x to name" grows a list, adds to a number, or joins text.
fn plain_add_to(current: Value, value: Value) -> Value {
    match &current {
        Value::List(items) => {
            items.borrow_mut().push(value);
            current
        }
        Value::Text(text) => plain_text_value(text.to_string() + &plain_show(&value)),
        _ => Value::Number(plain_number(current) + plain_number(value)),
    }
}

fn plain_remove_value(collection: Value, value: Value) -> Value {
    if let Value::List(items) = &collection {
        let at = items.borrow().iter().position(|item| plain_alike(item, &value));
        if let Some(place) = at {
            items.borrow_mut().remove(place);
        }
    }
    collection
}

fn plain_remove_at(collection: Value, index: Value) -> Value {
    if let Value::List(items) = &collection {
        let at = plain_number(index) as i64;
        let len = items.borrow().len() as i64;
        if at >= 1 && at <= len {
            items.borrow_mut().remove((at - 1) as usize);
        }
    }
    collection
}

fn plain_emptied(value: Value) -> Value {
    match value {
        Value::List(_) => plain_list_value(Vec::new()),
        _ => Value::Nothing,
    }
}

fn plain_random_item(collection: Value) -> Value {
    let all = plain_items(collection);
    if all.is_empty() {
        return Value::Nothing;
    }
    let at = (plain_random() * all.len() as f64) as usize;
    all[at.min(all.len() - 1)].clone()
}

// ------------------------------------------------------------ named values

// "name of thing" - a value on a thing, or how long a list or some text is.
fn plain_field(thing: Value, name: &str) -> Value {
    match &thing {
        Value::Thing(holder) => {
            let held = holder.borrow();
            match held.find(name) {
                Some(at) => held.fields[at].1.clone(),
                None => Value::Nothing,
            }
        }
        Value::List(_) | Value::Text(_) => {
            let lowered = name.to_lowercase();
            if lowered == "length" || lowered == "size" || lowered == "count" {
                plain_length(thing)
            } else {
                Value::Nothing
            }
        }
        _ => Value::Nothing,
    }
}

fn plain_set_field(thing: Value, name: &str, value: Value) -> Value {
    if let Value::Thing(holder) = &thing {
        let mut held = holder.borrow_mut();
        match held.find(name) {
            Some(at) => held.fields[at].1 = value,
            None => held.fields.push((name.to_string(), value)),
        }
    }
    Value::Nothing
}

fn plain_value(thing: Value, key: Value) -> Value {
    plain_field(thing, &plain_show(&key))
}

fn plain_set_value(thing: Value, key: Value, value: Value) -> Value {
    plain_set_field(thing, &plain_show(&key), value)
}

fn plain_has_key(thing: Value, key: Value) -> Value {
    if let Value::Thing(holder) = &thing {
        return plain_bool(holder.borrow().find(&plain_show(&key)).is_some());
    }
    plain_bool(false)
}

fn plain_keys(thing: Value) -> Value {
    match &thing {
        Value::Thing(holder) => plain_list_value(
            holder.borrow().fields.iter().map(|(name, _)| plain_text_value(name.clone())).collect(),
        ),
        _ => plain_list_value(Vec::new()),
    }
}

fn plain_values(thing: Value) -> Value {
    match &thing {
        Value::Thing(holder) => {
            plain_list_value(holder.borrow().fields.iter().map(|(_, held)| held.clone()).collect())
        }
        _ => plain_list_value(Vec::new()),
    }
}

// --------------------------------------------------------- kinds of your own

// A kind's actions are looked up by name, walking up through whatever the
// kind was based on. Both tables below are written out with the program,
// because the translator knows every kind before it starts.
fn plain_tell(thing: Value, action: &str, args: &[Value]) -> Value {
    let kind = match &thing {
        Value::Thing(holder) => holder.borrow().kind.clone(),
        _ => plain_fail("I can only tell one of your own kinds to do something"),
    };
    let mut looking = kind.clone();
    while !looking.is_empty() {
        if let Some(answer) = plain_do(&looking, action, thing.clone(), args) {
            return answer;
        }
        looking = plain_base(&looking).unwrap_or_default();
    }
    plain_fail(&format!("A {} does not know how to \"{}\"", kind, action))
}

fn plain_is_kind(thing: Value, wanted: &str) -> Value {
    let mut looking = match &thing {
        Value::Thing(holder) => holder.borrow().kind.clone(),
        _ => return plain_bool(false),
    };
    while !looking.is_empty() {
        if looking == wanted {
            return plain_bool(true);
        }
        looking = plain_base(&looking).unwrap_or_default();
    }
    plain_bool(false)
}

fn plain_kind_name(thing: Value) -> Value {
    if let Value::Thing(holder) = &thing {
        let kind = holder.borrow().kind.clone();
        if !kind.is_empty() {
            return plain_text_value(kind);
        }
    }
    plain_kind_of(thing)
}

fn plain_kind_of(value: Value) -> Value {
    plain_text_value(String::from(match value {
        Value::Nothing => "nothing",
        Value::Bool(_) => "a yes/no",
        Value::Number(_) => "a number",
        Value::Text(_) => "text",
        Value::List(_) => "a list",
        Value::Thing(_) => "a thing",
        Value::Action(_) => "an action",
    }))
}

// ---------------------------------------------------------------- actions

fn plain_run(action: Value, args: &[Value]) -> Value {
    match action {
        Value::Action(doing) => doing(args),
        _ => plain_fail("That is not an action, so I cannot run it"),
    }
}

fn plain_changed_by(collection: Value, action: Value) -> Value {
    let out: Vec<Value> = plain_items(collection)
        .into_iter()
        .map(|item| plain_run(action.clone(), &[item]))
        .collect();
    plain_list_value(out)
}

fn plain_kept_where(collection: Value, action: Value) -> Value {
    let out: Vec<Value> = plain_items(collection)
        .into_iter()
        .filter(|item| plain_truthy(plain_run(action.clone(), &[item.clone()])))
        .collect();
    plain_list_value(out)
}

fn plain_added_up_by(collection: Value, action: Value) -> Value {
    let mut sum = 0.0;
    for item in plain_items(collection) {
        sum += plain_number(plain_run(action.clone(), &[item]));
    }
    Value::Number(sum)
}

// ------------------------------------------------------- when things go wrong

// A Plain problem is a panic carrying its own words. `plain_try` catches it
// and hands back the words, with the usual Rust panic notice turned off for
// as long as the risky part is running.
fn plain_fail(message: &str) -> ! {
    std::panic::panic_any(String::from(message))
}

fn plain_try<F: FnOnce()>(risky: F) -> Option<String> {
    let before = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(risky));
    std::panic::set_hook(before);
    match outcome {
        Ok(()) => None,
        Err(wrong) => Some(plain_problem_text(wrong)),
    }
}

fn plain_problem_text(wrong: Box<dyn std::any::Any + Send>) -> String {
    if let Some(words) = wrong.downcast_ref::<String>() {
        return words.clone();
    }
    if let Some(words) = wrong.downcast_ref::<&str>() {
        return String::from(*words);
    }
    String::from("something went wrong")
}

// ------------------------------------------------------------------- text

fn plain_upper(text: Value) -> Value {
    plain_text_value(plain_show(&text).to_uppercase())
}

fn plain_lower(text: Value) -> Value {
    plain_text_value(plain_show(&text).to_lowercase())
}

fn plain_trimmed(text: Value) -> Value {
    plain_text_value(plain_show(&text).trim().to_string())
}

fn plain_split(text: Value, separator: Value) -> Value {
    let whole = plain_show(&text);
    let between = plain_show(&separator);
    let parts: Vec<Value> = if between.is_empty() {
        whole.chars().map(|letter| plain_text_value(letter.to_string())).collect()
    } else {
        whole.split(&between as &str).map(|part| plain_text_value(part.to_string())).collect()
    };
    plain_list_value(parts)
}

fn plain_part(text: Value, start: Value, finish: Value) -> Value {
    let letters: Vec<char> = plain_show(&text).chars().collect();
    let from = (plain_number(start) as i64 - 1).max(0) as usize;
    let to = (plain_number(finish) as i64).max(0) as usize;
    let to = to.min(letters.len());
    if from >= to {
        return plain_text_value(String::new());
    }
    plain_text_value(letters[from..to].iter().collect())
}

fn plain_replace(text: Value, find: Value, instead: Value) -> Value {
    let whole = plain_show(&text);
    let looking = plain_show(&find);
    if looking.is_empty() {
        return plain_text_value(whole);
    }
    plain_text_value(whole.replace(&looking as &str, &plain_show(&instead)))
}

fn plain_starts_with(text: Value, prefix: Value) -> Value {
    plain_bool(plain_show(&text).starts_with(&plain_show(&prefix) as &str))
}

fn plain_ends_with(text: Value, suffix: Value) -> Value {
    plain_bool(plain_show(&text).ends_with(&plain_show(&suffix) as &str))
}

// ---------------------------------------------------------------- numbers

fn plain_round(value: Value) -> Value {
    Value::Number((plain_number(value) + 0.5).floor())
}

fn plain_round_to(value: Value, places: Value) -> Value {
    let scale = 10f64.powf(plain_number(places).floor());
    Value::Number((plain_number(value) * scale + 0.5).floor() / scale)
}

fn plain_floor(value: Value) -> Value {
    Value::Number(plain_number(value).floor())
}

fn plain_ceiling(value: Value) -> Value {
    Value::Number(plain_number(value).ceil())
}

fn plain_absolute(value: Value) -> Value {
    Value::Number(plain_number(value).abs())
}

fn plain_square_root(value: Value) -> Value {
    Value::Number(plain_number(value).max(0.0).sqrt())
}

fn plain_sine(value: Value) -> Value {
    Value::Number(plain_number(value).sin())
}

fn plain_cosine(value: Value) -> Value {
    Value::Number(plain_number(value).cos())
}

fn plain_tangent(value: Value) -> Value {
    Value::Number(plain_number(value).tan())
}

fn plain_exponent(value: Value) -> Value {
    Value::Number(plain_number(value).exp())
}

fn plain_logarithm(value: Value) -> Value {
    Value::Number(plain_number(value).max(1e-300).ln())
}

fn plain_smaller(a: Value, b: Value) -> Value {
    Value::Number(plain_number(a).min(plain_number(b)))
}

fn plain_bigger(a: Value, b: Value) -> Value {
    Value::Number(plain_number(a).max(plain_number(b)))
}

fn plain_pi() -> Value {
    Value::Number(std::f64::consts::PI)
}

fn plain_e() -> Value {
    Value::Number(std::f64::consts::E)
}

// Rust's library has no random numbers in it, so here is a small one: the
// xorshift a great many programs use, started from the clock.
thread_local! {
    static PLAIN_SEED: RefCell<u64> = RefCell::new(0);
}

fn plain_random() -> f64 {
    PLAIN_SEED.with(|held| {
        let mut seed = held.borrow_mut();
        if *seed == 0 {
            *seed = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|since| since.as_nanos() as u64)
                .unwrap_or(0x2545F4914F6CDD1D)
                | 1;
        }
        let mut x = *seed;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        *seed = x;
        // The top 53 bits, so the answer lands evenly between 0 and 1.
        (x >> 11) as f64 / (1u64 << 53) as f64
    })
}

fn plain_random_number() -> Value {
    Value::Number(plain_random())
}

fn plain_random_between(low: Value, high: Value) -> Value {
    let from = plain_number(low).ceil();
    let to = plain_number(high).floor();
    if to < from {
        return Value::Number(from);
    }
    let span = to - from + 1.0;
    Value::Number(from + (plain_random() * span).floor().min(span - 1.0))
}

fn plain_time_now() -> Value {
    let since = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|gap| gap.as_millis() as f64)
        .unwrap_or(0.0);
    Value::Number(since)
}

// Today's date as YYYY-MM-DD, worked out from the day count so that this
// file needs nothing outside Rust's own library.
fn plain_today() -> Value {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|gap| gap.as_secs() as i64)
        .unwrap_or(0);
    let days = seconds.div_euclid(86_400);
    let (year, month, day) = plain_civil_from_days(days);
    plain_text_value(format!("{:04}-{:02}-{:02}", year, month, day))
}

// Howard Hinnant's days-to-date, which every date library uses underneath.
fn plain_civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted + 2) / 5 + 1;
    let month = if shifted < 10 { shifted + 3 } else { shifted - 9 };
    (if month <= 2 { year + 1 } else { year }, month, day)
}

// Reads one line, the way "ask ... into ..." does in Plain.
fn plain_ask(question: Value) -> Value {
    print!("{}", plain_show(&question));
    let _ = std::io::stdout().flush();
    let mut answer = String::new();
    if std::io::stdin().read_line(&mut answer).is_err() {
        return plain_text_value(String::new());
    }
    let answer = answer.trim_end_matches(['\r', '\n']).to_string();
    match answer.parse::<f64>() {
        Ok(number) => Value::Number(number),
        Err(_) => plain_text_value(answer),
    }
}

// Kept so that a program with no things of its own still compiles.
#[allow(unused)]
fn plain_unused_marker(_: &HashMap<String, String>) {}
