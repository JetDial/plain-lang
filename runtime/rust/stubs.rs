// Plain - the three tables a program writes for itself.
//
// runtime/rust/plain.rs leans on these, and the translator writes a real one
// of each for every program. These empty ones exist so the runtime can be
// compiled and checked on its own, which the test suite does.

fn plain_defaults(_kind: &str, _into: &mut Thing) {}

fn plain_base(_kind: &str) -> Option<String> {
    None
}

fn plain_do(_kind: &str, _action: &str, _me: Value, _args: &[Value]) -> Option<Value> {
    None
}

fn main() {
    // Enough to prove the runtime holds together and agrees with Plain.
    println!("{}", plain_show(&plain_add(Value::Number(0.1), Value::Number(0.2))));
    println!("{}", plain_show(&plain_divide(Value::Number(10.0), Value::Number(4.0))));
    let list = plain_list_value(vec![Value::Number(3.0), Value::Number(1.0), Value::Number(2.0)]);
    println!("{}", plain_show(&plain_sorted(list.clone())));
    println!("{}", plain_show(&plain_item(list, Value::Number(1.0))));
    let problem = plain_try(|| {
        plain_divide(Value::Number(1.0), Value::Number(0.0));
    });
    println!("{}", problem.unwrap_or_default());
}
