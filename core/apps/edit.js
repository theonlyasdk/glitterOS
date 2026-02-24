/**
 * MS-DOS Style Editor (EDIT.COM clone) for glitterOS
 */

function launchEdit(filePath = null, parentContainer = null, onExit = null) {
    const container = document.createElement('div');
    container.className = 'gos-edit';

    let _currentPath = filePath;
    let _isDirty = false;
    let _oldContent = null;
    let _targetWin = null;

    // ── Components ──────────────────────────────────────────────────────────
    const menubar = document.createElement('div');
    menubar.className = 'gos-edit-menubar';

    const editorArea = document.createElement('div');
    editorArea.className = 'gos-edit-editor';

    // Gutter for line numbers
    const gutter = document.createElement('div');
    gutter.className = 'gos-edit-gutter';

    // Wrapper for textarea and highlight
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'gos-edit-content-wrapper';

    const highlight = document.createElement('div');
    highlight.className = 'gos-edit-line-highlight';

    const textarea = document.createElement('textarea');
    textarea.className = 'gos-edit-content';
    textarea.spellcheck = false;
    textarea.wrap = 'off'; // Typical for console editors

    contentWrapper.append(highlight, textarea);
    editorArea.append(gutter, contentWrapper);

    const statusbar = document.createElement('div');
    statusbar.className = 'gos-edit-statusbar';

    const statusMsg = document.createElement('div');
    statusMsg.className = 'gos-edit-status-msg';
    statusMsg.textContent = 'F1=Help  Enter=Execute  Esc=Cancel  Tab=Next Field';

    const cursorPos = document.createElement('div');
    cursorPos.className = 'gos-edit-cursor-pos';
    cursorPos.innerHTML = 'Line:1  Col:1';

    statusbar.append(statusMsg, cursorPos);

    // ── Menu Bar Setup ──────────────────────────────────────────────────────
    const menuElements = [];
    const menuItemsData = [];
    let _activeMenuIdx = -1;
    let _activeItemIdx = -1;

    function closeAllMenus() {
        container.querySelectorAll('.gos-edit-menu-item').forEach(m => {
            m.classList.remove('active');
            m.classList.remove('kb-focus');
        });
        container.querySelectorAll('.gos-edit-dropdown-item').forEach(m => m.classList.remove('kb-focus'));
        _activeMenuIdx = -1;
        _activeItemIdx = -1;
    }

    function highlightMenu() {
        menuElements.forEach((m, i) => {
            m.classList.toggle('kb-focus', i === _activeMenuIdx);
            const isOpen = m.classList.contains('active');
            if (i === _activeMenuIdx && !isOpen && _activeItemIdx !== -1) {
                m.classList.add('active');
            }
            if (i !== _activeMenuIdx) {
                m.classList.remove('active');
            }
        });

        if (_activeMenuIdx !== -1) {
            const items = menuItemsData[_activeMenuIdx];
            items.forEach((item, i) => {
                if (item.el) item.el.classList.toggle('kb-focus', i === _activeItemIdx);
            });
        }
    }

    function createMenu(label, items) {
        const menu = document.createElement('div');
        menu.className = 'gos-edit-menu-item';
        menu.innerHTML = `<span>${label[0]}</span>${label.slice(1)}`;

        const dropdown = document.createElement('div');
        dropdown.className = 'gos-edit-dropdown';

        const myItems = [];
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'gos-edit-dropdown-item';
            el.innerHTML = `<span>${item.label}</span>`;

            const action = () => {
                closeAllMenus();
                item.action();
            };

            el.onclick = (e) => {
                e.stopPropagation();
                action();
            };
            dropdown.appendChild(el);
            myItems.push({ label: item.label, action: action, el: el });
        });

        menu.appendChild(dropdown);
        menu.onclick = (e) => {
            e.stopPropagation();
            const wasActive = menu.classList.contains('active');
            const idx = menuElements.indexOf(menu);
            closeAllMenus();
            if (!wasActive) {
                menu.classList.add('active');
                _activeMenuIdx = idx;
            }
        };

        menuElements.push(menu);
        menuItemsData.push(myItems);
        return menu;
    }

    function exitEditor() {
        if (_isDirty && !confirm('File not saved. Exit anyway?')) {
            return;
        }

        if (parentContainer) {
            // Restore CMD
            parentContainer.innerHTML = '';
            _oldContent.forEach(node => parentContainer.appendChild(node));
            if (_targetWin) {
                _targetWin.element.querySelector('.gos-win-title').textContent = _targetWin.title;
            }
            if (onExit) onExit();
        } else {
            wm.closeWindow(winObj.id);
        }
    }

    const fileMenu = createMenu('File', [
        { label: 'New', action: () => { textarea.value = ''; _currentPath = null; _isDirty = false; updateTitle(); updateLineNumbers(); } },
        {
            label: 'Open...', action: () => {
                filedialog.showOpen({
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
            }
        },
        { label: 'Save', action: () => saveFile() },
        {
            label: 'Save As...', action: () => {
                filedialog.showSave({
                    defaultName: _currentPath ? _currentPath.split('\\').pop() : 'UNTITLED.TXT',
                    onConfirm: (path) => {
                        _currentPath = path;
                        performSave();
                    }
                });
            }
        },
        { label: 'Exit', action: exitEditor }
    ]);

    menubar.append(fileMenu);

    // ── Logic ───────────────────────────────────────────────────────────────
    function saveFile() {
        if (!_currentPath) {
            filedialog.showSave({
                defaultName: 'UNTITLED.TXT',
                onConfirm: (path) => {
                    _currentPath = path;
                    performSave();
                }
            });
        } else {
            performSave();
        }
    }

    function performSave() {
        fs.write(_currentPath, textarea.value);
        _isDirty = false;
        updateTitle();
    }

    function updateTitle() {
        const name = _currentPath ? _currentPath.split('\\').pop().toUpperCase() : 'UNTITLED.TXT';
        const titleText = `${name} - edit.exe`;
        if (_targetWin) {
            _targetWin.element.querySelector('.gos-win-title').textContent = titleText;
        } else if (typeof winObj !== 'undefined') {
            winObj.element.querySelector('.gos-win-title').textContent = titleText;
        }
    }

    function updateLineNumbers() {
        const lines = textarea.value.split('\n').length;
        let nums = '';
        for (let i = 1; i <= lines; i++) nums += i + '\n';
        gutter.innerText = nums;
    }

    function updateCursorInfo() {
        const pos = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, pos);
        const lines = textBefore.split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        cursorPos.innerHTML = `Line:${line}  Col:${col}`;

        // Update highlight
        const style = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(style.lineHeight) || 19.2;
        const paddingTop = parseFloat(style.paddingTop) || 5;

        highlight.style.top = (paddingTop + (line - 1) * lineHeight - textarea.scrollTop) + 'px';
        highlight.style.display = 'block';
    }

    textarea.addEventListener('input', () => {
        _isDirty = true;
        updateCursorInfo();
        updateLineNumbers();
    });
    textarea.addEventListener('click', updateCursorInfo);
    textarea.addEventListener('keyup', updateCursorInfo);
    textarea.addEventListener('scroll', () => {
        gutter.scrollTop = textarea.scrollTop;
        updateCursorInfo();
    });

    container.addEventListener('keydown', (e) => {
        if (e.key === 'Alt') {
            e.preventDefault();
            if (_activeMenuIdx === -1) {
                _activeMenuIdx = 0;
                highlightMenu();
            } else {
                closeAllMenus();
            }
            return;
        }

        if (_activeMenuIdx !== -1) {
            e.preventDefault();
            e.stopPropagation();

            if (e.key === 'Escape') {
                closeAllMenus();
            } else if (e.key === 'ArrowRight') {
                _activeMenuIdx = (_activeMenuIdx + 1) % menuElements.length;
                _activeItemIdx = -1;
                highlightMenu();
            } else if (e.key === 'ArrowLeft') {
                _activeMenuIdx = (_activeMenuIdx - 1 + menuElements.length) % menuElements.length;
                _activeItemIdx = -1;
                highlightMenu();
            } else if (e.key === 'ArrowDown') {
                const items = menuItemsData[_activeMenuIdx];
                _activeItemIdx = (_activeItemIdx + 1) % items.length;
                highlightMenu();
            } else if (e.key === 'ArrowUp') {
                const items = menuItemsData[_activeMenuIdx];
                _activeItemIdx = (_activeItemIdx - 1 + items.length) % items.length;
                highlightMenu();
            } else if (e.key === 'Enter') {
                const items = menuItemsData[_activeMenuIdx];
                if (_activeItemIdx !== -1) {
                    items[_activeItemIdx].action();
                } else {
                    _activeItemIdx = 0;
                    highlightMenu();
                }
            }
        }
    }, true);

    if (_currentPath) {
        const res = fs.cat(_currentPath);
        if (!res.error) textarea.value = res.content;
    }

    container.append(menubar, editorArea, statusbar);

    // ── Interaction/Display ──────────────────────────────────────────────────
    let winObj;

    if (parentContainer) {
        // Find existing window if parent is part of one
        const winElem = parentContainer.closest('.gos-window');
        if (winElem) {
            _targetWin = wm.windows.find(w => w.element === winElem);
        }
        _oldContent = Array.from(parentContainer.childNodes);
        parentContainer.innerHTML = '';
        parentContainer.appendChild(container);
        updateTitle();
        updateLineNumbers();
        setTimeout(() => textarea.focus(), 100);
    } else {
        winObj = wm.createWindow('Editor', container, {
            width: 640,
            height: 400,
            icon: 'bi-pencil-square',
            noResize: false
        });
        updateTitle();
        updateLineNumbers();
        setTimeout(() => textarea.focus(), 100);
    }

    // Handle global click to close menus
    const onMouseDown = (e) => {
        if (!menubar.contains(e.target)) {
            closeAllMenus();
        }
    };
    window.addEventListener('mousedown', onMouseDown);

    if (winObj) {
        winObj.onClose = () => {
            if (_isDirty && !confirm('File not saved. Exit anyway?')) {
                return false; // Prevent closing
            }
            window.removeEventListener('mousedown', onMouseDown);
            return true; // Allow closing
        };
    } else if (_targetWin) {
        // If inline, we need to clean up when the parent window closes
        const originalOnClose = _targetWin.onClose;
        _targetWin.onClose = () => {
            if (_isDirty && !confirm('File not saved. Exit anyway?')) {
                return false; // Prevent closing
            }
            window.removeEventListener('mousedown', onMouseDown);
            if (originalOnClose) return originalOnClose();
            return true;
        };
    }

    return winObj;
}

AppRegistry.register({
    id: 'edit',
    name: 'Editor',
    exe: 'edit.exe',
    icon: 'bi-pencil-square',
    launch: (path) => launchEdit(path),
    desktopShortcut: false
});
