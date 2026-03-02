/**
 * MS-DOS Style Editor (EDIT.COM clone) for glitterOS
 */

function launchEdit(filePath = null, parentContainer = null, onExit = null) {
    const container = document.createElement('div');
    container.className = 'gos-edit';
    container.tabIndex = 0;

    function normalizePathArg(pathArg) {
        if (!pathArg) return null;
        if (typeof pathArg === 'string') return pathArg;
        if (typeof pathArg === 'object') {
            if (typeof pathArg.path === 'string') return pathArg.path;
            if (typeof pathArg.scriptPath === 'string') return pathArg.scriptPath;
        }
        return null;
    }

    let _currentPath = normalizePathArg(filePath);
    let _cwd = _currentPath ? _currentPath.substring(0, _currentPath.lastIndexOf('\\')) : 'C:\\Users\\User\\Documents';
    if (!_cwd) _cwd = 'C:\\';
    let _isDirty = false;
    let _oldContent = null;
    let _targetWin = null;
    let _activeHighlighter = null;

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

    const syntaxLayer = document.createElement('pre');
    syntaxLayer.className = 'gos-edit-syntax-layer';
    syntaxLayer.setAttribute('aria-hidden', 'true');

    const textarea = document.createElement('textarea');
    textarea.className = 'gos-edit-content';
    textarea.spellcheck = false;
    textarea.wrap = 'off'; // Typical for console editors

    contentWrapper.append(highlight, syntaxLayer, textarea);
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

    function resolveHighlighter() {
        if (typeof SyntaxHighlighter === 'undefined' || !SyntaxHighlighter.detectLanguage) return null;
        return SyntaxHighlighter.detectLanguage(_currentPath);
    }

    function renderSyntaxLayer() {
        _activeHighlighter = resolveHighlighter();
        if (!_activeHighlighter || typeof SyntaxHighlighter === 'undefined' || !SyntaxHighlighter.highlight) {
            syntaxLayer.classList.remove('active');
            textarea.classList.remove('syntax-active');
            syntaxLayer.innerHTML = '';
            return;
        }
        syntaxLayer.classList.add('active');
        textarea.classList.add('syntax-active');
        syntaxLayer.innerHTML = SyntaxHighlighter.highlight(_activeHighlighter, textarea.value);
        if (!syntaxLayer.innerHTML) syntaxLayer.innerHTML = '\n';
        syntaxLayer.scrollTop = textarea.scrollTop;
        syntaxLayer.scrollLeft = textarea.scrollLeft;
    }

    function showAboutDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'gos-edit-ncurses-overlay';
        overlay.tabIndex = 0;

        const dialog = document.createElement('div');
        dialog.className = 'gos-edit-ncurses-dialog';
        dialog.style.width = '380px';
        dialog.innerHTML = `
            <div class="gos-edit-ncurses-title">About</div>
            <div class="gos-edit-ncurses-body">
                <div style="text-align:center; margin-bottom:15px; font-size: inherit;">
                    glitterOS Editor (edit.exe)<br>
                    Version 1.0.64 (Alpha)<br><br>
                    (C) 2026 glitterOS Project<br>
                    Classic DOS Interface Emulation
                </div>
                <div class="gos-edit-ncurses-buttons">
                    <div class="gos-edit-ncurses-btn active">OK</div>
                </div>
            </div>
        `;

        const okBtn = dialog.querySelector('.gos-edit-ncurses-btn');
        const commit = () => {
            overlay.remove();
            setTimeout(() => textarea.focus(), 10);
        };

        okBtn.onclick = commit;
        overlay.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                e.preventDefault();
                commit();
            }
        };

        overlay.appendChild(dialog);
        container.appendChild(overlay);
        overlay.focus();
    }

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
                _activeItemIdx = 0;
                highlightMenu();
                container.focus({ preventScroll: true });
            }
        };

        menu.onmouseenter = () => {
            const anyActive = menubar.querySelector('.gos-edit-menu-item.active');
            if (anyActive && anyActive !== menu) {
                const idx = menuElements.indexOf(menu);
                closeAllMenus();
                menu.classList.add('active');
                _activeMenuIdx = idx;
                _activeItemIdx = 0;
                highlightMenu();
            }
        };

        menuElements.push(menu);
        menuItemsData.push(myItems);
        return menu;
    }

    function showDOSFileDialog(mode, callback, defaultName = '') {
        closeAllMenus();
        const overlay = document.createElement('div');
        overlay.className = 'gos-edit-ncurses-overlay';
        overlay.tabIndex = 0;

        const dialog = document.createElement('div');
        dialog.className = 'gos-edit-ncurses-dialog file-dialog';
        dialog.innerHTML = `
            <div class="gos-edit-ncurses-title">${mode === 'open' ? 'Open' : 'Save As'}</div>
            <div class="gos-edit-ncurses-body">
                <div class="gos-edit-file-list-label">File Name:</div>
                <input type="text" class="gos-edit-file-input">
                
                <div class="gos-edit-file-dialog-grid">
                    <div class="gos-edit-file-list-wrap">
                        <div class="gos-edit-file-list-label">Files:</div>
                        <div class="gos-edit-file-list files"></div>
                    </div>
                    <div class="gos-edit-file-list-wrap">
                        <div class="gos-edit-file-list-label">Directories:</div>
                        <div class="gos-edit-file-list dirs"></div>
                    </div>
                </div>

                <div class="gos-edit-ncurses-buttons" style="margin-top: 15px;">
                    <div class="gos-edit-ncurses-btn ok">OK</div>
                    <div class="gos-edit-ncurses-btn cancel">Cancel</div>
                </div>
            </div>
        `;

        const input = dialog.querySelector('.gos-edit-file-input');
        const fileList = dialog.querySelector('.files');
        const dirList = dialog.querySelector('.dirs');
        const okBtn = dialog.querySelector('.ok');
        const cancelBtn = dialog.querySelector('.cancel');

        let browsePath = _cwd;
        let selectedFileIdx = -1;
        let selectedDirIdx = -1;
        let currentFiles = [];
        let currentDirs = [];
        let activePanel = 'input'; // 'input', 'files', 'dirs', 'buttons'
        let btnIdx = 0;

        input.value = defaultName;

        function refreshLists() {
            fileList.innerHTML = '';
            dirList.innerHTML = '';
            const res = fs.ls(browsePath);
            if (res.error) return;

            currentFiles = res.entries.filter(e => e.type === 'file').map(e => e.name);
            currentDirs = res.entries.filter(e => e.type === 'dir').map(e => e.name);
            if (browsePath !== 'C:\\') currentDirs.unshift('..');

            currentFiles.forEach((f, i) => {
                const el = document.createElement('div');
                el.className = 'gos-edit-file-item';
                el.textContent = f;
                el.onclick = () => { selectFile(i); };
                fileList.appendChild(el);
            });

            currentDirs.forEach((d, i) => {
                const el = document.createElement('div');
                el.className = 'gos-edit-file-item';
                el.textContent = d === '..' ? ' [-..-]' : ` [${d}]`;
                el.onclick = () => { selectDir(i); };
                dirList.appendChild(el);
            });
        }

        function selectFile(idx) {
            selectedFileIdx = idx;
            selectedDirIdx = -1;
            activePanel = 'files';
            input.value = currentFiles[idx];
            updateSelection();
        }

        function selectDir(idx) {
            selectedDirIdx = idx;
            selectedFileIdx = -1;
            activePanel = 'dirs';
            updateSelection();
        }

        function updateSelection() {
            if (activePanel === 'files' && selectedFileIdx === -1 && currentFiles.length > 0) {
                selectedFileIdx = 0;
                input.value = currentFiles[0];
            }
            if (activePanel === 'dirs' && selectedDirIdx === -1 && currentDirs.length > 0) {
                selectedDirIdx = 0;
            }

            Array.from(fileList.children).forEach((el, i) => {
                const isActive = i === selectedFileIdx && activePanel === 'files';
                el.classList.toggle('active', isActive);
                if (isActive) el.scrollIntoView({ block: 'nearest' });
            });
            Array.from(dirList.children).forEach((el, i) => {
                const isActive = i === selectedDirIdx && activePanel === 'dirs';
                el.classList.toggle('active', isActive);
                if (isActive) el.scrollIntoView({ block: 'nearest' });
            });

            okBtn.classList.toggle('active', activePanel === 'buttons' && btnIdx === 0);
            cancelBtn.classList.toggle('active', activePanel === 'buttons' && btnIdx === 1);

            if (activePanel === 'input') input.focus();
            else overlay.focus();
        }

        function commit() {
            if (activePanel === 'dirs' && selectedDirIdx !== -1) {
                const dir = currentDirs[selectedDirIdx];
                if (dir === '..') {
                    const parts = browsePath.replace('C:\\', '').split('\\').filter(Boolean);
                    parts.pop();
                    browsePath = parts.length === 0 ? 'C:\\' : 'C:\\' + parts.join('\\');
                } else {
                    browsePath = (browsePath.endsWith('\\') ? browsePath : browsePath + '\\') + dir;
                }
                selectedDirIdx = -1;
                refreshLists();
                updateSelection();
                return;
            }

            const name = input.value.trim();
            if (!name) return;
            const fullPath = (browsePath.endsWith('\\') ? browsePath : browsePath + '\\') + name;

            overlay.remove();
            callback(fullPath);
            setTimeout(() => textarea.focus(), 10);
        }

        overlay.onkeydown = (e) => {
            if (activePanel === 'input') return; // let input handle it

            e.preventDefault();
            if (e.key === 'Tab') {
                const panels = ['input', 'files', 'dirs', 'buttons'];
                activePanel = panels[(panels.indexOf(activePanel) + 1) % panels.length];
                updateSelection();
            } else if (e.key === 'ArrowDown') {
                if (activePanel === 'files') {
                    if (selectedFileIdx < currentFiles.length - 1) {
                        selectedFileIdx++;
                        input.value = currentFiles[selectedFileIdx];
                    } else {
                        activePanel = 'buttons';
                        btnIdx = 0;
                    }
                } else if (activePanel === 'dirs') {
                    if (selectedDirIdx < currentDirs.length - 1) {
                        selectedDirIdx++;
                    } else {
                        activePanel = 'buttons';
                        btnIdx = 0;
                    }
                }
                updateSelection();
            } else if (e.key === 'ArrowUp') {
                if (activePanel === 'files') {
                    if (selectedFileIdx > 0) {
                        selectedFileIdx--;
                        input.value = currentFiles[selectedFileIdx];
                    } else {
                        activePanel = 'input';
                        input.focus();
                    }
                } else if (activePanel === 'dirs') {
                    if (selectedDirIdx > 0) {
                        selectedDirIdx--;
                    } else {
                        activePanel = 'input';
                        input.focus();
                    }
                } else if (activePanel === 'buttons') {
                    if (currentFiles.length > 0) {
                        activePanel = 'files';
                        selectedFileIdx = currentFiles.length - 1;
                        input.value = currentFiles[selectedFileIdx];
                    } else if (currentDirs.length > 0) {
                        activePanel = 'dirs';
                        selectedDirIdx = currentDirs.length - 1;
                    } else {
                        activePanel = 'input';
                    }
                }
                updateSelection();
            } else if (e.key === 'ArrowRight') {
                if (activePanel === 'buttons') {
                    btnIdx = (btnIdx + 1) % 2;
                } else if (activePanel === 'files') {
                    if (currentDirs.length > 0) {
                        activePanel = 'dirs';
                        if (selectedDirIdx === -1) selectedDirIdx = 0;
                    }
                }
                updateSelection();
            } else if (e.key === 'ArrowLeft') {
                if (activePanel === 'buttons') {
                    btnIdx = (btnIdx - 1 + 2) % 2;
                } else if (activePanel === 'dirs') {
                    if (currentFiles.length > 0) {
                        activePanel = 'files';
                        if (selectedFileIdx === -1) selectedFileIdx = 0;
                    }
                }
                updateSelection();
            } else if (e.key === 'Enter') {
                if (activePanel === 'buttons' && btnIdx === 1) {
                    overlay.remove();
                    setTimeout(() => textarea.focus(), 10);
                } else {
                    commit();
                }
            } else if (e.key === 'Escape') {
                overlay.remove();
                setTimeout(() => textarea.focus(), 10);
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                activePanel = 'files';
                updateSelection();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentFiles.length > 0) {
                    activePanel = 'files';
                    selectedFileIdx = 0;
                    input.value = currentFiles[0];
                } else if (currentDirs.length > 0) {
                    activePanel = 'dirs';
                    selectedDirIdx = 0;
                } else {
                    activePanel = 'buttons';
                }
                updateSelection();
            } else if (e.key === 'Enter') {
                commit();
            } else if (e.key === 'Escape') {
                overlay.remove();
                setTimeout(() => textarea.focus(), 10);
            }
        };

        okBtn.onclick = commit;
        cancelBtn.onclick = () => { overlay.remove(); setTimeout(() => textarea.focus(), 10); };

        overlay.appendChild(dialog);
        container.appendChild(overlay);
        refreshLists();
        updateSelection();
        input.focus();
    }

    function exitEditor() {
        if (_isDirty) {
            // Display an inline ncurses style dialogue within the editor area itself
            closeAllMenus();

            // Build the overlay wrapper manually to capture all events
            const overlay = document.createElement('div');
            overlay.className = 'gos-edit-ncurses-overlay';

            // Build the retro text UI popup
            const dialog = document.createElement('div');
            dialog.className = 'gos-edit-ncurses-dialog';

            // Replicate classic DOS edit 'File not saved.' style frame
            dialog.innerHTML = `
                <div class="gos-edit-ncurses-title">Warning</div>
                <div class="gos-edit-ncurses-body">
                    <div style="text-align:center; margin-bottom:15px;">
                        File has not been saved.<br>
                        Save now?
                    </div>
                </div>
            `;

            // Button zone
            const btnZone = document.createElement('div');
            btnZone.className = 'gos-edit-ncurses-buttons';

            const btnYes = document.createElement('div');
            btnYes.className = 'gos-edit-ncurses-btn active'; // focus default
            btnYes.textContent = 'Yes';

            const btnNo = document.createElement('div');
            btnNo.className = 'gos-edit-ncurses-btn';
            btnNo.textContent = 'No';

            const btnCancel = document.createElement('div');
            btnCancel.className = 'gos-edit-ncurses-btn';
            btnCancel.textContent = 'Cancel';

            btnZone.append(btnYes, btnNo, btnCancel);
            dialog.querySelector('.gos-edit-ncurses-body').appendChild(btnZone);
            overlay.appendChild(dialog);

            // Selection mechanics logic
            const btns = [btnYes, btnNo, btnCancel];
            let activeIdx = 0;

            function updateBtns() {
                btns.forEach((b, i) => b.classList.toggle('active', i === activeIdx));
            }

            function performAction(index) {
                overlay.remove();
                if (index === 0) {
                    saveFile(() => performExit()); // YES
                } else if (index === 1) {
                    performExit(); // NO
                }
                // CANCEL (index 2) does nothing, just closes dialog
                setTimeout(() => textarea.focus(), 10);
            }

            btns.forEach((btn, i) => {
                btn.onclick = () => performAction(i);
                btn.onmouseenter = () => { activeIdx = i; updateBtns(); };
            });

            overlay.tabIndex = 0; // force focusable
            overlay.onkeydown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === 'ArrowRight' || e.key === 'Tab') {
                    activeIdx = (activeIdx + 1) % btns.length;
                    updateBtns();
                } else if (e.key === 'ArrowLeft') {
                    activeIdx = (activeIdx - 1 + btns.length) % btns.length;
                    updateBtns();
                } else if (e.key === 'Enter') {
                    performAction(activeIdx);
                } else if (e.key === 'Escape') {
                    performAction(2); // Cancel
                }
            };

            container.appendChild(overlay);
            overlay.focus();
            return;
        }

        performExit();
    }

    function performExit() {
        if (parentContainer) {
            // Restore CMD
            parentContainer.innerHTML = '';
            _oldContent.forEach(node => parentContainer.appendChild(node));
            if (_targetWin) {
                const titleText = _targetWin.title;
                _targetWin.element.querySelector('.gos-win-title').textContent = titleText;
            }
            if (onExit) onExit();
        } else {
            // Need a hard force skip past the onClose hook we injected, so unbind it locally first.
            if (winObj) {
                winObj.onClose = null;
                wm.closeWindow(winObj.id);
            }
        }
    }

    const fileMenu = createMenu('File', [
        { label: 'New', action: () => { textarea.value = ''; _currentPath = null; _isDirty = false; updateTitle(); updateLineNumbers(); renderSyntaxLayer(); } },
        {
            label: 'Open...', action: () => {
                showDOSFileDialog('open', (path) => {
                    const res = fs.cat(path);
                    if (!res.error) {
                        textarea.value = res.content;
                        _currentPath = path;
                        _cwd = path.substring(0, path.lastIndexOf('\\')) || 'C:\\';
                        _isDirty = false;
                        updateTitle();
                        updateLineNumbers();
                        renderSyntaxLayer();
                        setTimeout(() => textarea.focus(), 10);
                    } else {
                        if (typeof wm !== 'undefined') wm.messageBox('Error', 'File not found.', { icon: 'bi-x-circle' });
                    }
                });
            }
        },
        { label: 'Save', action: () => saveFile() },
        {
            label: 'Save As...', action: () => {
                showDOSFileDialog('save', (path) => {
                    _currentPath = path;
                    performSave();
                    setTimeout(() => textarea.focus(), 10);
                }, _currentPath ? _currentPath.split('\\').pop() : 'UNTITLED.TXT');
            }
        },
        { label: 'Exit', action: exitEditor }
    ]);

    const editMenu = createMenu('Edit', [
        { label: 'Cut', action: () => document.execCommand('cut') },
        { label: 'Copy', action: () => document.execCommand('copy') },
        {
            label: 'Paste', action: () => {
                navigator.clipboard.readText().then(text => {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + text.length;
                    _isDirty = true; updateTitle();
                    updateLineNumbers();
                    updateCursorInfo();
                    renderSyntaxLayer();
                }).catch(err => {
                    console.error('Failed to read clipboard contents: ', err);
                });
            }
        },
        {
            label: 'Select All', action: () => {
                textarea.select();
            }
        }
    ]);
    const viewMenu = createMenu('View', [
        {
            label: 'Toggle Status Bar', action: () => {
                statusbar.style.display = statusbar.style.display === 'none' ? 'flex' : 'none';
            }
        }
    ]);
    const helpMenu = createMenu('Help', [
        {
            label: 'About', action: () => {
                showAboutDialog();
            }
        }
    ]);

    menubar.append(fileMenu, editMenu, viewMenu, helpMenu);

    // ── Logic ───────────────────────────────────────────────────────────────
    function saveFile(callback) {
        if (!_currentPath) {
            showDOSFileDialog('save', (path) => {
                _currentPath = path;
                _cwd = path.substring(0, path.lastIndexOf('\\')) || 'C:\\';
                performSave();
                if (callback) callback();
                setTimeout(() => textarea.focus(), 10);
            }, 'UNTITLED.TXT');
        } else {
            performSave();
            if (callback) callback();
        }
    }

    function performSave() {
        fs.write(_currentPath, textarea.value);
        _isDirty = false;
        updateTitle();
        renderSyntaxLayer();
    }

    function updateTitle() {
        const name = _currentPath ? _currentPath.split('\\').pop().toUpperCase() : 'UNTITLED.TXT';
        const prefix = _isDirty ? '*' : '';
        const titleText = `${prefix}${name} - edit.exe`;
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
        const lineHeight = 26;
        const paddingTop = 0;

        highlight.style.top = (paddingTop + (line - 1) * lineHeight - textarea.scrollTop) + 'px';
        highlight.style.display = 'block';
    }

    let _cursorFrame = null;
    function scheduleCursorRefresh() {
        if (_cursorFrame !== null) return;
        _cursorFrame = requestAnimationFrame(() => {
            _cursorFrame = null;
            updateCursorInfo();
        });
    }

    textarea.addEventListener('input', () => {
        _isDirty = true; updateTitle();
        scheduleCursorRefresh();
        updateLineNumbers();
        renderSyntaxLayer();
    });
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + '\t' + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 1;
            _isDirty = true; updateTitle();
            updateLineNumbers();
            scheduleCursorRefresh();
            renderSyntaxLayer();
        }
    });
    textarea.addEventListener('click', scheduleCursorRefresh);
    textarea.addEventListener('keyup', scheduleCursorRefresh);
    textarea.addEventListener('keydown', scheduleCursorRefresh);
    textarea.addEventListener('mouseup', scheduleCursorRefresh);
    textarea.addEventListener('scroll', () => {
        gutter.scrollTop = textarea.scrollTop;
        syntaxLayer.scrollTop = textarea.scrollTop;
        syntaxLayer.scrollLeft = textarea.scrollLeft;
        scheduleCursorRefresh();
    });
    document.addEventListener('selectionchange', () => {
        if (document.activeElement === textarea) scheduleCursorRefresh();
    });

    // Disable smooth scrolling and force TTY-style line step scrolling
    textarea.addEventListener('wheel', (e) => {
        e.preventDefault();
        const direction = Math.sign(e.deltaY);
        // Assuming line-height is 20px based on our CSS variables
        const lineHeight = 26;
        const lineCount = 3; // jump 3 lines per standard wheel tick like many terminal emulators
        textarea.scrollTop += direction * (lineHeight * lineCount);
    }, { passive: false });

    container.addEventListener('keydown', (e) => {
        // If an overlay dialogue is visible, ignore generic container hotkeys
        if (container.querySelector('.gos-edit-ncurses-overlay')) return;
        
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveFile();
            return;
        }

        if (e.target === textarea && e.key === 'Tab') return;

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
                const wasOpen = menuElements[_activeMenuIdx].classList.contains('active');
                _activeMenuIdx = (_activeMenuIdx + 1) % menuElements.length;
                _activeItemIdx = wasOpen ? 0 : -1;
                highlightMenu();
            } else if (e.key === 'ArrowLeft') {
                const wasOpen = menuElements[_activeMenuIdx].classList.contains('active');
                _activeMenuIdx = (_activeMenuIdx - 1 + menuElements.length) % menuElements.length;
                _activeItemIdx = wasOpen ? 0 : -1;
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
        renderSyntaxLayer();
        scheduleCursorRefresh();
        setTimeout(() => textarea.focus(), 100);
    } else {
        winObj = wm.createWindow('Editor', container, {
            width: 640,
            height: 400,
            icon: 'bi-pencil-square',
            noResize: false,
            appId: 'editor',
            args: filePath
        });
        updateTitle();
        updateLineNumbers();
        renderSyntaxLayer();
        scheduleCursorRefresh();
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
            if (_isDirty) {
                exitEditor(); // launches the interactive box instead!
                return false; // Prevent immediate UI closing
            }
            window.removeEventListener('mousedown', onMouseDown);
            return true; // Allow closing
        };
    } else if (_targetWin) {
        // If inline, we need to clean up when the parent window closes
        const originalOnClose = _targetWin.onClose;
        _targetWin.onClose = () => {
            if (_isDirty) {
                exitEditor();
                return false; // Prevent closing immediately
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
    desktopShortcut: false,
    acceptsFiles: true,
    supportedExtensions: ['txt', 'md', 'js', 'css', 'json', 'bat', 'smc']
});
