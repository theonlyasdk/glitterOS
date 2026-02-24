// ── glitterOS Command Prompt — Windows CMD style ──────────────────────────────

function launchCommandPrompt(autoRun = null, isBoot = false) {
    // Container
    const container = document.createElement('div');
    container.className = 'lde-cmd';

    // The single scrollable terminal surface (output + inline input all here)
    const terminal = document.createElement('div');
    terminal.className = 'lde-cmd-terminal';
    terminal.tabIndex = 0; // make focusable
    container.appendChild(terminal);

    // Hidden real input that captures keystrokes
    const hiddenInput = document.createElement('input');
    hiddenInput.className = 'lde-cmd-hidden-input';
    hiddenInput.type = 'text';
    hiddenInput.autocomplete = 'off';
    hiddenInput.spellcheck = false;
    container.appendChild(hiddenInput);

    // ── State ─────────────────────────────────────────────────────────────────
    const cmdHistory = registry.get('cmd.history', []);
    let histIdx = -1;
    let _activeLine = null; // the live editable prompt line at the bottom

    // ── Path helpers ──────────────────────────────────────────────────────────
    function getPrompt() {
        return fs.pwd() + '> ';
    }

    // ── Output helpers ────────────────────────────────────────────────────────
    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function appendLine(text, cls = '') {
        // Inject before the active input line
        const div = document.createElement('div');
        div.className = 'lde-cmd-line' + (cls ? ' ' + cls : '');
        div.textContent = text;
        if (_activeLine) terminal.insertBefore(div, _activeLine);
        else terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function appendHTML(html, cls = '') {
        const div = document.createElement('div');
        div.className = 'lde-cmd-line' + (cls ? ' ' + cls : '');
        div.innerHTML = html;
        if (_activeLine) terminal.insertBefore(div, _activeLine);
        else terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // ── Active inline prompt line ─────────────────────────────────────────────
    function createActiveLine() {
        _activeLine = document.createElement('div');
        _activeLine.className = 'lde-cmd-line lde-cmd-active-line';
        terminal.appendChild(_activeLine);
        refreshActiveLine();
    }

    function refreshActiveLine() {
        if (!_activeLine) return;
        const val = hiddenInput.value;
        const cur = hiddenInput.selectionStart ?? val.length;
        // Split around cursor for blinking block render
        const before = escHtml(val.slice(0, cur));
        const after = escHtml(val.slice(cur + 1));
        const curChar = escHtml(val[cur] || ' ');
        _activeLine.innerHTML =
            `<span class="lde-cmd-prompt">${escHtml(getPrompt())}</span>` +
            `<span class="lde-cmd-typed">${before}</span>` +
            `<span class="lde-cmd-cursor">${curChar}</span>` +
            `<span class="lde-cmd-typed">${after}</span>`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    function commitActiveLine(rawCmd) {
        // Turn active line into a static "echo" line, then make new active line
        if (_activeLine) {
            _activeLine.innerHTML =
                `<span class="lde-cmd-prompt">${escHtml(getPrompt())}</span>` +
                `<span class="lde-cmd-typed">${escHtml(rawCmd)}</span>`;
            _activeLine.classList.remove('lde-cmd-active-line');
            _activeLine = null;
        }
    }

    // ── Command definitions (Windows CMD style) ───────────────────────────────
    const CMDS = {
        help() {
            appendHTML(
                '<span style="color:#e8c84a;font-weight:bold">HELP</span><br>' +
                'For more information on a specific command, type HELP command-name<br><br>' +
                '<span style="color:#e8c84a">CLS</span>       Clears the screen.<br>' +
                '<span style="color:#e8c84a">CD</span>        Displays or changes the current directory.<br>' +
                '<span style="color:#e8c84a">DIR</span>       Displays a list of files and subdirectories in a directory.<br>' +
                '<span style="color:#e8c84a">TYPE</span>      Displays the contents of a text file.<br>' +
                '<span style="color:#e8c84a">ECHO</span>      Displays messages.<br>' +
                '<span style="color:#e8c84a">MD / MKDIR</span>  Creates a directory.<br>' +
                '<span style="color:#e8c84a">DEL</span>       Deletes one or more files.<br>' +
                '<span style="color:#e8c84a">RD / RMDIR</span> Removes a directory.<br>' +
                '<span style="color:#e8c84a">REN</span>       Renames a file.<br>' +
                '<span style="color:#e8c84a">COPY</span>      Copies one file to another location.<br>' +
                '<span style="color:#e8c84a">EDIT</span>      Starts the glitterOS Editor.<br>' +
                '<span style="color:#e8c84a">VER</span>       Displays the Windows version.<br>' +
                '<span style="color:#e8c84a">EXIT</span>      Quits the CMD program.'
            );
        },
        cls() {
            // Remove all lines except the active one
            Array.from(terminal.children).forEach(c => {
                if (c !== _activeLine) c.remove();
            });
        },
        ver() {
            appendLine('glitterOS [Version 4.2.0.6969]');
            appendHTML('(c) glitterOS Corporation. All rights reserved. Type <span style="color:#e8c84a">HELP</span> for help.');
            appendLine('glitterOS Command Prompt v1.0');
        },
        cd(args) {
            if (!args[0] || args[0] === '/d') {
                appendLine(fs.pwd());
                return;
            }
            const target = args[args[0] === '/d' ? 1 : 0] || '~';
            const res = fs.cd(target);
            if (res.error) appendLine(
                'The system cannot find the path specified.', 'lde-cmd-err'
            );
        },
        dir(args) {
            const path = args[0] ? args[0] : '.';
            const res = fs.ls(path);
            if (res.error) { appendLine('File Not Found', 'lde-cmd-err'); return; }
            const winPath = path === '.' ? fs.pwd() : path;
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            appendLine(` Directory of ${winPath}\n`);
            if (res.entries.length === 0) {
                appendLine(' No items in this directory');
            } else {
                let dirs = 0, files = 0;
                res.entries.forEach(e => {
                    const tag = e.type === 'dir' ? escHtml('<DIR>') : '     ';
                    const col = e.type === 'dir' ? '#7ec8ff' : '#cccccc';
                    appendHTML(`${escHtml(dateStr)}  ${escHtml(timeStr)} <span style="color:${col}">${tag}</span>   ${escHtml(e.name)}`);
                    e.type === 'dir' ? dirs++ : files++;
                });
                appendLine(`\n       ${files} File(s)   ${dirs} Dir(s)`);
            }
        },
        type(args) {
            if (!args[0]) { appendLine('The syntax of the command is incorrect.', 'lde-cmd-err'); return; }
            const res = fs.cat(args[0]);
            if (res.error) { appendLine('The system cannot find the file specified.', 'lde-cmd-err'); return; }
            res.content.split('\n').forEach(l => appendLine(l));
        },
        echo(args) {
            appendLine(args.join(' '));
        },
        md(args) {
            if (!args[0]) { appendLine('The syntax of the command is incorrect.', 'lde-cmd-err'); return; }
            const res = fs.mkdir(args[0]);
            if (res.error) appendLine('A subdirectory or file already exists.', 'lde-cmd-err');
        },
        mkdir(args) { CMDS.md(args); },
        del(args) {
            if (!args[0]) { appendLine('The syntax of the command is incorrect.', 'lde-cmd-err'); return; }
            const res = fs.rm(args[0]);
            if (res.error) appendLine('Could Not Find ' + args[0], 'lde-cmd-err');
        },
        rd(args) {
            if (!args[0]) { appendLine('The syntax of the command is incorrect.', 'lde-cmd-err'); return; }
            const res = fs.rmdir(args[0]);
            if (res.error) appendLine(res.error.includes('empty') ?
                'The directory is not empty.' : 'The system cannot find the path specified.', 'lde-cmd-err');
        },
        rmdir(args) { CMDS.rd(args); },
        ren(args) {
            if (args.length < 2) { appendLine('The syntax of the command is incorrect.', 'lde-cmd-err'); return; }
            const catRes = fs.cat(args[0]);
            if (catRes.error) { appendLine('The system cannot find the file specified.', 'lde-cmd-err'); return; }
            fs.write(args[1], catRes.content);
            fs.rm(args[0]);
        },
        copy(args) {
            if (args.length < 2) { appendLine('The syntax of the command is incorrect.', 'lde-cmd-err'); return; }
            const catRes = fs.cat(args[0]);
            if (catRes.error) { appendLine('The system cannot find the file specified.', 'lde-cmd-err'); return; }
            fs.write(args[1], catRes.content);
            appendLine('        1 file(s) copied.');
        },
        edit(args) {
            launchEdit(args[0], container, () => {
                setTimeout(() => hiddenInput.focus(), 50);
                refreshActiveLine();
            });
        },
        exit() {
            const winObj = wm.windows.find(w => w.element === container.closest('.lde-window'));
            if (winObj) wm.closeWindow(winObj.id);
        },
        history(args) {
            if (args[0] === 'clear') {
                cmdHistory.length = 0;
                registry.set('cmd.history', []);
                appendLine('Command history cleared.');
            } else {
                if (cmdHistory.length === 0) {
                    appendLine('History is empty.');
                } else {
                    [...cmdHistory].reverse().forEach((line, i) => {
                        appendLine(`  ${i + 1}  ${line}`);
                    });
                }
            }
        }
    };

    // ── Input dispatch ────────────────────────────────────────────────────────
    function dispatch(raw) {
        const line = raw.trim();
        if (!line) return;

        // Try built-in commands first
        const tokens = line.split(/\s+/);
        const cmd = tokens[0].toLowerCase();
        const args = tokens.slice(1);

        if (CMDS[cmd]) {
            CMDS[cmd](args);
            return;
        }

        // Try as an executable
        // Check current directory, then C:\Windows\System32
        const possiblePaths = [
            line,
            line + '.exe',
            'C:\\Windows\\System32\\' + line,
            'C:\\Windows\\System32\\' + line + '.exe'
        ];

        for (const p of possiblePaths) {
            if (fs.exists(p)) {
                const res = SystemExec.run(p);
                if (res.ok) return;
                if (res.error === 'App not installed') return; // error already shown
                // if other error, continue or show
            }
        }

        appendLine(`'${cmd}' is not recognized as an internal or external command, \noperable program or batch file.`, 'lde-cmd-err');
    }

    // ── Keyboard handler ──────────────────────────────────────────────────────
    hiddenInput.addEventListener('input', () => refreshActiveLine());

    let tabMatches = [];
    let tabIndex = -1;
    let tabPrefix = '';
    let tabBase = '';

    hiddenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const val = hiddenInput.value;
            if (tabMatches.length > 0) {
                // Cycle
                tabIndex = (tabIndex + 1) % tabMatches.length;
                const match = tabMatches[tabIndex];
                hiddenInput.value = tabBase + match;
                refreshActiveLine();
                return;
            }

            // New search
            const parts = val.split(/\s+/);
            const lastPart = parts[parts.length - 1];
            if (lastPart === undefined) return;

            let searchPath = '.';
            let prefix = lastPart;

            if (lastPart.includes('\\')) {
                const lastSlash = lastPart.lastIndexOf('\\');
                searchPath = lastPart.substring(0, lastSlash) || '\\';
                prefix = lastPart.substring(lastSlash + 1);
            }

            const res = fs.ls(searchPath);
            if (res.entries) {
                tabMatches = res.entries
                    .filter(e => e.name.toLowerCase().startsWith(prefix.toLowerCase()))
                    .map(e => e.name);

                if (tabMatches.length > 0) {
                    tabIndex = 0;
                    tabPrefix = prefix;
                    tabBase = val.substring(0, val.length - prefix.length);
                    hiddenInput.value = tabBase + tabMatches[0];
                    refreshActiveLine();
                }
            }
        } else if (e.key === 'Enter') {
            tabMatches = []; // Reset tab state
            const raw = hiddenInput.value;
            commitActiveLine(raw);
            hiddenInput.value = '';
            if (raw.trim()) {
                cmdHistory.unshift(raw);
                // Limit history to 50 items
                if (cmdHistory.length > 50) cmdHistory.pop();
                registry.set('cmd.history', cmdHistory);
                histIdx = -1;
                dispatch(raw);
            }
            if (_activeLine === null) createActiveLine(); // might be replaced by app
        } else if (e.key === 'ArrowUp') {
            tabMatches = [];
            e.preventDefault();
            if (histIdx < cmdHistory.length - 1) {
                histIdx++;
                hiddenInput.value = cmdHistory[histIdx];
                setTimeout(() => hiddenInput.setSelectionRange(hiddenInput.value.length, hiddenInput.value.length), 0);
            }
            refreshActiveLine();
        } else if (e.key === 'ArrowDown') {
            tabMatches = [];
            e.preventDefault();
            if (histIdx > 0) { histIdx--; hiddenInput.value = cmdHistory[histIdx]; }
            else { histIdx = -1; hiddenInput.value = ''; }
            setTimeout(() => hiddenInput.setSelectionRange(hiddenInput.value.length, hiddenInput.value.length), 0);
            refreshActiveLine();
        } else {
            // Reset tab state on normal key
            if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
                tabMatches = [];
            }
            requestAnimationFrame(() => refreshActiveLine());
        }
    });

    // Clicking anywhere in the terminal focuses the hidden input
    terminal.addEventListener('click', () => hiddenInput.focus());
    container.addEventListener('click', () => hiddenInput.focus());

    // ── Welcome banner (Windows CMD style) ───────────────────────────────────
    appendLine('glitterOS [Version 4.2.0.6969]');
    appendHTML('(c) glitterOS Corporation. All rights reserved. Type <span style="color:#e8c84a">HELP</span> for help.');
    appendLine('');

    // Create the first active input line
    createActiveLine();

    // ── Launch window ─────────────────────────────────────────────────────────
    const winOptions = {
        icon: 'ri-terminal-box-line',
        width: 600,
        height: 380
    };

    if (isBoot) {
        const margin = 40;
        winOptions.x = window.innerWidth - winOptions.width - margin;
        winOptions.y = 60;
    }

    const winObj = wm.createWindow('Command Prompt', container, winOptions);

    // Handle autoRun
    if (autoRun) {
        hiddenInput.value = autoRun;
        refreshActiveLine();
        // Simulate Enter
        setTimeout(() => {
            const raw = hiddenInput.value;
            commitActiveLine(raw);
            hiddenInput.value = '';
            dispatch(raw);
            if (_activeLine === null) createActiveLine();
        }, 100);
    }

    setTimeout(() => hiddenInput.focus(), 100);
}

AppRegistry.register({
    id: 'cmd',
    name: 'Command Prompt',
    exe: 'cmd.exe',
    icon: 'ri-terminal-box-line',
    launch: (autoRun) => launchCommandPrompt(autoRun),
    desktopShortcut: true
});
