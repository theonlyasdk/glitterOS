// ── glitterOS File Dialog (Open/Save) ───────────────────────────────────────

const filedialog = {
    _activeDialogs: {},
    _createDialog(mode, options) {
        const dialogToken = options.parentTitle || 'global';
        if (this._activeDialogs[dialogToken]) {
            const winObj = typeof wm !== 'undefined' ? wm.windows.find(w => w.id === this._activeDialogs[dialogToken]) : null;
            if (winObj) {
                wm.focusWindow(winObj.id);
                return;
            }
        }

        const container = document.createElement('div');
        container.className = 'gos-fd-container';

        let _cwd = options.startPath || 'C:\\Users\\User\\Documents';
        let _selectedFile = '';
        let win = null;

        // ── Interaction Logic ──────────────────────────────────────────────
        function startRename(name) {
            const el = content.querySelector(`[data-name="${CSS.escape(name)}"]`);
            if (!el) return;
            const nameEl = el.querySelector('.gos-fd-item-name');
            const input = document.createElement('input');
            input.className = 'gos-fd-rename-input';
            input.value = name;
            nameEl.replaceWith(input);
            input.focus();
            input.select();

            function commitRename() {
                const newName = input.value.trim();
                if (newName && newName !== name) {
                    const oldP = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + name;
                    const newP = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + newName;
                    const stat = fs.stat(oldP);
                    if (stat.type === 'file') {
                        const cat = fs.cat(oldP);
                        fs.write(newP, cat.content);
                        fs.rm(oldP);
                    } else {
                        fs.mkdir(newP);
                        fs.rmdir(oldP);
                    }
                }
                renderContent();
            }
            input.onblur = commitRename;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') input.blur();
                if (e.key === 'Escape') renderContent();
            };
        }

        function showCtxMenu(x, y, entry = null) {
            const selectedItems = entry ? [entry] : [];
            gosShowFileContextMenu(x, y, selectedItems, _cwd, {
                onOpen: (items) => {
                    const first = items[0];
                    const full = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + first.name;
                    if (fs.stat(full).type === 'dir') navigate(full);
                    else { _selectedFile = first.name; filenameInput.value = first.name; commit(); }
                },
                onRename: (item) => startRename(item.name),
                onDelete: (items) => {
                    const first = items[0];
                    const full = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + first.name;
                    if (fs.stat(full).type === 'dir') fs.rmdir(full, true); else fs.rm(full);
                    renderContent();
                },
                onNewFolder: createFolder,
                onNewFile: () => {
                    let n = 'New file.txt', i = 1;
                    while (fs.exists((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n)) n = `New file (${++i}).txt`;
                    fs.touch((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n);
                    renderContent();
                    setTimeout(() => startRename(n), 50);
                },
                onRefresh: () => renderContent(),
                onProperties: (item) => {
                    const path = item.isCwd ? _cwd : (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + item.name;
                    if (typeof launchPropertiesDialog === 'function') launchPropertiesDialog(path);
                }
            });
        }

        function createFolder() {
            let n = 'New folder', i = 1;
            while (fs.exists((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n)) n = `New folder (${++i})`;
            fs.mkdir((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n);
            renderContent();
            setTimeout(() => startRename(n), 50);
        }

        // ── Navigation ────────────────────────────────────────────────────────
        function navigate(path) {
            if (!fs.exists(path)) {
                wm.messageBox('Error', `The directory ${path} does not exist.`, { icon: 'bi-x-circle-fill' });
                return;
            }
            if (fs.stat(path).type !== 'dir') return;
            _cwd = path;
            addressBar.value = _cwd;
            renderSidebar();
            renderContent();
        }

        // ── Toolbar ───────────────────────────────────────────────────────────
        const toolbar = document.createElement('div');
        toolbar.className = 'gos-fd-toolbar';

        const upBtn = document.createElement('button');
        upBtn.className = 'gos-fd-nav-btn';
        upBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
        upBtn.onclick = () => {
            if (_cwd === 'C:\\') return;
            const parts = _cwd.replace('C:\\', '').split('\\').filter(Boolean);
            parts.pop();
            const parent = (parts.length === 0) ? 'C:\\' : 'C:\\' + parts.join('\\');
            navigate(parent);
        };

        const addressBar = document.createElement('input');
        addressBar.className = 'gos-fd-address';
        addressBar.type = 'text';
        addressBar.value = _cwd;
        addressBar.onkeydown = (e) => { if (e.key === 'Enter') navigate(addressBar.value); };

        const newFolderBtn = document.createElement('button');
        newFolderBtn.className = 'gos-fd-nav-btn';
        newFolderBtn.innerHTML = '<i class="bi bi-folder-plus"></i>';
        newFolderBtn.title = 'New Folder';
        newFolderBtn.onclick = createFolder;

        toolbar.append(upBtn, newFolderBtn, addressBar);

        // ── Body ─────────────────────────────────────────────────────────────
        const body = document.createElement('div');
        body.className = 'gos-fd-body';

        const sidebar = document.createElement('div');
        sidebar.className = 'gos-fd-sidebar';

        const content = document.createElement('div');
        content.className = 'gos-fd-content';
        content.oncontextmenu = (e) => {
            e.preventDefault();
            showCtxMenu(e.clientX, e.clientY);
        };

        body.append(sidebar, content);

        function renderSidebar() {
            sidebar.innerHTML = '';
            const QC = [
                { name: 'Users', path: 'C:\\Users', icon: 'bi-people' },
                { name: 'Desktop', path: 'C:\\Users\\User\\Desktop', icon: 'bi-display' },
                { name: 'Documents', path: 'C:\\Users\\User\\Documents', icon: 'bi-file-earmark-text' },
                { name: 'Downloads', path: 'C:\\Users\\User\\Downloads', icon: 'bi-download' },
                { name: 'Pictures', path: 'C:\\Users\\User\\Pictures', icon: 'bi-image' },
                { name: 'Recycle Bin', path: 'C:\\Recycle Bin', icon: 'bi-trash3' },
                { name: 'Disk (C:)', path: 'C:\\', icon: 'bi-hdd' },
            ];
            QC.forEach(item => {
                const el = document.createElement('div');
                el.className = 'gos-fd-sidebar-item' + (_cwd === item.path ? ' active' : '');
                el.innerHTML = `<i class="bi ${item.icon}"></i><span>${item.name}</span>`;
                el.onclick = () => navigate(item.path);
                sidebar.appendChild(el);
            });
        }

        function renderContent() {
            content.innerHTML = '';
            const res = fs.ls(_cwd);
            if (res.error) return;

            const sorted = [...res.entries].sort((a, b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1));

            if (sorted.length === 0) {
                content.innerHTML = `<div class="w-100 h-100 d-flex align-items-center justify-content-center text-secondary opacity-50" style="font-size:0.9rem;">This folder is empty.</div>`;
            }

            sorted.forEach(entry => {
                const isDir = entry.type === 'dir';
                const item = document.createElement('div');
                item.className = 'gos-fd-item';
                item.dataset.name = entry.name;
                item.innerHTML = `
                    <div class="gos-fd-item-icon ${isDir ? 'dir' : 'file'}">
                        <i class="bi ${isDir ? 'bi-folder-fill' : 'bi-file-earmark'}"></i>
                    </div>
                    <div class="gos-fd-item-name" title="${entry.name}">${truncateFilename(entry.name, 30)}</div>
                `;

                item.onclick = () => {
                    content.querySelectorAll('.gos-fd-item').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    if (!isDir) {
                        _selectedFile = entry.name;
                        filenameInput.value = entry.name;
                    }
                };

                item.ondblclick = () => {
                    const full = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + entry.name;
                    if (isDir) navigate(full);
                    else {
                        _selectedFile = entry.name;
                        filenameInput.value = entry.name;
                        commit();
                    }
                };

                item.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showCtxMenu(e.clientX, e.clientY, entry);
                };

                content.appendChild(item);
            });
        }

        const footer = document.createElement('div');
        footer.className = 'gos-fd-footer';
        footer.style.cssText = 'padding: 12px; background: #2b2b2b; border-top: 1px solid #333; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;';

        // Left side inputs
        const inputsCol = document.createElement('div');
        inputsCol.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 8px;';

        const row1 = document.createElement('div');
        row1.style.cssText = 'display: flex; align-items: center; gap: 10px;';
        row1.innerHTML = `<div class="gos-fd-label" style="width: 70px; text-align: right; font-size: 0.85rem; color: #888;">File name:</div>`;
        const filenameInput = document.createElement('input');
        filenameInput.className = 'gos-fd-input';
        filenameInput.value = options.defaultName || '';
        filenameInput.style.cssText = 'flex: 1; background: #1a1a1a; border: 1px solid #444; color: #fff; padding: 4px 8px; font-size: 0.85rem;';
        row1.appendChild(filenameInput);

        const row2 = document.createElement('div');
        row2.style.cssText = 'display: flex; align-items: center; gap: 10px;';
        row2.innerHTML = `<div class="gos-fd-label" style="width: 70px; text-align: right; font-size: 0.85rem; color: #888;">Save as:</div>`;
        const typeSelect = document.createElement('select');
        typeSelect.className = 'gos-fd-select';
        typeSelect.innerHTML = `<option>Text Documents (*.txt)</option><option>All Files (*.*)</option>`;
        typeSelect.style.cssText = 'flex: 1; background: #1a1a1a; border: 1px solid #444; color: #fff; padding: 4px 8px; font-size: 0.85rem;';
        row2.appendChild(typeSelect);

        inputsCol.append(row1, row2);

        // Right side buttons
        const btnsCol = document.createElement('div');
        btnsCol.style.cssText = 'display: flex; flex-direction: column; gap: 8px; width: 85px;';

        const commitBtn = document.createElement('button');
        commitBtn.className = 'gos-fd-btn primary';
        commitBtn.textContent = mode === 'save' ? 'Save' : 'Open';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'gos-fd-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => wm.closeWindow(win.id);

        btnsCol.append(commitBtn, cancelBtn);
        footer.append(inputsCol, btnsCol);

        function commit() {
            const name = filenameInput.value.trim();
            if (!name) return;
            const fullPath = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + name;

            if (mode === 'save' && fs.exists(fullPath)) {
                wm.messageBox('Confirm Save As', `${name} already exists.\nDo you want to replace it?`, {
                    buttons: 'yesno',
                    icon: 'bi-exclamation-triangle-fill',
                    onYes: () => {
                        wm.closeWindow(win.id);
                        if (options.onConfirm) options.onConfirm(fullPath);
                    }
                });
            } else {
                wm.closeWindow(win.id);
                if (options.onConfirm) options.onConfirm(fullPath);
            }
        }
        commitBtn.onclick = commit;

        container.append(toolbar, body, footer);

        container.tabIndex = 0;
        container.onkeydown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.key === 'Backspace') {
                e.preventDefault();
                upBtn.click();
            }
        };

        win = wm.createWindow(mode === 'save' ? 'Save As' : 'Open', container, {
            width: 560,
            height: 420,
            noResize: false,
            noControls: false,
            icon: mode === 'save' ? 'bi-save' : 'bi-folder2-open',
            modal: true,
            parentTitle: options.parentTitle
        });

        this._activeDialogs[dialogToken] = win.id;
        win.onClose = () => {
            delete this._activeDialogs[dialogToken];
        };

        renderSidebar();
        renderContent();
    },

    showOpen(options = {}) {
        this._createDialog('open', options);
    },

    showSave(options = {}) {
        this._createDialog('save', options);
    }
};
