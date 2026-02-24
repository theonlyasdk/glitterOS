// ── glitterOS File Manager — Windows 10 Dark Edition ──────────────────────────────

function launchFileManager(startPath) {
    const container = document.createElement('div');
    container.className = 'lde-fm';

    // ── State ─────────────────────────────────────────────────────────────────
    let _cwd = startPath || 'C:\\Users\\User';
    const _hist = [_cwd];
    let _histIdx = 0;
    let _selected = []; // Multi-selection: array of file names
    let _lastClicked = null; // For Shift-click range
    let _ctxMenu = null;

    // ── Navigation ────────────────────────────────────────────────────────────
    function navigate(path, pushHistory = true) {
        const res = fs.ls(path);
        if (res.error) return;

        // Ensure path is normalized to Windows style
        const normPath = fs.stat(path).name === 'C:' ? 'C:\\' : path.replace(/\//g, '\\');

        if (pushHistory) {
            _hist.splice(_histIdx + 1);
            _hist.push(normPath);
            _histIdx = _hist.length - 1;
        }
        _cwd = normPath;
        _selected = [];
        _lastClicked = null;
        addressBar.value = _cwd;
        renderContent();
        updateButtons();
        updateStatus();
    }

    function navigateUp() {
        if (_cwd === 'C:\\') return;
        const parts = _cwd.replace('C:\\', '').split('\\').filter(Boolean);
        parts.pop();
        const parent = parts.length === 0 ? 'C:\\' : 'C:\\' + parts.join('\\');
        navigate(parent);
    }

    function goBack() {
        if (_histIdx <= 0) return;
        _histIdx--;
        _cwd = _hist[_histIdx];
        _selected = [];
        addressBar.value = _cwd;
        renderContent();
        updateButtons();
        updateStatus();
    }

    function goForward() {
        if (_histIdx >= _hist.length - 1) return;
        _histIdx++;
        _cwd = _hist[_histIdx];
        _selected = [];
        addressBar.value = _cwd;
        renderContent();
        updateButtons();
        updateStatus();
    }

    // ── Toolbar ───────────────────────────────────────────────────────────────
    const toolbar = document.createElement('div');
    toolbar.className = 'lde-fm-toolbar';

    function makeBtn(icon, title, action) {
        const btn = document.createElement('div');
        btn.className = 'lde-fm-btn';
        btn.title = title;
        btn.innerHTML = `<i class="bi ${icon}"></i>`;
        btn.addEventListener('click', action);
        return btn;
    }

    const backBtn = makeBtn('bi-arrow-left', 'Back', goBack);
    const forwardBtn = makeBtn('bi-arrow-right', 'Forward', goForward);
    const upBtn = makeBtn('bi-arrow-up', 'Up', navigateUp);
    const refreshBtn = makeBtn('bi-arrow-clockwise', 'Refresh', () => navigate(_cwd, false));

    const viewBtn = makeBtn('bi-grid-3x3-gap', 'View');
    viewBtn.onclick = (e) => {
        e.stopPropagation();
        showViewDropdown(e.clientX, e.clientY);
    };

    const addressBar = document.createElement('input');
    addressBar.className = 'lde-fm-addressbar';
    addressBar.type = 'text';
    addressBar.placeholder = 'Search or enter path...';
    addressBar.value = _cwd;
    addressBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate(addressBar.value.trim());
    });

    const newFolderBtn = makeBtn('bi-folder-plus', 'New Folder', createFolder);

    toolbar.append(backBtn, forwardBtn, upBtn, refreshBtn, viewBtn, addressBar, newFolderBtn);
    container.appendChild(toolbar);

    function showViewDropdown(x, y) {
        ldeShowContextMenu(x, y, [
            { label: 'Extra large icons', icon: 'bi-grid-3x3-gap-fill', action: () => { } },
            { label: 'Large icons', icon: 'bi-grid-3x3-gap', action: () => { } },
            { label: 'Medium icons', icon: 'bi-grid', action: () => { } },
            { label: 'Small icons', icon: 'bi-view-list', action: () => { } },
            { type: 'sep' },
            { label: 'List', icon: 'bi-list-ul', action: () => { } },
            { label: 'Details', icon: 'bi-table', action: () => { } }
        ]);
    }

    function updateButtons() {
        backBtn.classList.toggle('disabled', _histIdx <= 0);
        forwardBtn.classList.toggle('disabled', _histIdx >= _hist.length - 1);
        upBtn.classList.toggle('disabled', _cwd === 'C:\\');
    }

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'lde-fm-body';

    const sidebar = document.createElement('div');
    sidebar.className = 'lde-fm-sidebar';

    const QUICK_ACCESS = [
        { name: 'Desktop', path: 'C:\\Users\\User\\Desktop', icon: 'bi-display' },
        { name: 'Documents', path: 'C:\\Users\\User\\Documents', icon: 'bi-file-earmark-text' },
        { name: 'Downloads', path: 'C:\\Users\\User\\Downloads', icon: 'bi-download' },
        { name: 'Pictures', path: 'C:\\Users\\User\\Pictures', icon: 'bi-image' },
        { name: 'Local Disk (C:)', path: 'C:\\', icon: 'bi-hdd' },
    ];

    QUICK_ACCESS.forEach(qa => {
        const item = document.createElement('div');
        item.className = 'lde-fm-sidebar-item';
        item.dataset.path = qa.path;
        item.innerHTML = `<i class="bi ${qa.icon}"></i><span>${qa.name}</span>`;
        item.onclick = () => navigate(qa.path);
        sidebar.appendChild(item);
    });

    function updateSidebar() {
        sidebar.querySelectorAll('.lde-fm-sidebar-item').forEach(s => {
            s.classList.toggle('active', s.dataset.path === _cwd);
        });
    }

    const content = document.createElement('div');
    content.className = 'lde-fm-content';
    content.style.position = 'relative';

    body.append(sidebar, content);
    container.appendChild(body);

    const statusBar = document.createElement('div');
    statusBar.className = 'lde-fm-statusbar';
    container.appendChild(statusBar);

    function updateStatus() {
        const res = fs.ls(_cwd);
        const total = res.entries ? res.entries.length : 0;
        const selCount = _selected.length;
        statusBar.innerHTML = `<span>${total} items</span>` +
            (selCount > 0 ? `<span>${selCount} item${selCount > 1 ? 's' : ''} selected</span>` : '');
    }

    // ── Context Menu ──────────────────────────────────────────────────────────
    function showCtxMenu(x, y, forItems) {
        const items = [];

        if (forItems && forItems.length > 0) {
            if (forItems.length === 1) {
                const name = forItems[0];
                const path = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + name;
                const isDir = fs.stat(path).type === 'dir';
                items.push({
                    label: 'Open',
                    icon: isDir ? 'bi-folder2-open' : 'bi-eye',
                    action: () => {
                        if (isDir) navigate(path);
                        else SystemExec.run(path);
                    }
                });
                items.push({ label: 'Rename', icon: 'bi-pencil', action: () => startRename(name) });
            }
            items.push({
                label: 'Delete',
                icon: 'bi-trash',
                color: 'danger',
                action: () => {
                    forItems.forEach(name => {
                        const path = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + name;
                        if (fs.stat(path).type === 'dir') fs.rmdir(path); else fs.rm(path);
                    });
                    _selected = [];
                    renderContent();
                }
            });

            if (forItems.length === 1) {
                items.push({ type: 'sep' });
                items.push({
                    label: 'Properties',
                    icon: 'bi-info-circle',
                    action: () => {
                        const path = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + forItems[0];
                        launchPropertiesDialog(path);
                    }
                });
            }
        } else {
            items.push({ label: 'New Folder', icon: 'bi-folder-plus', action: createFolder });
            items.push({ label: 'New File', icon: 'bi-file-earmark-plus', action: createFile });
            items.push({ type: 'sep' });
            items.push({ label: 'Refresh', icon: 'bi-arrow-clockwise', action: () => navigate(_cwd, false) });
        }

        ldeShowContextMenu(x, y, items);
    }

    // ── File Operations ──────────────────────────────────────────────────────
    function createFolder() {
        let n = 'New folder', i = 1;
        while (fs.exists((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n)) n = `New folder (${++i})`;
        fs.mkdir((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n);
        renderContent();
        setTimeout(() => startRename(n), 50);
    }

    function createFile() {
        let n = 'New file.txt', i = 1;
        while (fs.exists((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n)) n = `New file (${++i}).txt`;
        fs.touch((_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n);
        renderContent();
        setTimeout(() => startRename(n), 50);
    }

    function startRename(name) {
        const el = content.querySelector(`[data-name="${CSS.escape(name)}"]`);
        if (!el) return;
        const nameEl = el.querySelector('.lde-fm-item-name');
        const input = document.createElement('input');
        input.value = name;
        nameEl.replaceWith(input);
        input.focus();
        input.select();

        function commit() {
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
                    fs.mkdir(newP); // FS doesn't support move, so limited
                    fs.rmdir(oldP);
                }
            }
            renderContent();
        }
        input.onblur = commit;
        input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') renderContent(); };
    }

    // ── Selection Rectangle Logic ─────────────────────────────────────────────
    let isSelecting = false;
    let startX, startY;
    let selectionRect = null;

    content.addEventListener('mousedown', (e) => {
        if (e.target !== content) return;
        if (e.button !== 0) return; // Left click only

        isSelecting = true;
        const rect = content.getBoundingClientRect();
        startX = e.clientX - rect.left + content.scrollLeft;
        startY = e.clientY - rect.top + content.scrollTop;

        _selected = [];
        updateSelectionUI();

        const onMouseMove = (moveEvent) => {
            if (!isSelecting) return;

            // Get fresh rect in case of resize or scroll
            const rect = content.getBoundingClientRect();
            let currentX = moveEvent.clientX - rect.left + content.scrollLeft;
            let currentY = moveEvent.clientY - rect.top + content.scrollTop;

            // Clamp to visible area to prevent expansion/scrolling
            currentX = Math.max(content.scrollLeft, Math.min(currentX, content.scrollLeft + content.clientWidth));
            currentY = Math.max(content.scrollTop, Math.min(currentY, content.scrollTop + content.clientHeight));

            // Only create rect after some movement
            if (!selectionRect && (Math.abs(currentX - startX) > 2 || Math.abs(currentY - startY) > 2)) {
                selectionRect = document.createElement('div');
                selectionRect.className = 'lde-fm-selection-rect';
                content.appendChild(selectionRect);
            }

            if (selectionRect) {
                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(startX - currentX);
                const height = Math.abs(startY - currentY);

                selectionRect.style.left = left + 'px';
                selectionRect.style.top = top + 'px';
                selectionRect.style.width = width + 'px';
                selectionRect.style.height = height + 'px';

                // Check intersection with items
                const selBounds = { left, top, right: left + width, bottom: top + height };
                const newSelection = [];
                content.querySelectorAll('.lde-fm-item').forEach(item => {
                    const itemRect = {
                        left: item.offsetLeft,
                        top: item.offsetTop,
                        right: item.offsetLeft + item.offsetWidth,
                        bottom: item.offsetTop + item.offsetHeight
                    };

                    if (selBounds.left < itemRect.right && selBounds.right > itemRect.left &&
                        selBounds.top < itemRect.bottom && selBounds.bottom > itemRect.top) {
                        newSelection.push(item.dataset.name);
                    }
                });
                _selected = newSelection;
                updateSelectionUI();
            }
        };

        const onMouseUp = () => {
            isSelecting = false;
            if (selectionRect) {
                selectionRect.remove();
                selectionRect = null;
            }
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    function updateSelectionUI() {
        content.querySelectorAll('.lde-fm-item').forEach(el => {
            el.classList.toggle('selected', _selected.includes(el.dataset.name));
        });
        updateStatus();
    }

    // ── Rendering ────────────────────────────────────────────────────────────
    function renderContent() {
        content.innerHTML = '';
        updateSidebar();
        const res = fs.ls(_cwd);
        if (res.error) {
            content.innerHTML = `<div class="w-100 h-100 d-flex align-items-center justify-content-center text-secondary">${res.error}</div>`;
            return;
        }

        const sorted = [...res.entries].sort((a, b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1));

        sorted.forEach((entry, idx) => {
            const item = document.createElement('div');
            item.className = 'lde-fm-item';
            item.dataset.name = entry.name;
            item.dataset.idx = idx;
            const isDir = entry.type === 'dir';
            item.innerHTML = `
				<div class="lde-fm-item-icon ${isDir ? 'dir' : 'file'}">
					<i class="bi ${isDir ? 'bi-folder-fill' : 'bi-file-earmark'}"></i>
				</div>
				<div class="lde-fm-item-name">${entry.name}</div>
			`;

            item.onclick = (e) => {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                    if (_selected.includes(entry.name)) _selected = _selected.filter(n => n !== entry.name);
                    else _selected.push(entry.name);
                } else if (e.shiftKey && _lastClicked !== null) {
                    const start = Math.min(_lastClicked, idx);
                    const end = Math.max(_lastClicked, idx);
                    _selected = sorted.slice(start, end + 1).map(s => s.name);
                } else {
                    _selected = [entry.name];
                }
                _lastClicked = idx;
                updateSelectionUI();
            };

            item.ondblclick = () => {
                const path = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + entry.name;
                if (isDir) navigate(path);
                else {
                    SystemExec.run(path);
                }
            };

            item.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!_selected.includes(entry.name)) {
                    _selected = [entry.name];
                    _lastClicked = idx;
                    updateSelectionUI();
                }
                showCtxMenu(e.clientX, e.clientY, _selected);
            };

            content.appendChild(item);
        });

        if (sorted.length === 0) {
            content.innerHTML = `<div class="w-100 h-100 d-flex align-items-center justify-content-center text-secondary">No items.</div>`;
        }

        updateSelectionUI();
    }

    content.addEventListener('click', (e) => {
        if (e.target === content) {
            _selected = [];
            _lastClicked = null;
            updateSelectionUI();
        }
    });

    content.oncontextmenu = (e) => {
        if (e.target === content) {
            e.preventDefault();
            showCtxMenu(e.clientX, e.clientY, []);
        }
    };

    updateButtons();
    renderContent();
    updateStatus();

    wm.createWindow('File Explorer', container, {
        icon: 'ri-folder-open-line',
        width: 700,
        height: 480
    });
}

AppRegistry.register({
    id: 'filemanager',
    name: 'File Explorer',
    exe: 'explorer.exe',
    icon: 'ri-folder-open-line',
    launch: (path) => launchFileManager(path),
    desktopShortcut: true
});
