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
Syntax: `![flag1 | flag2 | ...]`
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
    echo "%{something} is a none value"
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

## Compilation (SMC to C)
glitterOS includes a high-performance native compiler (`smcc`) that transpiles SMC scripts into memory-safe C code and then compiles them into native binaries.

### Using the Compiler
Use the `smcc.js` tool located in `smc/tools/`:
```bash
node smc/tools/smcc.js script.smc -o script.exe
```

### Performance Benefits
The compiled C version typically runs **100x - 120x faster** than the interpreter for computationally heavy tasks, thanks to a native hash-table based variable registry and direct machine code execution.

### Debugging Compiled Apps
You can compile with the `--debug` flag to see runtime allocation and call traces:
```bash
node smc/tools/smcc.js script.smc --debug
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

## Procedure Invocation
SMC uses a bracketed syntax for both built-in and user-defined procedures.

## Procedures (Functions)

### `@` Prefix for Procedure Names
Every function or procedure call **must** be prefixed with the `@` character. Calls without this prefix (e.g., `[sqrt 16]`) will result in an error.

### Comma Separation of Arguments
Arguments in bracketed calls **must** be separated by commas if there is more than one argument.
```
# Capture return value
var $result = [@func_that_requires_2_args $val1, $val2]
```

### Example
```
proc @add_numbers : $a, $b do
    return $a + $b
end

# Basic procedure call syntax
# [@my_proc $arg1, $arg2]

var $SUM = [@add_numbers 10, 20]
```

## Error Handling and the Result Type
Procedures often return a **Result Wrapper**: `[:ok $value]` or `[:error $err]`. SMC provides three ways to unwrap them:

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
* System: `echo`
* ... you can declare your own built-in commands by creating a custom interpreter wrapper using SMC.js library

## Built-in Functions
SMC includes core mathematical and string functions. All must be called using the `[@func args]` syntax:
* `[@random min, max]`: Returns a random number between `min` and `max`.
* `[@sqrt x]`: Returns the square root of `x`.
* `[@append str1, str2, ...]`: Concatenates multiple strings together (preferred over `+`).
* `[@abs x]`: Returns the absolute value of `x`.
* `[@floor x]`, `[@ceil x]`, `[@round x]`: Standard rounding functions.
* `[@pow base, exp]`: Returns `base` raised to the power of `exp`.
* `[@sin x]`, `[@cos x]`: Trigonometric functions (radians).
* `[@upper str]`, `[@lower str]`, `[@trim str]`: String case and whitespace manipulation.
* `[@len str]`: Returns the length of a string.
* `[@replace str, search, replacement]`: Replaces occurrences within a string.
* `[@index_of str, search]`: Finds the position of a substring.
* `[@char_at str, index]`: Returns the character at a specific position.

## Metafunctions
Metafunctions return information associated with the SMC script itself.
* `[?typeof x]`: Returns the data type of the value ("int", "float", "string", "bool", "none", "range").

## Example Scripts

### Example 1: glitterOS-specific script
The following script checks if `C:\glitterOS` directory is present inside the glitterOS filesystem by calling a glitterOS specific `exists` builtin.
This would result in an error if you try to compile it with `smcc`, but feel free to provide your own implementation for `exists` if you wish to use it!
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
    var $errstr = [@append "System check failed: ", $err]

    # Syntax of 1st arg of notify is "Title|Message"
    # Here, notify sends a notification to glitterOS NotificationService
    notify "Error!|%{errstr}"
    exit
end

echo "System check passed!"
```
