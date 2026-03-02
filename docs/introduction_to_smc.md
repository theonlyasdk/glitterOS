# Scriptable Macro Commands (SMC) Documentation

## Overview
Scriptable Macro Commands (SMC) provide a structured scripting language designed for automating tasks within the glitterOS operating system. SMC scripts are executed by the command prompt, offering control flow, variable assignments, modularity via imports, and procedure definitions.

## Syntax and Structure

### Comments
Comments can be defined using three different notations. Any line beginning with these notations will be ignored by the interpreter.
* `# comment`
* `// comment`
* `rem comment`

### Interpreter Directives
Directives instruct the interpreter on how to execute the script. They must appear at the beginning of the script, prior to any other statements.
Syntax: `![flag1 | flag2]`
Available flags:
* `ignore_errors` - Ignores any errors that happen during execution, preventing the script from terminating during errors.
* `no_echo` - Disables echo-ing of commands being executed.
* `silent` - Disables any output from the script, including any command echoes, and output from the `echo` command.
* `echo_var_values` - If enabled, standalone variable references (e.g., `$VAR` on a new line) will print their values to the terminal instead of causing a warning.

### Commands
#### wait
Pauses the script execution for a specified number of milliseconds.
Syntax:
* `wait <milliseconds>`
* `wait $variable`

Example:
```
echo "Starting process..."
wait 2000
echo "Done."
```

### Variable Assignment and Scoping
Variables can be assigned using `var`, `let`, `set`, or `global`. All variable names **must** be prefixed with the `$` character.

#### Local Variables
Variables declared with `var`, `let`, or `set` are block-local. They are only accessible within the block (if, while, proc) where they were declared. Redeclaring a local variable with the same name in the same scope will result in an error.
Syntax:
* `var $variable_name = value`
* `let $variable_name = value`
* `set $variable_name = value`

#### Global Variables
Variables declared with `global` are available globally and retain their value even after the block where they were declared ends. Declaring a global variable that already exists will simply update its value without error.
Syntax:
* `global $variable_name = value`

#### Standalone Variable References
If a variable reference (e.g., `$VAR`) appears alone on a line:
* By default, the interpreter will issue a **Warning** about an unused value.
* If the `echo_var_values` directive is active, the interpreter will print the variable's value to the terminal.
* If the variable is not defined, an **Error** is issued.

#### Reassignment
If a variable is assigned without a keyword, the interpreter searches up the scope chain (local scope, then parent scopes, then global scope) to find and update an existing variable. If no variable is found, it creates a new local variable in the current scope.
Syntax:
* `$variable_name = value`

### Control Flow
#### Conditional Statements (If/Else)
Conditional execution is supported via `if/then/else/end` blocks.
Syntax:
```
if condition then
    # commands
else
    # commands
end
```

#### Loops (While)
Iteration is supported through `while/do/end` blocks.
Syntax:
```
while condition do
    # commands
end
```

### Procedures (Functions)
Procedures allow the encapsulation of reusable blocks of code. They can accept arguments.
Syntax:
```
proc procedure_name : arg1, arg2 do
    # commands
end
```

### Imports
Scripts can import and execute other SMC scripts to maintain modularity.
Syntax:
`import script_name.smc`

## Sample Applications

### Example 1: Basic Automation with Conditional Checks
```
![silent | ignore_errors]

let TARGET_DIR = /usr/local/bin
let TEMP_FILE = temp.txt

if exists TARGET_DIR then
    echo Directory exists. Proceeding with operation.
    touch TARGET_DIR/TEMP_FILE
else
    echo Target directory not found.
end
```

### Example 2: Repetitive Tasks and Procedures
```
![no_echo]

proc create_user_workspace : username do
    let WORKSPACE = /home/username/workspace
    mkdir WORKSPACE
    echo Workspace created for username
end

let COUNTER = 0
while COUNTER < 3 do
    create_user_workspace user_COUNTER
    let COUNTER = COUNTER + 1
end
```

### Example 3: Modularity via Imports
**main.smc:**
```
import config.smc
import utils.smc

if IS_CONFIGURED then
    execute_main_routine
end
```
