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

### Declaration
* **Local:** `var $VAR = value`
  Declared within a block (`if`, `while`, `proc`), it is only accessible inside that block. Redeclaring in the same scope triggers an error.
* **Global:** `global $VAR = value`
  Accessible everywhere and persists across script imports. Can be redeclared to update the value.

### Reassignment
Syntax: `$VAR = expression`
The interpreter searches the current block, then parent blocks, then the global scope for an existing variable to update.

### Expressions and Types
SMC supports Integers and Strings.
* **Math:** Standard `+`, `-`, `*`, `/` for integers.
* **String Concatenation:** `"Hello " + "World"`
* **String Repetition:** `"abc" * 3` results in `abcabcabc`.
* **Path Joining:** `$DIR / "subdir" / "file.txt"` automatically joins segments using DOS backslashes (e.g., `C:\Users\subdir\file.txt`).
* **Strict Typing:** By default, you cannot change a variable's type (e.g., assigning a string to a numeric variable) unless `![allow_casting]` is active.

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
```
while $COUNTER < 5 do
    echo "Iteration %{COUNTER}"
    $COUNTER = $COUNTER + 1
end
```

## Procedures (Functions)
Procedures use the `@` prefix for their names.
```
proc @setup_env : $user do
    md "C:\Users\%{user}\Desktop\Project"
    echo "Environment ready for %{user}"
end

# To call:
@setup_env "Admin"
```

## Built-in Commands
* Filesystem: `dir`, `cd`, `pwd`, `md`, `rd`, `copy`, `ren`, `del`, `type`
* System: `cls`, `ver`, `help`, `exit`, `wait`, `notify`, `runsmc`
* Logic: `echo`

## Example Scripts

### Example 1: Basic Session Init
```
![no_echo | allow_casting]

var $USER_NAME = "Guest"
global $BOOT_COUNT = 1

proc @init_session : $name do
    echo "Welcome, %{name}!"
    wait 500
end

@init_session $USER_NAME

var $I = 0
while $I < 3 do
    echo "Counting: %{I}"
    $I = $I + 1
end

var $LOG_PATH = "C:\logs" / "session.log"
echo "Log file: %{LOG_PATH}"
```

### Example 2: Interactive System Check
```
![no_echo]

proc @check_directory : $dir do
    if exists $dir then
        echo "Found system directory: %{dir}"
    else
        echo "Warning: %{dir} is missing!"
        notify "System Warning" "Directory %{dir} not found."
    end
end

echo "Starting system diagnostic..."
wait 1000

@check_directory "C:\glitterOS\System"
@check_directory "C:\Users\User\Documents"

echo "Diagnostic complete."
notify "System Status" "Diagnostic sequence finished successfully."
```
