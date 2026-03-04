The current SMC type system (int, string, range, none, result) is minimal and consistent with strict initialization and scoped variables. However, the absence of aggregate types forces developers to encode structured data in strings or procedural conventions. This limits expressiveness, composability, and performance. The language should introduce first-class **arrays** and **objects (maps)** as core value types, fully integrated into typing, scoping, compilation, and the Result system.

The following proposal preserves SMC’s explicitness and strict typing model.

---

Arrays

1. New Type

`array` becomes a primitive composite type.

`[?typeof $x]` returns `"array"`.

2. Literal Syntax

Use bracket literals to align with existing bracket semantics while remaining visually distinct from procedure calls:

```
var $nums = [1, 2, 3, 4]
var $strings = ["a", "b", "c"]
var $empty = []
```

Commas are mandatory separators, consistent with procedure argument rules.

3. Indexing

Use bracket indexing after a variable:

```
$nums[0]
$nums[1] = 10
```

Indexing is zero-based. Out-of-bounds access returns `[:error "Index out of bounds"]` if used in expression context, or throws runtime error in strict mode.

4. Strict Typing Model

Two possible designs:

A. Homogeneous arrays (recommended)
Array type is inferred at creation:

```
var $nums = [1, 2, 3]      # array<int>
```

Mixing types triggers error unless `![allow_casting]` is enabled.

B. Heterogeneous arrays
Allow mixed types but reduce compile-time optimization potential.

Given `smcc` compiles to C and emphasizes performance, homogeneous arrays are preferable.

5. Built-in Array Functions

All follow existing `[@func args]` syntax:

```
[@len $arr]              # length
[@push $arr, value]      # append
[@pop $arr]              # remove last
[@insert $arr, index, value]
[@remove_at $arr, index]
[@slice $arr, start, end]
[@contains $arr, value]
```

`[@len]` becomes polymorphic for string and array.

6. For Loop Integration

Extend `for` to iterate arrays:

```
for $item in $nums do
    echo "%{item}"
end
```

The interpreter resolves iterable types (`range`, `array`).

7. Compilation Model

In `smcc`, arrays compile to:

* Struct with:

  * pointer to data
  * length
  * capacity
  * element type enum
* Bounds-checked access
* Amortized reallocation for `push`

This aligns with the existing hash-table variable registry architecture.

---

Objects (Maps)

1. New Type

`object` or `map` type.

`[?typeof $x]` returns `"object"`.

2. Literal Syntax

Curly braces are recommended to avoid conflict with existing bracket syntax:

```
var $user = {
    "name": "Alice",
    "age": 25
}
```

Keys must be strings (simplifies hashing and C compilation).

3. Access Syntax

Dot access for identifier-safe keys:

```
$user.name
```

Bracket access for dynamic keys:

```
$user["name"]
var $key = "age"
$user[$key]
```

Missing key returns `none` (consistent with falsy semantics), unless strict mode is later introduced.

4. Mutation

```
$user.age = 26
$user["email"] = "a@example.com"
```

5. Built-in Map Functions

```
[@keys $obj]          # returns array<string>
[@values $obj]        # returns array
[@has_key $obj, key]
[@remove_key $obj, key]
[@merge $obj1, $obj2]
```

6. Iteration

Allow structured iteration:

```
for $pair in $user do
    echo "%{$pair.key}: %{$pair.value}"
end
```

Internally, iteration yields temporary objects:

```
{ "key": "...", "value": ... }
```

Alternative syntax (more explicit, cleaner):

```
for $k, $v in $user do
    echo "%{$k}: %{$v}"
end
```

This is preferable and more performant.

7. Compilation Model

Objects compile to:

* Hash table structure
* String key → typed value union
* Stored type metadata for runtime checks

Since SMC already uses hash tables for variable registry, implementation can reuse internal structures.

---

Type System Integration

Update supported types list:

* int
* string
* range
* array
* object
* none
* result

Extend `[?typeof]` accordingly.

Strict typing rules:

* Arrays enforce consistent element type.
* Objects allow heterogeneous values but preserve static type of stored value.
* Reassignment respects `allow_casting`.

Example:

```
var $data = {
    "numbers": [1, 2, 3],
    "title": "Report"
}
```

Nested composites are fully supported.

---

Error Handling Compatibility

Access errors should integrate with Result system when used inside expressions:

```
var $val = try $arr[10] catch $err then return [:error $err]
```

Compiler should generate safe accessor wrappers returning Result internally.

---

Why This Is Necessary

1. Removes string-based data encoding hacks.
2. Enables structured APIs and real data modeling.
3. Dramatically improves viability for compiled workloads.
4. Aligns SMC with modern scripting languages while retaining strictness.
5. Makes filesystem metadata, JSON-like structures, and configuration modeling natural.

Without arrays and objects, SMC remains procedural automation. With them, it becomes a general-purpose systems scripting language.

---

Minimal Working Example After Extension

```
var $users = [
    {"name": "Alice", "age": 25},
    {"name": "Bob", "age": 30}
]

for $u in $users do
    if $u.age > 26 then
        echo "%{$u.name} is over 26"
    end
end
```

This level of expressiveness is currently impossible without brittle string manipulation.

The addition of arrays and objects is not cosmetic. It is foundational for language maturity, compiler leverage, and long-term scalability.
