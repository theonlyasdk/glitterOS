// ── glitterOS Notepad ────────────────────────────────────────────────────────

function launchNotepad(filePath = null) {
    const container = document.createElement('div');
    container.className = 'gos-notepad';

    let _currentPath = filePath;
    let _isDirty = false;

    // ── Content area ──────────────────────────────────────────────────────────
    const editor = document.createElement('div');
    editor.className = 'gos-notepad-editor';

    const gutter = document.createElement('div');
    gutter.className = 'gos-notepad-gutter';
    gutter.textContent = '1';

    const textarea = document.createElement('textarea');
    textarea.className = 'gos-notepad-content';
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
    const menubar = buildAppMenuBar();

    // ── Actions ───────────────────────────────────────────────────────────────
    function saveFile(callback) {
        if (!_currentPath) {
            filedialog.showSave({
                parentTitle: 'Notepad',
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

    menubar.createMenu('File', [
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
                        parentTitle: 'Notepad',
                        onConfirm: (path) => {
                            const res = fs.cat(path);
                            if (!res.error) {
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
                    parentTitle: 'Notepad',
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

    menubar.createMenu('Edit', [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
        { type: 'sep' },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => { textarea.focus(); document.execCommand('cut'); } },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => { textarea.focus(); document.execCommand('copy'); } },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => { textarea.focus(); document.execCommand('paste'); } },
        { type: 'sep' },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => { textarea.focus(); textarea.select(); } }
    ]);

    menubar.createMenu('Help', [
        { label: 'About Notepad', action: () => aboutGlitterOS('Notepad') }
    ]);

    container.addEventListener('keydown', (e) => {
        if (menubar.handleKey(e)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    container.append(menubar, editor);

    // ── Window Creation ───────────────────────────────────────────────────────
    const winTitle = _currentPath ? _currentPath.split('\\').pop() : 'Untitled';
    const winObj = wm.createWindow(`${winTitle} - Notepad`, container, {
        icon: 'ri-file-text-line',
        width: 600,
        height: 400,
        onClose: () => {
            menubar._cleanup();
        }
    });

    // Override the close button behavior to check for save
    const closeBtn = winObj.element.querySelector('.gos-win-btn-close');
    const oldClose = closeBtn.onclick;
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        checkSave(() => wm.closeWindow(winObj.id));
    };

    function updateTitle() {
        const name = _currentPath ? _currentPath.split('\\').pop() : 'Untitled';
        const prefix = _isDirty ? '*' : '';
        winObj.element.querySelector('.gos-win-title').textContent = `${prefix}${name} - Notepad`;
    }

    updateTitle();

    // Auto-focus textarea
    setTimeout(() => textarea.focus(), 100);
}

AppRegistry.register({
    id: 'notepad',
    name: 'Notepad',
    exe: 'notepad.exe',
    icon: 'ri-file-text-line',
    launch: (path) => launchNotepad(path),
    desktopShortcut: true,
    acceptsFiles: true,
    supportedExtensions: ['txt', 'md', 'json', 'csv', 'log', 'ini']
});
