# Scriptable Macro Commands (SMC) Documentation

## Overview
Scriptable Macro Commands (SMC) is the native automation and scripting language for glitterOS. It allows for complex task automation, filesystem management, and system control using a DOS-inspired syntax with modern programming features like block scoping, procedures, and type-aware expressions.

## Syntax and Structure

### Comments
Comments can be full-line or inline.
* `# comment` or `// comment` or `rem comment`
* `echo "Hello" # This is an inline comment`

### Interpreter Directives
Directives must appear at the very top of the script.
Syntax: `![flag1 | flag2]`
* `ignore_errors`: Continues execution if a command fails.
* `no_echo`: Does not print commands to the terminal before executing them.
* `silent`: Suppresses all output (including `echo`).
* `allow_casting`: Permits variable reassignment with a different data type.
* `echo_var_values`: Prints the value of a standalone variable reference (e.g. `$VAR` on its own line).

## Variables and Scoping

### Naming Convention
All variable names **must** be prefixed with the `$` character (e.g., `$COUNTER`, `$MY_FILE`).

### Declaration and Strict Initialization
SMC strictly requires **explicit initialization**. You cannot declare a variable without assigning it a value.
* **Local:** `var $VAR = value`
  Declared within a block (`if`, `while`, `proc`), it is only accessible inside that block. Redeclaring in the same scope triggers an error.
* **Global:** `global $VAR = value`
  Accessible everywhere and persists across script imports. Can be redeclared to update the value.

To declare an "empty" variable, explicitly assign the `none` value:
```
var $novalue = none
```

### Reassignment
Syntax: `$VAR = expression`
The interpreter searches the current block, then parent blocks, then the global scope for an existing variable to update.

### The `none` Value and Truthiness
`none` values are intrinsically "falsy" and can be safely evaluated in boolean contexts. They can also be reassigned to other types implicitly.
```
var $something = none
if !$something then
    echo "$something is a none value"
end
```

### Expressions and Types
SMC supports Integers, Strings, and Ranges.
* **Math:** Standard `+`, `-`, `*`, `/` for integers.
* **String Concatenation:** `"Hello " + "World"`
* **String Repetition:** `"abc" * 3` results in `abcabcabc`.
* **Path Joining:** `$DIR / "subdir" / "file.txt"` automatically joins segments using DOS backslashes.
* **Ranges:** `1..10` creates a range from 1 to 10.
* **Strict Typing:** By default, you cannot change a variable's type unless `![allow_casting]` is active.

## Function Invocation
SMC uses a bracketed syntax for function calls, with arguments separated by commas.
```
# Basic function call
[@my_func $arg1, $arg2]

# Capture return value
var $result = [@do_something $arg1]
```

## Control Flow

### Conditional Statements
```
if $VAR == 10 then
    echo "Value is ten"
else
    echo "Value is not ten"
end
```

### Loops
SMC provides `while` and `for` loops. All loops use the `do ... end` block structure.

**While Loop:**
```
while $COUNTER < 5 do
    echo "Iteration %{COUNTER}"
    $COUNTER = $COUNTER + 1
end
```

**For Loop (Ranges):**
```
for $i in 1..5 do
    echo "Iteration %{i}"
end
```

### Loop Control: `break` and `continue`
* **`break`**: Immediately exits the loop.
* **`continue`**: Skips to the next iteration.

## Procedures (Functions)
Procedures use the `@` prefix. They can accept arguments and return values using the `return` keyword.
```
proc @add_numbers : $a, $b do
    return $a + $b
end

var $SUM = [@add_numbers 10, 20]
```

## Error Handling and the Result Type
Functions often return a **Result Wrapper**: `[:ok $value]` or `[:error $err]`. SMC provides three ways to unwrap them:

### 1. The Block Catch
```
var $data = try [@fetch $id] catch $err do
    echo "Error: %{err}"
    return [:error $err]
end
```

### 2. The Inline Catch
```
var $data = try [@fetch $id] catch $err then return [:error $err]
```

### 3. Auto-Bubbling (`try?`)
The `try?` operator automatically unwraps the value on success or immediately returns the `[:error]` on failure.
```
var $data = try? [@fetch $id]
```

## Built-in Commands
* Filesystem: `dir`, `cd`, `pwd`, `md`, `rd`, `copy`, `ren`, `del`, `type`, `exists`
* System: `cls`, `ver`, `help`, `exit`, `wait`, `notify`, `runsmc`
* Logic: `echo`, `return`

## Built-in Functions
SMC includes core mathematical functions that can be called using the `[@func args]` syntax:
* `[@random min, max]`: Returns a random number between `min` and `max`.
* `[@floor x]`: Returns the largest integer less than or equal to `x`.
* `[@ceil x]`: Returns the smallest integer greater than or equal to `x`.
* `[@round x]`: Returns the value of `x` rounded to the nearest integer.
* `[@abs x]`: Returns the absolute value of `x`.
* `[@sqrt x]`: Returns the square root of `x`.
* `[@pow base, exp]`: Returns `base` raised to the power of `exp`.
* `[@sin x]`, `[@cos x]`: Returns the sine or cosine of `x` (in radians).

## Example Scripts

### Example: Robust System Check
```
![no_echo]

proc @check_directory : $dir do
    if exists $dir then
        return [:ok true]
    else
        return [:error "Directory %{dir} not found"]
    end
end

var $res = try [@check_directory "C:\glitterOS"] catch $err do
    notify "System Error" $err
    exit
end

echo "System check passed!"
```
