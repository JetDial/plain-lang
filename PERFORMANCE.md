# Where the time actually goes

Measured, not guessed. Every number here came from running the thing on this
machine, best of three, `rustc -O`, against the same program written by hand
in Rust — which for this kind of work is the same speed class as C++.

## Where Plain stands

| work | hand-written Rust | Plain, compiled | |
|---|---|---|---|
| numbers in a row (arrays) | 0.033 s | 0.048 s | **1.45×** |
| mixed arithmetic and lists | 0.035 s | 0.517 s | 13× |
| things with named fields | 0.025 s | 0.195 s | **7.8×** |

Interpreted — which is what `plain run` and any live server does — is roughly
160× slower than compiled. None of the compiler work below changes that.

## What has been done

**Numbers without boxes.** Names proved to hold only numbers become `f64`
and native arithmetic. Loop counters count. This is what took array work from
18× to 1.45×.

**Runs of numbers.** A list whose every item is a number becomes `Vec<f64>` —
side by side in memory, which is both why the arrays case is fast and the
only shape that can ever be handed to another thread.

## What was tried and rejected

**Threads over a numeric sum.** The idea is sound: adding twenty million
numbers takes 0.054 s on one core and 0.013 s across twenty-four — **4.2×**,
same answer to the digit. But the version the translator emitted was
consistently *slower* than single-threaded (0.241 s vs 0.172 s) at the same
size. Sound idea, bad emission. Removed rather than shipped.

**Removing clones.** Every read in the generated Rust is `x.clone()`, which
looks like an obvious waste. It is not:

```
things benchmark, as it stands        0.195 s
same, with repeated clones and
field lookups hoisted out by hand     0.207 s
```

Slightly *worse*. Cloning a `Value` is an enum copy or a reference count
bump, and neither shows up. **Do not spend time on this.**

**Faster field lookup.** The obvious next suspect: `plain_field` walks a
thing's fields comparing names, ignoring case, on every access. Adding a
plain equality fast path for the case that always hits — a lowercase program
read with lowercase names — changed nothing at all:

```
0.206 s before, 0.210 s after
```

Reverted. Comparing two short names is not what costs; that leaves the boxes
themselves and the `Rc<RefCell>` behind every thing.

## What the measurement says to do next

The things benchmark is 7.8× off, and the generated code says why:

```rust
plain_field(one.clone(), "score")
```

`plain_field` walks a thing's field list comparing strings, on every single
access. It is the lookup that costs, not the clone and not the box.

Two hypotheses have now been eliminated by measurement rather than argument —
cloning and lookup — and both pointed the same way when they failed. What is
left is the representation itself: a thing is a reference-counted, borrow-
checked bag holding boxed values, and every read pays for all three.

So the next piece of work is **struct layout**: `a kind called Plane has x,
has y` already declares a struct, and the translator can emit a real Rust
struct with `one.score` instead of a name-value bag searched by string. That
is the other half of the C++ gap, and it is the only item here the numbers
support.
