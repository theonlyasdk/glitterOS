// ── glitterOS Notepad ────────────────────────────────────────────────────────

function launchNotepad(filePath = null) {
    const container = document.createElement('div');
    container.className = 'gos-notepad';

    let _currentPath = filePath;
    let _isDirty = false;
    let _syntaxMode = 'auto'; // auto | plain | smc | html

    // ── Content area ──────────────────────────────────────────────────────────
    const editor = document.createElement('div');
    editor.className = 'gos-notepad-editor';

    const gutter = document.createElement('div');
    gutter.className = 'gos-notepad-gutter';
    gutter.textContent = '1';

    const contentWrap = document.createElement('div');
    contentWrap.className = 'gos-notepad-content-wrap';

    const lineHighlight = document.createElement('div');
    lineHighlight.className = 'gos-notepad-line-highlight';

    const syntaxLayer = document.createElement('pre');
    syntaxLayer.className = 'gos-notepad-syntax-layer';
    syntaxLayer.setAttribute('aria-hidden', 'true');

    const textarea = document.createElement('textarea');
    textarea.className = 'gos-notepad-content';
    textarea.spellcheck = false;
    textarea.wrap = 'off';

    contentWrap.append(lineHighlight, syntaxLayer, textarea);
    editor.append(gutter, contentWrap);

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

    function updateCursorLineHighlight() {
        const pos = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, pos);
        const line = textBefore.split('\n').length;
        const lineHeight = 20;
        const paddingTop = 0;
        lineHighlight.style.top = (paddingTop + (line - 1) * lineHeight - textarea.scrollTop) + 'px';
        lineHighlight.style.display = 'block';
    }

    let _cursorFrame = null;
    function scheduleCursorLineHighlight() {
        if (_cursorFrame !== null) return;
        _cursorFrame = requestAnimationFrame(() => {
            _cursorFrame = null;
            updateCursorLineHighlight();
        });
    }

    function resolveLanguage() {
        if (_syntaxMode === 'plain') return null;
        if (_syntaxMode === 'smc' || _syntaxMode === 'html') return _syntaxMode;
        if (typeof SyntaxHighlighter === 'undefined' || !SyntaxHighlighter.detectLanguage) return null;
        return SyntaxHighlighter.detectLanguage(_currentPath);
    }

    function renderSyntax() {
        const lang = resolveLanguage();
        if (!lang || typeof SyntaxHighlighter === 'undefined' || !SyntaxHighlighter.highlight) {
            syntaxLayer.classList.remove('active');
            textarea.classList.remove('syntax-active');
            syntaxLayer.innerHTML = '';
            return;
        }
        syntaxLayer.classList.add('active');
        textarea.classList.add('syntax-active');
        syntaxLayer.innerHTML = SyntaxHighlighter.highlight(lang, textarea.value);
        if (!syntaxLayer.innerHTML) syntaxLayer.innerHTML = '\n';
        syntaxLayer.scrollTop = textarea.scrollTop;
        syntaxLayer.scrollLeft = textarea.scrollLeft;
    }

    function updateSelectionOverlayState() {
        const hasRange = (textarea.selectionEnd - textarea.selectionStart) > 0;
        syntaxLayer.style.visibility = hasRange ? 'hidden' : 'visible';
        if (hasRange) {
            textarea.classList.add('has-selection');
        } else {
            textarea.classList.remove('has-selection');
        }
    }

    function syntaxLabel(mode, title) {
        return title;
    }

    function syntaxIcon(mode) {
        return _syntaxMode === mode ? 'bi-check-square' : 'bi-square';
    }

    function buildSyntaxMenuItems() {
        return [
            { label: syntaxLabel('auto', 'Auto (Filename)'), icon: syntaxIcon('auto'), action: () => { _syntaxMode = 'auto'; renderSyntax(); } },
            { label: syntaxLabel('plain', 'Plain Text'), icon: syntaxIcon('plain'), action: () => { _syntaxMode = 'plain'; renderSyntax(); } },
            { label: syntaxLabel('smc', 'SMC Script'), icon: syntaxIcon('smc'), action: () => { _syntaxMode = 'smc'; renderSyntax(); } },
            { label: syntaxLabel('html', 'HTML/XML'), icon: syntaxIcon('html'), action: () => { _syntaxMode = 'html'; renderSyntax(); } }
        ];
    }

    function closeMenuBarMenus() {
        menubar.querySelectorAll('.gos-app-menu-item.active').forEach(el => el.classList.remove('active'));
    }

    textarea.addEventListener('input', () => {
        _isDirty = true;
        updateTitle();
        updateLineNumbers();
        renderSyntax();
        scheduleCursorLineHighlight();
    });

    textarea.addEventListener('scroll', () => {
        gutter.scrollTop = textarea.scrollTop;
        syntaxLayer.scrollTop = textarea.scrollTop;
        syntaxLayer.scrollLeft = textarea.scrollLeft;
        scheduleCursorLineHighlight();
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 1;
            _isDirty = true;
            updateTitle();
            updateLineNumbers();
            renderSyntax();
            scheduleCursorLineHighlight();
        }
    });
    textarea.addEventListener('click', scheduleCursorLineHighlight);
    textarea.addEventListener('keyup', () => {
        scheduleCursorLineHighlight();
        updateSelectionOverlayState();
    });
    textarea.addEventListener('keydown', scheduleCursorLineHighlight);
    textarea.addEventListener('mouseup', () => {
        scheduleCursorLineHighlight();
        updateSelectionOverlayState();
    });
    document.addEventListener('selectionchange', () => {
        if (document.activeElement === textarea) {
            scheduleCursorLineHighlight();
            updateSelectionOverlayState();
        }
    });

    // Initial line numbers
    updateLineNumbers();
    renderSyntax();
    scheduleCursorLineHighlight();
    updateSelectionOverlayState();

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
        renderSyntax();
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
                    updateLineNumbers();
                    renderSyntax();
                    scheduleCursorLineHighlight();
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
                                renderSyntax();
                                scheduleCursorLineHighlight();
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

    menubar.createMenu('View', [
        {
            label: 'Syntax',
            hasSubmenu: true,
            onMouseEnter: (e, el) => {
                const rect = el.getBoundingClientRect();
                gosShowContextMenu(rect.right, rect.top, buildSyntaxMenuItems(), true);
            },
            action: () => {}
        }
    ]);

    menubar.createMenu('Help', [
        { label: 'About Notepad', action: () => aboutGlitterOS('Notepad') }
    ]);

    container.addEventListener('keydown', (e) => {
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveFile();
            return;
        }
        if (e.target === textarea && e.key === 'Tab') {
            return;
        }
        if (menubar.handleKey(e)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    const onOutsideMenuClickCapture = (e) => {
        if (!menubar.contains(e.target)) closeMenuBarMenus();
    };
    document.addEventListener('mousedown', onOutsideMenuClickCapture, true);

    container.append(menubar, editor);

    // ── Window Creation ───────────────────────────────────────────────────────
    const winTitle = _currentPath ? _currentPath.split('\\').pop() : 'Untitled';
    const winObj = wm.createWindow(`${winTitle} - Notepad`, container, {
        icon: 'ri-file-text-line',
        width: 600,
        height: 400,
        appId: 'notepad',
        args: filePath,
        onClose: () => {
            menubar._cleanup();
            document.removeEventListener('mousedown', onOutsideMenuClickCapture, true);
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
    supportedExtensions: ['txt', 'md', 'json', 'csv', 'log', 'ini', 'smc', 'html', 'htm', 'xml', 'xhtml', 'svg']
});
