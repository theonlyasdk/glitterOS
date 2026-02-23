// ── glitterOS Notepad ────────────────────────────────────────────────────────

function launchNotepad(filePath = null) {
    const container = document.createElement('div');
    container.className = 'lde-notepad';

    let _currentPath = filePath;
    let _isDirty = false;

    // ── Content area ──────────────────────────────────────────────────────────
    const editor = document.createElement('div');
    editor.className = 'lde-notepad-editor';

    const gutter = document.createElement('div');
    gutter.className = 'lde-notepad-gutter';
    gutter.textContent = '1';

    const textarea = document.createElement('textarea');
    textarea.className = 'lde-notepad-content';
    textarea.spellcheck = false;

    editor.append(gutter, textarea);

    if (_currentPath) {
        const res = fs.cat(_currentPath);
        if (!res.error) {
            textarea.value = res.content;
        }
    }

    function updateLineNumbers() {
        const lines = textarea.value.split('\n').length;
        let lineNumbers = '';
        for (let i = 1; i <= lines; i++) {
            lineNumbers += i + '\n';
        }
        gutter.textContent = lineNumbers;
    }

    textarea.addEventListener('input', () => {
        _isDirty = true;
        updateTitle();
        updateLineNumbers();
    });

    textarea.addEventListener('scroll', () => {
        gutter.scrollTop = textarea.scrollTop;
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 1;
            updateLineNumbers();
        }
    });

    // Initial line numbers
    updateLineNumbers();

    // ── Menu Bar Logic ────────────────────────────────────────────────────────
    const menubar = document.createElement('div');
    menubar.className = 'lde-notepad-menubar';

    function createMenu(label, items) {
        const menu = document.createElement('div');
        menu.className = 'lde-notepad-menu-item';
        menu.textContent = label;

        const dropdown = document.createElement('div');
        dropdown.className = 'lde-notepad-dropdown';

        items.forEach(item => {
            if (item.type === 'sep') {
                const sep = document.createElement('div');
                sep.className = 'lde-notepad-dropdown-sep';
                dropdown.appendChild(sep);
            } else {
                const el = document.createElement('div');
                el.className = 'lde-notepad-dropdown-item';
                el.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
                el.onclick = (e) => {
                    e.stopPropagation();
                    menu.classList.remove('active');
                    item.action();
                };
                dropdown.appendChild(el);
            }
        });

        menu.appendChild(dropdown);

        // Click to toggle
        menu.onclick = (e) => {
            e.stopPropagation();
            const wasActive = menu.classList.contains('active');
            container.querySelectorAll('.lde-notepad-menu-item').forEach(m => m.classList.remove('active'));
            if (!wasActive) menu.classList.add('active');
        };

        // Hover to switch if one is already open
        menu.onmouseenter = () => {
            const anyActive = container.querySelector('.lde-notepad-menu-item.active');
            if (anyActive && anyActive !== menu) {
                anyActive.classList.remove('active');
                menu.classList.add('active');
            }
        };

        return menu;
    }

    // ── Actions ───────────────────────────────────────────────────────────────
    function saveFile(callback) {
        if (!_currentPath) {
            filedialog.showSave({
                defaultName: 'Untitled.txt',
                onConfirm: (path) => {
                    _currentPath = path;
                    performSave(callback);
                }
            });
        } else {
            performSave(callback);
        }
    }

    function performSave(callback) {
        fs.write(_currentPath, textarea.value);
        _isDirty = false;
        updateTitle();
        if (callback) callback();
    }

    function checkSave(onSafe) {
        if (_isDirty) {
            const fileName = _currentPath ? _currentPath.split('\\').pop() : 'Untitled';
            wm.messageBox('Notepad', `Do you want to save changes to ${fileName}?`, {
                buttons: 'yesnocancel',
                icon: 'bi-exclamation-triangle-fill',
                onYes: () => saveFile(onSafe),
                onNo: onSafe
            });
        } else {
            onSafe();
        }
    }

    const fileMenu = createMenu('File', [
        {
            label: 'New', shortcut: 'Ctrl+N', action: () => {
                checkSave(() => {
                    textarea.value = ''; _currentPath = null; _isDirty = false; updateTitle();
                });
            }
        },
        {
            label: 'Open...', shortcut: 'Ctrl+O', action: () => {
                checkSave(() => {
                    filedialog.showOpen({
                        onConfirm: (path) => {
                            const res = fs.cat(path);
                            if (res.error) {
                                wm.messageBox('Notepad', res.error, { icon: 'bi-x-circle-fill' });
                            } else {
                                textarea.value = res.content;
                                _currentPath = path;
                                _isDirty = false;
                                updateTitle();
                                updateLineNumbers();
                            }
                        }
                    });
                });
            }
        },
        {
            label: 'Save As...', action: () => {
                filedialog.showSave({
                    defaultName: _currentPath ? _currentPath.split('\\').pop() : 'Untitled.txt',
                    onConfirm: (path) => {
                        _currentPath = path;
                        performSave();
                    }
                });
            }
        },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => saveFile() },
        { type: 'sep' },
        {
            label: 'Exit', action: () => {
                checkSave(() => wm.closeWindow(winObj.id));
            }
        }
    ]);

    const editMenu = createMenu('Edit', [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
        { type: 'sep' },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => { textarea.focus(); document.execCommand('cut'); } },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => { textarea.focus(); document.execCommand('copy'); } },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => { textarea.focus(); document.execCommand('paste'); } },
        { type: 'sep' },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => { textarea.focus(); textarea.select(); } }
    ]);

    const helpMenu = createMenu('Help', [
        { label: 'About Notepad', action: () => aboutGlitterOS('Notepad') }
    ]);

    menubar.append(fileMenu, editMenu, helpMenu);

    const onMouseDown = (e) => {
        if (!menubar.contains(e.target)) {
            container.querySelectorAll('.lde-notepad-menu-item').forEach(m => m.classList.remove('active'));
        }
    };
    window.addEventListener('mousedown', onMouseDown);

    container.append(menubar, editor);

    // ── Window Creation ───────────────────────────────────────────────────────
    const winTitle = _currentPath ? _currentPath.split('\\').pop() : 'Untitled';
    const winObj = wm.createWindow(`${winTitle} - Notepad`, container, {
        icon: 'bi-file-earmark-text',
        width: 600,
        height: 400,
        onClose: () => {
            window.removeEventListener('mousedown', onMouseDown);
        }
    });

    // Override the close button behavior to check for save
    const closeBtn = winObj.element.querySelector('.lde-win-btn-close');
    const oldClose = closeBtn.onclick;
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        checkSave(() => wm.closeWindow(winObj.id));
    };

    function updateTitle() {
        const name = _currentPath ? _currentPath.split('\\').pop() : 'Untitled';
        const prefix = _isDirty ? '*' : '';
        winObj.element.querySelector('.lde-win-title').textContent = `${prefix}${name} - Notepad`;
    }

    updateTitle();

    // Auto-focus textarea
    setTimeout(() => textarea.focus(), 100);
}
