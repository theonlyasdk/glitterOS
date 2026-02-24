// ── glitterOS File Dialog (Open/Save) ───────────────────────────────────────

const filedialog = {
    _createDialog(mode, options) {
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

        function showCtxMenu(x, y, entryName = null) {
            const items = [];

            if (entryName) {
                items.push({
                    label: 'Open',
                    icon: 'bi-folder2-open',
                    action: () => {
                        const full = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + entryName;
                        if (fs.stat(full).type === 'dir') navigate(full);
                        else { _selectedFile = entryName; filenameInput.value = entryName; commit(); }
                    }
                });
                items.push({ label: 'Rename', icon: 'bi-pencil', action: () => startRename(entryName) });
                items.push({
                    label: 'Delete',
                    icon: 'bi-trash',
                    color: 'danger',
                    action: () => {
                        const full = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + entryName;
                        if (fs.stat(full).type === 'dir') fs.rmdir(full); else fs.rm(full);
                        renderContent();
                    }
                });
            } else {
                items.push({ label: 'New Folder', icon: 'bi-folder-plus', action: createFolder });
                items.push({ type: 'sep' });
                items.push({ label: 'Refresh', icon: 'bi-arrow-clockwise', action: () => renderContent() });
            }

            gosShowContextMenu(x, y, items);
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
            if (!fs.exists(path) || fs.stat(path).type !== 'dir') return;
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
            const parts = _cwd.split('\\').filter(Boolean);
            if (parts.length > 0) {
                parts.pop();
                navigate(parts.length === 0 ? 'C:\\' : 'C:\\' + parts.join('\\'));
            }
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
                { name: 'Desktop', path: 'C:\\Users\\User\\Desktop', icon: 'bi-display' },
                { name: 'Documents', path: 'C:\\Users\\User\\Documents', icon: 'bi-file-earmark-text' },
                { name: 'Downloads', path: 'C:\\Users\\User\\Downloads', icon: 'bi-download' },
                { name: 'Pictures', path: 'C:\\Users\\User\\Pictures', icon: 'bi-image' },
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
                    showCtxMenu(e.clientX, e.clientY, entry.name);
                };

                content.appendChild(item);
            });
        }

        // ── Footer ───────────────────────────────────────────────────────────
        const footer = document.createElement('div');
        footer.className = 'gos-fd-footer';

        const row1 = document.createElement('div');
        row1.className = 'gos-fd-footer-row';
        row1.innerHTML = `<div class="gos-fd-label">File name:</div>`;
        const filenameInput = document.createElement('input');
        filenameInput.className = 'gos-fd-input';
        filenameInput.value = options.defaultName || '';
        row1.appendChild(filenameInput);

        const row2 = document.createElement('div');
        row2.className = 'gos-fd-footer-row';
        row2.innerHTML = `<div class="gos-fd-label">Save as:</div>`;
        const typeSelect = document.createElement('select');
        typeSelect.className = 'gos-fd-select';
        typeSelect.innerHTML = `<option>Text Documents (*.txt)</option><option>All Files (*.*)</option>`;
        row2.appendChild(typeSelect);

        const row3 = document.createElement('div');
        row3.className = 'gos-fd-footer-row';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'gos-fd-btn me-2';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => wm.closeWindow(win.id);

        const commitBtn = document.createElement('button');
        commitBtn.className = 'gos-fd-btn primary';
        commitBtn.textContent = mode === 'save' ? 'Save' : 'Open';

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

        row3.append(commitBtn, cancelBtn);

        footer.append(row1, row2, row3);

        container.append(toolbar, body, footer);

        win = wm.createWindow(mode === 'save' ? 'Save As' : 'Open', container, {
            width: 560,
            height: 420,
            noResize: true,
            noControls: true, // Typically dialogs have fewer controls
            icon: mode === 'save' ? 'bi-save' : 'bi-folder2-open'
        });

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
