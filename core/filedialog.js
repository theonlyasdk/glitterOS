// ── glitterOS File Dialog (Open/Save) ───────────────────────────────────────

const filedialog = {
    _createDialog(mode, options) {
        const container = document.createElement('div');
        container.className = 'lde-fd-container';

        let _cwd = options.startPath || 'C:\\Users\\User\\Documents';
        let _selectedFile = '';
        let win = null;

        // ── Navigation ────────────────────────────────────────────────────────
        function navigate(path) {
            const res = fs.ls(path);
            if (res.error) return;
            _cwd = path;
            _selectedFile = '';
            addressBar.value = _cwd;
            renderContent();
            renderSidebar();
        }

        // ── Toolbar ───────────────────────────────────────────────────────────
        const toolbar = document.createElement('div');
        toolbar.className = 'lde-fd-toolbar';

        const upBtn = document.createElement('button');
        upBtn.className = 'lde-fd-nav-btn';
        upBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
        upBtn.onclick = () => {
            const parts = _cwd.split('\\').filter(Boolean);
            if (parts.length > 0) {
                parts.pop();
                navigate(parts.length === 0 ? 'C:\\' : 'C:\\' + parts.join('\\'));
            }
        };

        const addressBar = document.createElement('input');
        addressBar.className = 'lde-fd-address';
        addressBar.type = 'text';
        addressBar.value = _cwd;
        addressBar.onkeydown = (e) => { if (e.key === 'Enter') navigate(addressBar.value); };

        const newFolderBtn = document.createElement('button');
        newFolderBtn.className = 'lde-fd-nav-btn';
        newFolderBtn.innerHTML = '<i class="bi bi-folder-plus"></i>';
        newFolderBtn.title = 'New Folder';
        newFolderBtn.onclick = () => {
            let n = 'New folder', i = 1;
            while (fs.exists((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n)) n = `New folder (${++i})`;
            fs.mkdir((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n);
            renderContent();
            // Optional: select it
        };

        toolbar.append(upBtn, newFolderBtn, addressBar);

        // ── Body ─────────────────────────────────────────────────────────────
        const body = document.createElement('div');
        body.className = 'lde-fd-body';

        const sidebar = document.createElement('div');
        sidebar.className = 'lde-fd-sidebar';

        const content = document.createElement('div');
        content.className = 'lde-fd-content';

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
                el.className = 'lde-fd-sidebar-item' + (_cwd === item.path ? ' active' : '');
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
                item.className = 'lde-fd-item';
                item.dataset.name = entry.name;
                item.innerHTML = `
                    <div class="lde-fd-item-icon ${isDir ? 'dir' : 'file'}">
                        <i class="bi ${isDir ? 'bi-folder-fill' : 'bi-file-earmark'}"></i>
                    </div>
                    <div class="lde-fd-item-name">${entry.name}</div>
                `;

                item.onclick = () => {
                    content.querySelectorAll('.lde-fd-item').forEach(el => el.classList.remove('selected'));
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

                content.appendChild(item);
            });
        }

        // ── Footer ───────────────────────────────────────────────────────────
        const footer = document.createElement('div');
        footer.className = 'lde-fd-footer';

        const row1 = document.createElement('div');
        row1.className = 'lde-fd-footer-row';
        row1.innerHTML = `<div class="lde-fd-label">File name:</div>`;
        const filenameInput = document.createElement('input');
        filenameInput.className = 'lde-fd-input';
        filenameInput.value = options.defaultName || '';
        row1.appendChild(filenameInput);

        const row2 = document.createElement('div');
        row2.className = 'lde-fd-footer-row';
        row2.innerHTML = `<div class="lde-fd-label">Save as type:</div>`;
        const typeSelect = document.createElement('select');
        typeSelect.className = 'lde-fd-select';
        typeSelect.innerHTML = `<option>Text Documents (*.txt)</option><option>All Files (*.*)</option>`;
        row2.appendChild(typeSelect);

        const row3 = document.createElement('div');
        row3.className = 'lde-fd-footer-row';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'lde-fd-btn me-2';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => wm.closeWindow(win.id);

        const commitBtn = document.createElement('button');
        commitBtn.className = 'lde-fd-btn primary';
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
