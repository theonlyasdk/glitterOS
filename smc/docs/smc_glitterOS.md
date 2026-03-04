# glitterOS SMC Documentation

This document lists the glitterOS-specific Scriptable Macro Commands (SMC) and built-ins available when running scripts within the glitterOS Environment (Command Prompt / `runsmc`).

For general SMC syntax (variables, loops, procedures), see [Introduction to SMC](introduction_to_smc.md).

## Commands vs Procedures

In glitterOS, UI and System built-ins can be used in two distinct ways:

1. **As a Command:** Use it at the top level or inside blocks without assignment.
   ```smc
   msgbox "Title" "Hello World"
   ```
2. **As a Procedure (with return value):** Use the `[@name args]` syntax when you need to capture a return value or use it in an expression. **This is required for variable assignment.**
   ```smc
   var $name = [@input "User Info", "What is your name?"]
   ```

## Built-in UI & Interaction

### `msgbox`
Displays a modal message box.
- **Command:** `msgbox "Title" "Message" ["Icon"]`
- **Procedure:** `[@msgbox "Title", "Message", "Icon"]`
- **Returns:** `none`

### `input`
Prompts the user for text input.
- **Command:** `input "Title" "Prompt" ["Default"]`
- **Procedure:** `[@input "Title", "Prompt", "Default"]`
- **Returns:** The entered string, or `none` if cancelled.

### `dialog`
Displays a dialog with specific buttons (`ok`, `yesno`, `yesnocancel`).
- **Command:** `dialog "Title" "Message" "Type" ["Icon"]`
- **Procedure:** `[@dialog "Title", "Message", "Type", "Icon"]`
- **Returns:** The label of the clicked button (e.g., `"yes"`, `"no"`, `"ok"`, `"cancel"`).

### `notify`
Sends a system notification to the Action Centre.
- **Command:** `notify "Title|Message"`
- **Procedure:** `[@notify "Title|Message"]`
- **Returns:** `none`

## Metafunctions

Metafunctions use the `[?name arg]` syntax and provide system or type information.

* **`[?typeof $var]`**: Returns the type of a variable as a string (e.g., `"string"`, `"int"`, `"float"`, `"none"`, `"range"`).

## Filesystem Operations

These can be used as commands within scripts:

* `dir` / `ls`: Lists files.
* `cd` / `pwd`: Directory navigation.
* `md` / `mkdir`: Create directory (`-p` for parents).
* `del` / `rm`: Delete file.
* `rd` / `rmdir`: Remove directory (`-rf` for recursive).
* `ren` / `mv`: Rename/Move.
* `copy` / `cp`: Copy file.
* `type` / `cat`: Display file content.

## System & Environment

* `ver`: Display version.
* `cls` / `clear`: Clear terminal.
* `exit`: Terminate script/shell.
* `alias`: Define command shortcuts.
* `history`: Command history.
* `edit`: Open glitterOS Editor.
* `runsmc`: Execute SMC script.

## Usage Example

```smc
# Interactive Greeting Script
var $n = [@input "Enter n", "What is your name?", "Guest"]

if $n != none then
    msgbox "Welcome" "Hello %{$n}!" "ri-user-line"
    notify "System|User %{$n} logged in"
else
    msgbox "Notice" "User cancelled input"
end
```
