# SMC (Scriptable Macro Commands) - Future Enhancements Roadmap

This document outlines proposed features and improvements to make SMC a more powerful and versatile scripting language for glitterOS.

## 1. UI & Interaction
- **`msgbox` Function:** Allow scripts to open native system message boxes with custom buttons and icons.
  - Syntax: `[@msgbox "Title" "Message body text" <icon_name> <buttons_type>]`
- **`input` Function:** Pause script execution to wait for user input from the terminal or a dialog.
  - Syntax: `[@input "Enter your name: "]` (returns the value)
- **`dialog` Function:** Open specialized dialogs (file picker, folder picker, color picker).

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
