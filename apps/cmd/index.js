// ── glitterOS Command Prompt — Windows CMD style ──────────────────────────────

function launchCommandPrompt(autoRun = null, isBoot = false) {
    // Container
    const container = document.createElement('div');
    container.className = 'gos-cmd';

    // Hidden real input that captures keystrokes
    const hiddenInput = document.createElement('input');
    hiddenInput.className = 'gos-cmd-hidden-input';
    hiddenInput.type = 'text';
    hiddenInput.autocomplete = 'off';
    hiddenInput.spellcheck = false;
    container.appendChild(hiddenInput);

    // The single scrollable terminal surface (output + inline input all here)
    const terminal = document.createElement('div');
    terminal.className = 'gos-cmd-terminal';
    terminal.tabIndex = 0; // make focusable
    container.appendChild(terminal);

    // ── State ─────────────────────────────────────────────────────────────────
    const cmdHistory = registry.get('Software.GlitterOS.Cmd.History', []);
    let histIdx = -1;
    let _activeLine = null; // the live editable prompt line at the bottom
    const cwdRegistryKey = 'Software.GlitterOS.Cmd.CurrentDirectory';

    function persistCwd() {
        registry.set(cwdRegistryKey, fs.pwd());
    }

    // Restore last CMD working directory when possible
    const savedCwd = registry.get(cwdRegistryKey, null);
    if (savedCwd && fs.exists(savedCwd)) {
        fs.cd(savedCwd);
    } else {
        persistCwd();
    }

    // ── Path helpers ──────────────────────────────────────────────────────────
    function getPrompt() {
        return fs.pwd() + '> ';
    }

    // ── Output helpers ────────────────────────────────────────────────────────
    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const CMD_SYNTAX_KEYWORDS = new Set([
        'if', 'then', 'else', 'end', 'proc', 'do',
        'echo', 'type', 'cd', 'dir', 'md', 'mkdir', 'del', 'rm', 'rd', 'rmdir',
        'ren', 'copy', 'edit', 'runsmc', 'notify', 'ver', 'help', 'cls', 'exit',
        'history', 'pwd', 'ls', 'cat', 'cp', 'mv', 'clear'
    ]);
    const CMD_SYNTAX_OPERATORS = ['==', '!=', '||', '&&', '|', '>'];

    function highlightCmdText(raw, markCommandValidity = true, validationLine = null) {
        const line = String(raw || '');
        let out = '';
        let i = 0;
        const lineForValidation = validationLine == null ? line : String(validationLine);
        const validCommand = markCommandValidity ? validateSingle(lineForValidation) : false;
        let cmdStart = -1;
        let cmdEnd = -1;
        if (markCommandValidity) {
            let inQuotes = false;
            let quoteChar = '';
            for (let k = 0; k < line.length; k++) {
                const ch = line[k];
                if (cmdStart === -1 && /\s/.test(ch)) continue;
                if (cmdStart === -1) cmdStart = k;
                if ((ch === '"' || ch === "'") && (k === 0 || line[k - 1] !== '\\')) {
                    if (!inQuotes) {
                        inQuotes = true;
                        quoteChar = ch;
                    } else if (quoteChar === ch) {
                        inQuotes = false;
                    }
                }
                if (!inQuotes && /\s/.test(ch)) {
                    cmdEnd = k;
                    break;
                }
            }
            if (cmdStart !== -1 && cmdEnd === -1) cmdEnd = line.length;
        }
        const cmdClass = validCommand ? 'gos-cmd-syn-cmd-valid' : 'gos-cmd-syn-cmd-invalid';
        const wrapChunk = (text, baseClass, start, end) => {
            if (!text) return '';
            if (markCommandValidity && cmdStart !== -1 && start >= cmdStart && end <= cmdEnd) {
                return `<span class="${cmdClass}">${escHtml(text)}</span>`;
            }
            if (baseClass) return `<span class="${baseClass}">${escHtml(text)}</span>`;
            return escHtml(text);
        };

        while (i < line.length) {
            const ch = line[i];

            if (ch === '"' || ch === "'") {
                const quote = ch;
                let j = i + 1;
                while (j < line.length) {
                    if (line[j] === '\\') { j += 2; continue; }
                    if (line[j] === quote) { j++; break; }
                    j++;
                }
                out += wrapChunk(line.slice(i, j), 'gos-cmd-syn-str', i, j);
                i = j;
                continue;
            }

            const op = CMD_SYNTAX_OPERATORS.find(o => line.startsWith(o, i));
            if (op) {
                out += wrapChunk(op, 'gos-cmd-syn-op', i, i + op.length);
                i += op.length;
                continue;
            }

            if (/[0-9]/.test(ch)) {
                let j = i + 1;
                while (j < line.length && /[0-9.]/.test(line[j])) j++;
                out += wrapChunk(line.slice(i, j), 'gos-cmd-syn-num', i, j);
                i = j;
                continue;
            }

            if (/[A-Za-z_]/.test(ch)) {
                let j = i + 1;
                while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
                const word = line.slice(i, j);
                const low = word.toLowerCase();
                if (CMD_SYNTAX_KEYWORDS.has(low)) {
                    out += wrapChunk(word, 'gos-cmd-syn-kw', i, j);
                } else {
                    out += wrapChunk(word, '', i, j);
                }
                i = j;
                continue;
            }

            out += wrapChunk(ch, '', i, i + 1);
            i++;
        }

        return out;
    }

    function appendLine(text, cls = '') {
        if (_execContext && _execContext.capture) {
            _execContext.lines.push(String(text));
            return;
        }
        // Inject before the active input line
        const div = document.createElement('div');
        div.className = 'gos-cmd-line' + (cls ? ' ' + cls : '');
        div.textContent = text;
        if (_activeLine) terminal.insertBefore(div, _activeLine);
        else terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function appendHTML(html, cls = '') {
        if (_execContext && _execContext.capture) {
            const probe = document.createElement('div');
            probe.innerHTML = html;
            _execContext.lines.push(probe.textContent || probe.innerText || '');
            return;
        }
        const div = document.createElement('div');
        div.className = 'gos-cmd-line' + (cls ? ' ' + cls : '');
        div.innerHTML = html;
        if (_activeLine) terminal.insertBefore(div, _activeLine);
        else terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function normalizeLineEnding(s) {
        return String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    let _execContext = null;

    function appendCmdError(problem, fix) {
        appendLine(`Error: ${problem}`, 'gos-cmd-err');
        appendLine(`How to fix: ${fix}`, 'gos-cmd-err');
    }

    function getStdinText() {
        if (!_execContext || typeof _execContext.stdin !== 'string') return '';
        return _execContext.stdin;
    }

    function isQuotedText(raw) {
        if (!raw) return false;
        const t = raw.trim();
        if (t.length < 2) return false;
        const q = t[0];
        if (q !== '"' && q !== "'") return false;
        return t[t.length - 1] === q;
    }

    // ── Active inline prompt line ─────────────────────────────────────────────
    function createActiveLine() {
        _activeLine = document.createElement('div');
        _activeLine.className = 'gos-cmd-line gos-cmd-active-line';
        terminal.appendChild(_activeLine);
        refreshActiveLine();
    }

    function refreshActiveLine() {
        if (!_activeLine) return;
        const val = hiddenInput.value;
        const cur = hiddenInput.selectionStart ?? val.length;
        // Split around cursor for blinking block render
        const before = highlightCmdText(val.slice(0, cur), true, val);
        const after = highlightCmdText(val.slice(cur + 1), true, val);
        const curChar = escHtml(val[cur] || ' ');
        _activeLine.innerHTML =
            `<span class="gos-cmd-prompt">${escHtml(getPrompt())}</span>` +
            `<span class="gos-cmd-typed gos-cmd-syn">${before}</span>` +
            `<span class="gos-cmd-cursor">${curChar}</span>` +
            `<span class="gos-cmd-typed gos-cmd-syn">${after}</span>`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    function commitActiveLine(rawCmd) {
        // Turn active line into a static "echo" line, then make new active line
        if (_activeLine) {
            _activeLine.innerHTML =
                `<span class="gos-cmd-prompt">${escHtml(getPrompt())}</span>` +
                `<span class="gos-cmd-typed gos-cmd-syn">${highlightCmdText(rawCmd, true)}</span>`;
            _activeLine.classList.remove('gos-cmd-active-line');
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
                '<span style="color:#e8c84a">DEL / RM</span>  Deletes one or more files.<br>' +
                '<span style="color:#e8c84a">RD / RMDIR</span> Removes a directory.<br>' +
                '<span style="color:#e8c84a">REN</span>       Renames a file.<br>' +
                '<span style="color:#e8c84a">COPY</span>      Copies one file to another location.<br>' +
                '<span style="color:#e8c84a">EDIT</span>      Starts the glitterOS Editor.<br>' +
                '<span style="color:#e8c84a">RUNSMC</span>    Executes a .smc script file.<br>' +
                '<span style="color:#e8c84a">NOTIFY</span>    Sends a test notification to Action Centre.<br>' +
                '<span style="color:#e8c84a">VER</span>       Displays the Windows version.<br>' +
                '<span style="color:#e8c84a">EXIT</span>      Quits the CMD program.'
            );
            appendLine('');
            appendLine('Unix-like aliases: PWD, LS, CAT, CLEAR, CP, MV.');
        },
        cls() {
            // Remove all lines except the active one
            Array.from(terminal.children).forEach(c => {
                if (c !== _activeLine) c.remove();
            });
        },
        ver() {
            appendLine('glitterOS [Version 4.2.0.6969]');
            appendHTML('(c) theonlyasdk 2026. All rights reserved. Type <span style="color:#e8c84a">HELP</span> for help.');
            appendLine('glitterOS Command Prompt v1.0');
        },
        notify(args, ctx = {}) {
            if (typeof NotificationService === 'undefined') {
                appendCmdError(
                    'NotificationService is not available.',
                    'Open Task Manager and restart NotificationService, then try NOTIFY again.'
                );
                return;
            }
            const rawInput = (ctx.rawArgText || '').trim();
            if (!rawInput || !isQuotedText(rawInput)) {
                appendCmdError('NOTIFY requires a quoted message string.', 'Use: NOTIFY "Title|Message"');
                return;
            }
            const raw = rawInput.slice(1, -1).trim();
            let title = 'Dummy Notification';
            let message = 'This is a test notification from CMD.';
            if (raw) {
                const parts = raw.split('|');
                if (parts[0] && parts[0].trim()) title = parts[0].trim();
                if (parts[1] && parts[1].trim()) message = parts[1].trim();
            }

            const res = NotificationService.notify({
                title,
                message,
                actions: []
            });

            if (res.error) {
                appendCmdError(`Failed to send notification: ${res.error}`, 'Ensure NotificationService is enabled and retry.');
            } else {
                appendLine('Notification sent.');
            }
        },
        cd(args) {
            if (!args[0] || args[0] === '/d') {
                appendLine(fs.pwd());
                return;
            }
            const target = args[args[0] === '/d' ? 1 : 0] || '~';
            const res = fs.cd(target);
            if (res.error) appendCmdError('The system cannot find the path specified.', 'Use DIR to check valid folders, then run CD <path>.');
            else persistCwd();
        },
        pwd() {
            CMDS.cd([]);
        },
        dir(args) {
            const path = args[0] ? args[0] : '.';
            const res = fs.ls(path);
            if (res.error) { appendCmdError('File or directory not found.', 'Run DIR on the current folder or provide an existing path.'); return; }
            const winPath = path === '.' ? fs.pwd() : path;
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            appendLine(` Directory of ${winPath}\n`);
            if (res.entries.length === 0) {
                appendLine(' No items in this directory');
            } else {
                let dirs = 0, files = 0, totalBytes = 0;
                res.entries.forEach(e => {
                    const tag = e.type === 'dir' ? '<DIR>' : '';
                    const sizeStr = e.type === 'dir' ? '' : e.size.toLocaleString();
                    const tagPad = escHtml(tag.padEnd(5));
                    const sizePad = escHtml(sizeStr.padStart(10));
                    const col = e.type === 'dir' ? '#7ec8ff' : '#cccccc';

                    // Non-breaking spaces help maintain column alignment in the HTML output
                    const formattedLine = `${escHtml(dateStr)}  ${escHtml(timeStr)}  <span style="color:${col}">${tagPad.replace(/ /g, '&nbsp;')}</span> ${sizePad.replace(/ /g, '&nbsp;')} ${escHtml(e.name)}`;
                    appendHTML(formattedLine);
                    if (e.type === 'dir') {
                        dirs++;
                    } else {
                        files++;
                        totalBytes += (e.size || 0);
                    }
                });
                appendLine(`\n       ${files} File(s) ${totalBytes.toLocaleString().padStart(14)} bytes\n       ${dirs} Dir(s)`);
            }
        },
        type(args) {
            if (!args[0]) {
                const stdin = getStdinText();
                if (!stdin) { appendCmdError('TYPE requires a file path or piped input.', 'Use TYPE <file> or pipe text into TYPE.'); return; }
                normalizeLineEnding(stdin).split('\n').forEach(l => appendLine(l));
                return;
            }
            const res = fs.cat(args[0]);
            if (res.error) { appendCmdError('The system cannot find the file specified.', 'Check the file name/path and run TYPE <file>.'); return; }
            res.content.split('\n').forEach(l => appendLine(l));
        },
        echo(args, ctx = {}) {
            const rawInput = (ctx.rawArgText || '').trim();
            if (!rawInput && args.length === 0) {
                const stdin = getStdinText();
                appendLine(stdin);
                return;
            }
            if (!isQuotedText(rawInput)) {
                appendCmdError('ECHO requires a quoted string.', 'Use: ECHO "your text here"');
                return;
            }
            appendLine(rawInput.slice(1, -1));
        },
        md(args) {
            if (!args[0]) {
                if (getStdinText()) {
                    appendCmdError('MKDIR cannot use piped text as a directory name.', 'Provide a folder path explicitly: MKDIR <folder>.');
                } else {
                    appendCmdError('MKDIR requires a directory name.', 'Use MKDIR <folder>.');
                }
                return;
            }
            const res = fs.mkdir(args[0]);
            if (res.error) appendCmdError('A subdirectory or file already exists.', 'Choose a different name or remove the existing item first.');
        },
        mkdir(args) { CMDS.md(args); },
        ls(args) { CMDS.dir(args); },
        del(args) {
            if (!args[0]) { appendCmdError('DEL requires a file path.', 'Use DEL <file>.'); return; }
            const res = fs.rm(args[0]);
            if (res.error) appendCmdError('Could not find ' + args[0], 'Check the file path with DIR, then run DEL again.');
        },
        rm(args) { CMDS.del(args); },
        rd(args) {
            if (!args[0]) { appendCmdError('RMDIR requires a directory path.', 'Use RMDIR <folder>.'); return; }
            const res = fs.rmdir(args[0]);
            if (res.error) appendCmdError(
                res.error.includes('empty') ? 'The directory is not empty.' : 'The system cannot find the path specified.',
                res.error.includes('empty') ? 'Delete files inside first, then run RMDIR again.' : 'Check the directory path with DIR and retry.'
            );
        },
        rmdir(args) { CMDS.rd(args); },
        ren(args) {
            if (args.length < 2) { appendCmdError('REN requires source and destination names.', 'Use REN <oldname> <newname>.'); return; }
            const catRes = fs.cat(args[0]);
            if (catRes.error) { appendCmdError('The system cannot find the file specified.', 'Check the source file path and retry REN.'); return; }
            fs.write(args[1], catRes.content);
            fs.rm(args[0]);
        },
        mv(args) { CMDS.ren(args); },
        copy(args) {
            if (args.length < 2) { appendCmdError('COPY requires source and destination paths.', 'Use COPY <source> <destination>.'); return; }
            const catRes = fs.cat(args[0]);
            if (catRes.error) { appendCmdError('The system cannot find the file specified.', 'Check the source file path and retry COPY.'); return; }
            fs.write(args[1], catRes.content);
            appendLine('        1 file(s) copied.');
        },
        cp(args) { CMDS.copy(args); },
        cat(args) { CMDS.type(args); },
        edit(args) {
            launchEdit(args[0], container, () => {
                setTimeout(() => hiddenInput.focus(), 50);
                refreshActiveLine();
            });
        },
        runsmc(args) {
            const p = args[0];
            if (!p) {
                appendCmdError('RUNSMC requires a script path.', 'Usage: RUNSMC <script.smc>');
                return { ok: false };
            }
            const res = fs.cat(p);
            if (res.error) {
                appendCmdError('The system cannot find the file specified.', 'Check the script path and extension, then run RUNSMC <script.smc>.');
                return { ok: false };
            }
            return executeScriptContent(res.content);
        },
        exit() {
            const winObj = wm.windows.find(w => w.element === container.closest('.gos-window'));
            if (winObj) wm.closeWindow(winObj.id);
        },
        history(args) {
            if (args[0] === 'clear') {
                cmdHistory.length = 0;
                registry.set('Software.GlitterOS.Cmd.History', []);
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
        },
        clear(args) {
            CMDS.cls(args);
        }
    };

    function tokenize(line) {
        const tokens = [];
        let current = "";
        let inQuotes = false;
        let quoteChar = "";

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
                if (inQuotes && char === quoteChar) {
                    inQuotes = false;
                } else if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                } else {
                    current += char;
                }
            } else if (char === ' ' && !inQuotes) {
                if (current) {
                    tokens.push(current);
                    current = "";
                }
            } else {
                current += char;
            }
        }
        if (current) tokens.push(current);
        return tokens;
    }

    function splitByOperator(line, op) {
        const parts = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if ((ch === '"' || ch === "'") && (i === 0 || line[i - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = ch;
                } else if (quoteChar === ch) {
                    inQuotes = false;
                }
                current += ch;
                continue;
            }
            if (!inQuotes && line.slice(i, i + op.length) === op) {
                parts.push(current.trim());
                current = '';
                i += op.length - 1;
                continue;
            }
            current += ch;
        }
        if (current.trim()) parts.push(current.trim());
        return parts;
    }

    function parseRedirection(line) {
        let inQuotes = false;
        let quoteChar = '';
        let redirIdx = -1;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if ((ch === '"' || ch === "'") && (i === 0 || line[i - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = ch;
                } else if (quoteChar === ch) {
                    inQuotes = false;
                }
                continue;
            }
            if (!inQuotes && ch === '>') {
                if (redirIdx !== -1) return { error: 'Only one output redirection is supported.' };
                redirIdx = i;
            }
        }
        if (redirIdx === -1) return { command: line.trim(), outputPath: null };
        const command = line.slice(0, redirIdx).trim();
        const outputPath = line.slice(redirIdx + 1).trim();
        if (!command || !outputPath) return { error: 'The syntax of the command is incorrect.' };
        return { command, outputPath };
    }

    function splitTopLevelPipes(line) {
        const parts = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if ((ch === '"' || ch === "'") && (i === 0 || line[i - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = ch;
                } else if (quoteChar === ch) {
                    inQuotes = false;
                }
                current += ch;
                continue;
            }
            if (!inQuotes && ch === '|') {
                if (line[i + 1] === '|') {
                    current += '||';
                    i++;
                    continue;
                }
                parts.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }
        parts.push(current.trim());
        return parts;
    }

    function findTopLevelKeyword(line, keyword) {
        let inQuotes = false;
        let quoteChar = '';
        const lower = line.toLowerCase();
        for (let i = 0; i <= line.length - keyword.length; i++) {
            const ch = line[i];
            if ((ch === '"' || ch === "'") && (i === 0 || line[i - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = ch;
                } else if (quoteChar === ch) {
                    inQuotes = false;
                }
            }
            if (inQuotes) continue;
            if (lower.slice(i, i + keyword.length) === keyword) {
                const prev = i === 0 ? ' ' : line[i - 1];
                const next = i + keyword.length >= line.length ? ' ' : line[i + keyword.length];
                const boundaryPrev = /\s/.test(prev);
                const boundaryNext = /\s/.test(next);
                if (boundaryPrev && boundaryNext) return i;
            }
        }
        return -1;
    }

    function executeSingle(raw) {
        const line = raw.trim();
        if (!line) return { ok: true };

        const tokens = tokenize(line);
        if (tokens.length === 0) return { ok: true };
        const cmd = tokens[0].toLowerCase();
        const args = tokens.slice(1);

        if (tokens[0].toLowerCase().endsWith('.smc') && tokens.length === 1) {
            if (!fs.exists(tokens[0])) {
                appendCmdError('The system cannot find the file specified.', 'Make sure the .smc file exists in the current directory or provide its full path.');
                return { ok: false };
            }
            const smcRes = fs.cat(tokens[0]);
            if (smcRes.error) {
                appendCmdError('The system cannot find the file specified.', 'Verify read access and script path, then retry.');
                return { ok: false };
            }
            return executeScriptContent(smcRes.content);
        }

        if (CMDS[cmd]) {
            const rawArgText = line.slice(tokens[0].length).trim();
            const result = CMDS[cmd](args, { rawArgText, line, cmd });
            if (result && typeof result.ok === 'boolean') return result;
            return { ok: true };
        }

        const possiblePaths = [
            line,
            line + '.exe',
            'C:\\glitterOS\\System\\' + line,
            'C:\\glitterOS\\System\\' + line + '.exe'
        ];

        for (const p of possiblePaths) {
            if (fs.exists(p)) {
                const res = SystemExec.run(p);
                if (res.ok) return { ok: true };
                if (res.error === 'App not installed') return { ok: false };
            }
        }

        appendCmdError(
            `'${cmd}' is not recognized as an internal or external command.`,
            'Run HELP to list commands, or check the executable/script name and path.'
        );
        return { ok: false };
    }

    function validateSingle(raw) {
        const line = raw.trim();
        if (!line) return true;
        const tokens = tokenize(line);
        if (!tokens.length) return true;
        const cmd = tokens[0].toLowerCase();
        if (CMDS[cmd]) return true;

        if (tokens[0].toLowerCase().endsWith('.smc')) return tokens.length === 1 && fs.exists(tokens[0]);

        const candidates = [
            line,
            line + '.exe',
            'C:\\glitterOS\\System\\' + line,
            'C:\\glitterOS\\System\\' + line + '.exe'
        ];
        return candidates.some(p => fs.exists(p));
    }

    function validateFlowSyntax(raw) {
        const line = raw.trim();
        if (!line) return true;

        const ifPos = findTopLevelKeyword(line, 'if');
        if (ifPos === 0) {
            const thenPos = findTopLevelKeyword(line, 'then');
            if (thenPos <= 0) return false;
            const elsePos = findTopLevelKeyword(line, 'else');
            const condExpr = line.slice(2, thenPos).trim();
            const thenExpr = elsePos > thenPos
                ? line.slice(thenPos + 4, elsePos).trim()
                : line.slice(thenPos + 4).trim();
            const elseExpr = elsePos > thenPos ? line.slice(elsePos + 4).trim() : '';
            if (!condExpr || !thenExpr) return false;
            if (!validateFlowSyntax(thenExpr)) return false;
            if (elseExpr && !validateFlowSyntax(elseExpr)) return false;
            return true;
        }

        const andParts = splitByOperator(line, '&&');
        if (andParts.length > 1) return andParts.every(p => validateFlowSyntax(p));
        const orParts = splitByOperator(line, '||');
        if (orParts.length > 1) return orParts.every(p => validateFlowSyntax(p));

        const redir = parseRedirection(line);
        if (redir.error) return false;
        const pipeParts = splitTopLevelPipes(redir.command);
        if (!pipeParts.length || pipeParts.some(p => !p)) return false;
        return pipeParts.every(p => validateSingle(p));
    }

    function executeCondition(expr) {
        const cond = expr.trim();
        if (!cond) return false;
        const match = cond.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
        if (!match) return executeSingle(cond).ok;
        const left = match[1].trim().replace(/^["']|["']$/g, '');
        const op = match[2];
        const right = match[3].trim().replace(/^["']|["']$/g, '');
        return op === '==' ? left === right : left !== right;
    }

    function executeLineWithFlow(raw) {
        const line = raw.trim();
        if (!line) return { ok: true };

        const ifPos = findTopLevelKeyword(line, 'if');
        if (ifPos === 0) {
            const thenPos = findTopLevelKeyword(line, 'then');
            if (thenPos > 0) {
                const elsePos = findTopLevelKeyword(line, 'else');
                const condExpr = line.slice(2, thenPos).trim();
                const thenExpr = elsePos > thenPos
                    ? line.slice(thenPos + 4, elsePos).trim()
                    : line.slice(thenPos + 4).trim();
                const elseExpr = elsePos > thenPos ? line.slice(elsePos + 4).trim() : '';
                if (!validateFlowSyntax(thenExpr) || (elseExpr && !validateFlowSyntax(elseExpr))) {
                    appendCmdError('Invalid THEN/ELSE command expression.', 'Use: IF <condition> THEN <command> ELSE <command>.');
                    return { ok: false };
                }
                const condOk = executeCondition(condExpr);
                if (condOk) return executeLineWithFlow(thenExpr);
                if (elseExpr) return executeLineWithFlow(elseExpr);
                return { ok: true };
            } else {
                appendCmdError('IF statement requires THEN.', 'Use: IF <condition> THEN <command> [ELSE <command>].');
                return { ok: false };
            }
        }

        const andParts = splitByOperator(line, '&&');
        if (andParts.length > 1) {
            let last = { ok: true };
            for (const p of andParts) {
                last = executeLineWithFlow(p);
                if (!last.ok) break;
            }
            return last;
        }

        const orParts = splitByOperator(line, '||');
        if (orParts.length > 1) {
            let last = { ok: false };
            for (const p of orParts) {
                last = executeLineWithFlow(p);
                if (last.ok) break;
            }
            return last;
        }

        const redir = parseRedirection(line);
        if (redir.error) {
            appendCmdError(redir.error, 'Use one redirection target: <command> > <file>.');
            return { ok: false };
        }

        const stages = splitTopLevelPipes(redir.command);
        if (!stages.length || stages.some(s => !s)) {
            appendCmdError('Invalid pipe syntax.', 'Use: <command1> | <command2> with a command on both sides of "|".');
            return { ok: false };
        }

        // Keep normal rendering behavior (HTML/colors/etc.) for non-piped, non-redirected commands.
        if (stages.length === 1 && !redir.outputPath) {
            return executeSingle(stages[0]);
        }

        let stdin = '';
        let last = { ok: true };
        for (const stage of stages) {
            const prevContext = _execContext;
            _execContext = { capture: true, lines: [], stdin };
            try {
                last = executeSingle(stage);
            } finally {
                stdin = _execContext.lines.join('\n');
                _execContext = prevContext;
            }
            if (!last.ok) return last;
        }

        if (redir.outputPath) {
            fs.write(redir.outputPath, stdin);
            return last;
        }

        normalizeLineEnding(stdin).split('\n').forEach(l => appendLine(l));
        return last;
    }

    function executeScriptContent(content) {
        if (typeof SmcInterpreter === 'undefined' || !SmcInterpreter.runScript) {
            appendCmdError('SMC interpreter service is unavailable.', 'Ensure core/services/smcInterpreter.js is loaded before CMD.');
            return { ok: false };
        }
        return SmcInterpreter.runScript(content, {
            tokenize,
            evaluateCondition: executeCondition,
            executeCommand: (line) => executeLineWithFlow(line),
            onCommand: (line) => {
                commitActiveLine(line);
                if (_activeLine === null) createActiveLine();
            },
            onError: (problem) => {
                if (problem === 'Procedure recursion limit exceeded.') {
                    appendCmdError(problem, 'Reduce recursive calls or add termination conditions.');
                } else {
                    appendCmdError(problem, 'Ensure each IF/PROC block is closed with END.');
                }
            },
            recursionLimit: 32
        });
    }

    // ── Input dispatch ────────────────────────────────────────────────────────
    function dispatch(raw) {
        executeLineWithFlow(raw);
    }

    // ── Keyboard handler ──────────────────────────────────────────────────────
    hiddenInput.addEventListener('input', () => refreshActiveLine());

    let tabMatches = [];
    let tabIndex = -1;
    let tabBase = '';

    function parseCompletionInput(input) {
        let inQuotes = false;
        let quoteChar = '';
        let tokenStart = input.length;
        for (let i = input.length - 1; i >= 0; i--) {
            const ch = input[i];
            if ((ch === '"' || ch === "'") && (i === 0 || input[i - 1] !== '\\')) {
                if (inQuotes && quoteChar === ch) {
                    inQuotes = false;
                } else if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = ch;
                }
            }
            if (!inQuotes && /\s/.test(ch)) {
                tokenStart = i + 1;
                break;
            }
            tokenStart = i;
        }
        const base = input.slice(0, tokenStart);
        let token = input.slice(tokenStart);
        const quote = token.startsWith('"') || token.startsWith("'") ? token[0] : '';
        if (quote) token = token.slice(1);
        return { base, token, quote };
    }

    function buildCompletions(input) {
        const parsed = parseCompletionInput(input);
        const normalized = parsed.token.replace(/\//g, '\\');
        const slashIdx = normalized.lastIndexOf('\\');
        let dirPart = '';
        let prefix = normalized;

        if (slashIdx >= 0) {
            dirPart = normalized.slice(0, slashIdx + 1);
            prefix = normalized.slice(slashIdx + 1);
        }

        const searchPath = dirPart ? dirPart : '.';
        const res = fs.ls(searchPath);
        if (res.error || !res.entries) return null;

        const matches = res.entries
            .filter(e => e.name.toLowerCase().startsWith(prefix.toLowerCase()))
            .map(e => {
                const suffix = e.type === 'dir' ? '\\' : '';
                return dirPart + e.name + suffix;
            });

        if (!matches.length) return null;
        return {
            base: parsed.base + (parsed.quote || ''),
            matches
        };
    }

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

            const completion = buildCompletions(val);
            if (completion) {
                tabMatches = completion.matches;
                tabIndex = 0;
                tabBase = completion.base;
                hiddenInput.value = tabBase + tabMatches[0];
                refreshActiveLine();
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
                registry.set('Software.GlitterOS.Cmd.History', cmdHistory);
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

    const focusIfNoSelection = () => {
        if (!window.getSelection().toString()) hiddenInput.focus();
    };
    terminal.addEventListener('click', focusIfNoSelection);
    container.addEventListener('click', (e) => {
        if (e.target === container) focusIfNoSelection();
    });

    let isBlockSelecting = false;
    let blockStart = null;
    let blockRect = null;
    let onBlockMove = null;
    let onBlockUp = null;

    function getCmdGridMetrics() {
        const cs = getComputedStyle(terminal);
        const lineHeight = parseFloat(cs.lineHeight) || 18;
        const probe = document.createElement('span');
        probe.style.font = cs.font;
        probe.style.visibility = 'hidden';
        probe.style.position = 'absolute';
        probe.style.whiteSpace = 'pre';
        probe.textContent = 'M';
        document.body.appendChild(probe);
        const charWidth = probe.getBoundingClientRect().width || 8;
        probe.remove();
        return { charWidth, lineHeight };
    }

    function snapToGrid(val, step) {
        return Math.round(val / step) * step;
    }

    terminal.addEventListener('mousedown', (e) => {
        if (e.ctrlKey && e.button === 0) {
            e.preventDefault();
            window.getSelection().removeAllRanges();
            isBlockSelecting = true;
            terminal.style.position = 'relative';
            const rect = terminal.getBoundingClientRect();
            const grid = getCmdGridMetrics();
            blockStart = {
                x: snapToGrid(e.clientX - rect.left + terminal.scrollLeft, grid.charWidth),
                y: snapToGrid(e.clientY - rect.top + terminal.scrollTop, grid.lineHeight)
            };
            if (blockRect) blockRect.remove();
            blockRect = document.createElement('div');
            blockRect.style.position = 'absolute';
            blockRect.style.backgroundColor = '#ccc';
            blockRect.style.mixBlendMode = 'difference';
            blockRect.style.pointerEvents = 'none';
            blockRect.style.zIndex = '9999';
            terminal.appendChild(blockRect);

            onBlockMove = (me) => {
                if (!isBlockSelecting) return;
                if (!me.ctrlKey) {
                    onBlockUp();
                    return;
                }
                const r = terminal.getBoundingClientRect();
                const curX = snapToGrid(me.clientX - r.left + terminal.scrollLeft, grid.charWidth);
                const curY = snapToGrid(me.clientY - r.top + terminal.scrollTop, grid.lineHeight);
                const left = Math.min(blockStart.x, curX);
                const top = Math.min(blockStart.y, curY);
                const width = Math.abs(curX - blockStart.x);
                const height = Math.abs(curY - blockStart.y);
                blockRect.style.left = left + 'px';
                blockRect.style.top = top + 'px';
                blockRect.style.width = width + 'px';
                blockRect.style.height = height + 'px';
            };

            onBlockUp = () => {
                isBlockSelecting = false;
                window.removeEventListener('mousemove', onBlockMove);
                window.removeEventListener('mouseup', onBlockUp);
                window.removeEventListener('keyup', onCtrlKeyUp);
            };

            const onCtrlKeyUp = (ke) => {
                if (ke.key === 'Control') onBlockUp();
            };

            window.addEventListener('mousemove', onBlockMove);
            window.addEventListener('mouseup', onBlockUp);
            window.addEventListener('keyup', onCtrlKeyUp);
        } else {
            if (blockRect) {
                blockRect.remove();
                blockRect = null;
            }
        }
    });

    // ── Drag & Drop ───────────────────────────────────────────────────────────
    terminal.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        terminal.classList.add('gos-cmd-dragover');
    });

    terminal.addEventListener('dragleave', () => {
        terminal.classList.remove('gos-cmd-dragover');
    });

    terminal.addEventListener('drop', (e) => {
        e.preventDefault();
        terminal.classList.remove('gos-cmd-dragover');
        const data = e.dataTransfer.getData('text/plain');
        if (data) {
            try {
                const paths = JSON.parse(data);
                if (Array.isArray(paths)) {
                    const quotedPaths = paths.map(p => `"${p}"`).join(' ');
                    const currentVal = hiddenInput.value;
                    if (currentVal && !currentVal.endsWith(' ')) {
                        hiddenInput.value += ' ' + quotedPaths;
                    } else {
                        hiddenInput.value += quotedPaths;
                    }
                    hiddenInput.focus();
                    refreshActiveLine();
                }
            } catch (err) {
                // If not JSON, just append raw text
                hiddenInput.value += data;
                hiddenInput.focus();
                refreshActiveLine();
            }
        }
    });

    hiddenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const selTxt = window.getSelection().toString();
            if (selTxt || blockRect) {
                e.preventDefault();
                if (selTxt) {
                    navigator.clipboard.writeText(selTxt).catch(() => { });
                    window.getSelection().removeAllRanges();
                } else if (blockRect) {
                    blockRect.remove();
                    blockRect = null;
                }
                return;
            }
        }
    }, { capture: true });

    // ── Welcome banner (Windows CMD style) ───────────────────────────────────
    appendLine('glitterOS [Version 4.2.0.6969]');
    appendHTML('(c) theonlyasdk 2026. All rights reserved. Type <span style="color:#e8c84a">HELP</span> for help.');
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

    const winObj = wm.createWindow('    Command Prompt', container, winOptions);

    // Watch for window focus/blur via MutationObserver on the window element
    const focusObserver = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.attributeName === 'class') {
                const isActive = winObj.element.classList.contains('active');
                if (!isActive) {
                    hiddenInput.blur();
                    refreshActiveLine();
                }
            }
        });
    });
    focusObserver.observe(winObj.element, { attributes: true });

    // Cleanup observer on window close
    const originalOnClose = winObj.onClose;
    winObj.onClose = () => {
        focusObserver.disconnect();
        if (originalOnClose) originalOnClose();
    };

    // Handle autoRun
    if (autoRun) {
        setTimeout(() => {
            const scriptRun = typeof autoRun === 'object' && autoRun && autoRun.scriptPath;
            if (scriptRun) {
                const p = autoRun.scriptPath;
                const res = fs.cat(p);
                commitActiveLine(`runsmc "${p}"`);
                if (res.error) {
                    appendCmdError('The system cannot find the file specified.', 'Check the autorun script path and try again.');
                } else {
                    executeScriptContent(res.content);
                }
            } else {
                hiddenInput.value = String(autoRun);
                refreshActiveLine();
                const raw = hiddenInput.value;
                commitActiveLine(raw);
                hiddenInput.value = '';
                dispatch(raw);
            }
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
    acceptsFiles: true,
    supportedExtensions: ['smc'],
    desktopShortcut: true
});
