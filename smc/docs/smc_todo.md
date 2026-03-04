# SMC (Scriptable Macro Commands) - Future Enhancements Roadmap

This document outlines proposed features and improvements to make SMC a more powerful and versatile scripting language for glitterOS.

## 2. System Integration
- **Registry Access:** Direct commands to read, write, and delete registry keys.
  - Syntax: `regread $VAR "Path.To.Key"`, `regwrite "Path.To.Key" $VALUE`
- **Process Management:** Ability to list running processes and terminate them.
  - Syntax: `pslist`, `pskill "process_name.exe"`
- **Environment Variables:** Access to system-wide environment variables (e.g., `%PATH%`, `%USER%`).

## 3. Language Features
- **Array/List Support:** Capability to store and iterate over collections of items.
  - Syntax: `var $LIST = ["item1", "item2"]`, `foreach $ITEM in $LIST do ... end`
- **JSON Support:** Built-in parsing and stringifying of JSON data.
  - Syntax: `jsonparse $OBJ $STRING`, `jsonget $VAL $OBJ "property.name"`
- **Enhanced Math:** Additional mathematical functions and constants.
  - Functions: `random()`, `floor()`, `ceil()`, `sin()`, `cos()`.
- **Date/Time Commands:** Commands to fetch current timestamp, date, and time segments.

## 4. Networking
- **Simple HTTP Requests:** Capability to perform basic GET/POST requests to interact with external APIs.
  - Syntax: `httpget $VAR "https://api.example.com/data"`

## 5. Scripting Utilities
- **`error` Command:** Manually trigger a script error with a custom message and halt execution.
  - Syntax: `error "Critical failure in script logic"`
- **`include` Directive:** Similar to `import` but merges the file content directly into the current scope at parse time.
- **Function Return Values:** Allow procedures to return values to the caller.
  - Syntax: `return $VALUE`





















  1. Ownership of Effects (Not Memory — Side Effects)

Instead of Rust owning memory, SMC owns side effects.

Every operation that mutates filesystem, globals, or external state produces an *effect token*. That token must be explicitly transferred or consumed.

Concept:

```
var $e = effect copy "a.txt", "b.txt"
commit $e
```

If you do not `commit` the effect, it never happens. Effects cannot be duplicated. They must be moved.

You can pass effects into procedures:

```
proc @apply : $effect do
    commit $effect
end
```

This makes destructive actions linear resources. No accidental deletes. No hidden global mutations. The language enforces intentional side effects at the type level.

2. Compile-Time Execution as a First-Class Phase

Zig exposes comptime. Push this further: SMC scripts can explicitly declare code that runs in a *pre-interpreter phase* that can modify the script before execution.

Concept:

```
phase build do
    generate proc @auto_1 .. @auto_100
end
```

The `build` phase:

* Can read filesystem.
* Can inspect other procedures.
* Can emit new code blocks.

After the build phase, the resulting transformed script becomes the runtime script.

SMC becomes self-hosting at the script level without a separate macro system.

3. Structural Pattern Execution (Control Flow by Shape)

Instead of `if` and `while`, allow execution blocks triggered by structural patterns in state.

Concept:

```
when global matches {
    $A: 10,
    $B: none
} do
    echo "Pattern matched"
end
```

The block executes automatically the moment the global state matches the structural shape.

No polling. No loop. The runtime becomes reactive and structural, not sequential.

This is not event-driven. It is state-shape–driven execution.

4. Explicit Failure Domains

Rust has `Result`. Push it further: define failure isolation zones.

Concept:

```
domain filesystem do
    copy "a.txt", "b.txt"
    del "a.txt"
end
```

If any command inside fails:

* The entire domain rolls back automatically.
* All filesystem changes revert.
* Only effects inside that domain are reverted.

You can nest domains:

```
domain system
    domain filesystem
        ...
    end
end
```

This gives transactional semantics at the language level without manual `try` plumbing.

5. Deterministic Concurrency by Default

Introduce a `co` block that runs in parallel, but the language forbids shared mutation unless explicitly synchronized.

Concept:

```
co do
    var $x = 10
end

co do
    var $x = 20
end
```

Each `co` block runs concurrently in isolation.

To share state, you must declare:

```
shared global $COUNT = 0
```

And mutations must use atomic syntax:

```
atomic $COUNT += 1
```

No implicit race conditions possible. The interpreter enforces deterministic scheduling unless you opt into nondeterminism.

This gives SMC a strong identity: safe parallel scripting without thread libraries.

---

These are not abstract or metaphysical features. They are structural identity features — the kind that define languages like Rust (ownership), Zig (comptime), or Go (goroutines). Each one could become the defining characteristic of SMC rather than an exotic extension.
