# SMC Language Reference: Syntax Updates

## 1. Function Invocation and Assignment

SMC uses a bracketed syntax for function calls, with arguments separated by commas.

```
# Basic function call
[@my_func $somevar, $anothervar]

```

Functions can return values, which are captured using the `var` keyword for declaration. Variables can be freely reassigned later without the `var` keyword.

```
# Declaration and assignment
var $result = [@do_something $arg1, $arg2]

# Reassignment
$result = [@do_something_else $arg3, $arg4]

```

### Example: Conditional Logic in Procedures

SMC uses `if ... then ... else ... end` for control flow.

```
proc @check_directory : $dir do
    if exists $dir then
        return true
    else
        echo "Warning: %{dir} is missing!"
        notify "System Warning" "Directory %{dir} not found."
        return false
    end
end

```

---

## 2. The `none` Value and Strict Initialization

Unlike many scripting languages that default uninitialized variables to a null state, **SMC strictly requires explicit initialization**. You cannot declare a variable without assigning it a value.

```
# ILLEGAL: This will throw an error in SMC
var $something 

# LEGAL: Explicitly assign 'none' if you want an empty variable
var $novalue = none

```

### Casting and Truthiness

`none` values are intrinsically "falsy" and can be safely evaluated in boolean contexts. They can also be reassigned to other types implicitly.

```
var $something = none

# Reassignment is allowed
$something = 10 

# Checking for falsy values
if !$something then
    echo "$something is a none value"
end

```

---

## 3. Error Handling and the Result Type

Functions in SMC often return a "Result Wrapper" rather than a raw value. This ensures developers explicitly handle potential failures. Results are constructed using the built-in `[:ok $value]` and `[:error $err]` tags.

SMC provides three distinct ways to unwrap these results, scaling from explicit block logic to concise auto-propagation.

### Option A: The Block Catch (For Complex Logic)

Use `try ... catch ... do` when you need to perform cleanup, logging, or multi-step logic before returning the error. If the call succeeds, the raw, unwrapped data is assigned to the variable.

```
proc @get_data : $id do
    var $data = try [@fetch $id] catch $err do
        # Triggered only if [@fetch] returns an [:error] wrapper
        [@log "Fetch failed for id: %{id}"]
        return [:error $err]
    end

    # If successful, $data contains the raw value, not the [:ok] wrapper.
    return [:ok $data]
end

```

### Option B: The Inline Catch (For Quick Exits)

For simple error bubbling without side-effects, use the `then` keyword to keep the logic perfectly flat on a single line.

```
# Reads cleanly left-to-right
var $data = try [@fetch $id] catch $err then return [:error $err]

```

### Option C: Auto-Bubbling (The `try?` Operator)

When you simply want to pass any encountered errors directly up to the calling function, use the `try?` operator. This automatically unwraps the value on success, or immediately returns `[:error $err]` on failure.

```
# Safely unwraps the value, or halts execution and returns the error
var $data = try? [@fetch $id]

```

### Summary of Error Operators

| Operator/Pattern | Behavior | Best Use Case |
| --- | --- | --- |
| `try ... catch do` | Opens a block for the error state. | Cleanup, logging, or fallback logic. |
| `try ... catch then` | Executes a single inline statement on error. | Quick, explicit error returns. |
| `try?` | Implicitly returns the error upward. | Fast scripting and chaining calls. |

Here is a draft for the loops section of the SMC documentation. I have included your existing `while` loop syntax and designed a clean, readable `for` loop syntax that fits perfectly with SMC's `do ... end` block structure and `$var` conventions.

I also added standard loop controls (`break` and `continue`) to make the section complete.

---

