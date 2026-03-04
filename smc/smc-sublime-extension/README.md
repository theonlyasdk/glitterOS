# SMC Syntax Highlighting for Sublime Text

This extension provides syntax highlighting for Scriptable Macro Commands (SMC) in Sublime Text.

## Installation Instructions

### Option 1: Automatic (Recommended)
If you have Node.js installed, simply run the following command from this directory:
```bash
node install.js
```

### Option 2: Manual
1.  **Locate your Sublime Text Packages directory:**
    *   **Windows:** `%APPDATA%\Sublime Text\Packages`
    *   **macOS:** `~/Library/Application Support/Sublime Text/Packages`
    *   **Linux:** `~/.config/sublime-text/Packages` (or `~/.config/sublime-text-3/Packages`)

2.  **Create a new folder** named `SMC` inside the `Packages` directory.

3.  **Copy the `SMC.sublime-syntax` file** from this directory into the newly created `SMC` folder.

4.  **Restart Sublime Text** (optional, it should detect the new file automatically).

5.  **Open an `.smc` file.** Sublime Text should automatically recognize the syntax. If not, go to `View -> Syntax -> SMC (Scriptable Macro Commands)`.

## Features
- Full support for keywords: `try`, `catch`, `for`, `none`, etc.
- Highlighting for result tags like `[:ok]` and `[:error]`.
- Procedure and variable highlighting (`@proc`, `$var`).
- String interpolation support (`%{VAR}`).
- Directive highlighting (`![...]`).
