// ── glitterOS File Manager — Windows 10 Dark Edition ──────────────────────────────

function launchFileManager(startPath) {
    const container = document.createElement('div');
    container.className = 'gos-fm';

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
    toolbar.className = 'gos-fm-toolbar';

    function makeBtn(icon, title, action) {
        const btn = document.createElement('div');
        btn.className = 'gos-fm-btn';
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
    addressBar.className = 'gos-fm-addressbar';
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
        gosShowContextMenu(x, y, [
            { label: 'Large icons', icon: 'bi-grid-3x3-gap', action: () => { _viewMode = 'large'; renderContent(); } },
            { type: 'sep' },
            { label: 'Details', icon: 'bi-table', action: () => { _viewMode = 'details'; renderContent(); } }
        ]);
    }

    function updateButtons() {
        backBtn.classList.toggle('disabled', _histIdx <= 0);
        forwardBtn.classList.toggle('disabled', _histIdx >= _hist.length - 1);
        upBtn.classList.toggle('disabled', _cwd === 'C:\\');
    }

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'gos-fm-body';

    const sidebar = document.createElement('div');
    sidebar.className = 'gos-fm-sidebar';

    const DRIVES = [
        { name: 'Local Disk (C:)', path: 'C:\\', icon: 'bi-hdd' },
    ];

    function updateSidebar() {
        sidebar.innerHTML = '';

        // 1. Quick Access
        let qaItems = [];
        try {
            qaItems = registry.get('Software.GlitterOS.Explorer.QuickAccess');
            if (!qaItems) {
                // Default Quick Access
                qaItems = [
                    { name: 'Users', path: 'C:\\Users', icon: 'bi-people' },
                    { name: 'Desktop', path: 'C:\\Users\\User\\Desktop', icon: 'bi-display' },
                    { name: 'Documents', path: 'C:\\Users\\User\\Documents', icon: 'bi-file-earmark-text' },
                    { name: 'Downloads', path: 'C:\\Users\\User\\Downloads', icon: 'bi-download' },
                    { name: 'Pictures', path: 'C:\\Users\\User\\Pictures', icon: 'bi-image' },
                ];
                registry.set('Software.GlitterOS.Explorer.QuickAccess', qaItems);
            }
        } catch (e) { }

        const qaHeader = document.createElement('div');
        qaHeader.className = 'gos-fm-sidebar-header';
        qaHeader.innerHTML = 'Quick access';
        qaHeader.style.cssText = 'padding:8px 12px;font-size:0.7rem;text-transform:uppercase;color:#888;font-weight:600;display:flex;align-items:center;gap:8px;';
        qaHeader.style.display = qaItems.length === 0 ? 'none' : 'flex';

        const qaContainer = document.createElement('div');
        qaContainer.style.display = qaItems.length === 0 ? 'none' : 'block';

        qaItems.forEach((qa, idx) => {
            const item = document.createElement('div');
            item.className = 'gos-fm-sidebar-item' + (qa.path === _cwd ? ' active' : '');
            item.dataset.path = qa.path;
            item.innerHTML = `<i class="bi ${qa.icon || 'bi-folder'}"></i><span>${qa.name}</span>`;
            item.onclick = () => navigate(qa.path);

            // Allow removing from Quick Access
            item.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                gosShowContextMenu(e.clientX, e.clientY, [
                    {
                        label: 'Unpin from Quick access', icon: 'bi-pin-angle', action: () => {
                            qaItems.splice(idx, 1);
                            registry.set('Software.GlitterOS.Explorer.QuickAccess', qaItems);
                            updateSidebar();
                        }
                    }
                ]);
            };
            qaContainer.appendChild(item);
        });

        // Drop handling for Quick Access
        if (!sidebar.dataset.hasListeners) {
            sidebar.addEventListener('dragover', (e) => {
                e.preventDefault();
                sidebar.querySelector('.gos-fm-sidebar-header').style.display = 'flex';
                sidebar.querySelector('.gos-fm-sidebar-header').nextSibling.style.display = 'block';
                sidebar.querySelector('.gos-fm-sidebar-header').style.color = 'var(--accent-color)';
            });
            sidebar.addEventListener('dragleave', (e) => {
                const head = sidebar.querySelector('.gos-fm-sidebar-header');
                const items = registry.get('Software.GlitterOS.Explorer.QuickAccess') || [];
                if (items.length === 0) {
                    head.style.display = 'none';
                    head.nextSibling.style.display = 'none';
                }
                head.style.color = '#888';
            });
            sidebar.addEventListener('drop', (e) => {
                e.preventDefault();
                const head = sidebar.querySelector('.gos-fm-sidebar-header');
                head.style.color = '#888';
                const data = e.dataTransfer.getData('text/plain');
                if (data) {
                    const paths = JSON.parse(data);
                    let currentQA = registry.get('Software.GlitterOS.Explorer.QuickAccess') || [];
                    paths.forEach(p => {
                        const stat = fs.stat(p);
                        if (!currentQA.find(x => x.path === p)) {
                            currentQA.push({ name: stat.name, path: p, icon: stat.type === 'dir' ? 'bi-folder' : 'bi-file-earmark' });
                        }
                    });
                    registry.set('Software.GlitterOS.Explorer.QuickAccess', currentQA);
                    updateSidebar();
                }
            });
            sidebar.dataset.hasListeners = 'true';
        }

        sidebar.append(qaHeader, qaContainer);

        // 2. Drives
        const driveHeader = document.createElement('div');
        driveHeader.textContent = 'Drives';
        driveHeader.style.cssText = 'padding:12px 12px 4px;font-size:0.7rem;text-transform:uppercase;color:#888;font-weight:600;';
        sidebar.appendChild(driveHeader);

        DRIVES.forEach(drive => {
            const item = document.createElement('div');
            item.className = 'gos-fm-sidebar-item' + (drive.path === _cwd ? ' active' : '');
            item.dataset.path = drive.path;
            item.innerHTML = `<i class="bi ${drive.icon}"></i><span>${drive.name}</span>`;
            item.onclick = () => navigate(drive.path);
            sidebar.appendChild(item);
        });
    }

    const content = document.createElement('div');
    content.className = 'gos-fm-content';
    content.style.position = 'relative';

    updateSidebar();
    body.append(sidebar, content);
    container.appendChild(body);

    const statusBar = document.createElement('div');
    statusBar.className = 'gos-fm-statusbar';
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
        const selectedItems = (forItems || []).map(name => {
            const path = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + name;
            return { name: name, type: fs.stat(path).type };
        });

        gosShowFileContextMenu(x, y, selectedItems, _cwd, {
            onOpen: () => openSelected(),
            onRename: (item) => startRename(item.name),
            onDelete: (items) => {
                items.forEach(item => {
                    const path = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + item.name;
                    if (item.type === 'dir') fs.rmdir(path, true); else fs.rm(path);
                });
                _selected = [];
                renderContent();
            },
            onNewFolder: createFolder,
            onNewFile: createFile,
            onRefresh: () => navigate(_cwd, false),
            onProperties: (item) => {
                const path = item.isCwd ? _cwd : (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + item.name;
                launchPropertiesDialog(path);
            }
        });
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
        const nameEl = el.querySelector('.gos-fm-item-name');
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

    function getIconForFile(name, type) {
        if (type === 'dir') return 'bi-folder-fill';
        const ext = name.split('.').pop().toLowerCase();
        if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'bi-file-earmark-music';
        if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return 'bi-file-earmark-play';
        if (['txt', 'md', 'log', 'ini', 'inf'].includes(ext)) return 'bi-file-earmark-text';
        if (['js', 'py', 'c', 'cpp', 'css', 'html', 'json', 'exe'].includes(ext)) return 'bi-file-earmark-code text-info';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp'].includes(ext)) return 'bi-file-earmark-image';
        return 'bi-file-earmark';
    }

    function openSelected() {
        if (_selected.length === 0) return;
        const res = fs.ls(_cwd);
        const entries = res.entries.filter(e => _selected.includes(e.name));

        if (entries.length === 1 && entries[0].type === 'dir') {
            const p = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + entries[0].name;
            navigate(p);
            return;
        }

        entries.forEach(entry => {
            const p = (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + entry.name;
            if (entry.type === 'dir') {
                launchFileManager(p);
            } else {
                SystemExec.run(p);
            }
        });
    }

    // Capture keyboard navigation
    container.tabIndex = 0;
    container.style.outline = 'none';
    container.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        const res = fs.ls(_cwd);
        const sorted = [...res.entries].sort((a, b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1));

        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            _selected = sorted.map(s => s.name);
            updateSelectionUI();
        } else if (e.key === 'Enter') {
            openSelected();
        } else if (e.key === 'Backspace') {
            navigateUp();
        } else if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            let nextIdx = 0;
            if (_selected.length > 0) {
                const lastIdx = sorted.findIndex(s => s.name === _selected[_selected.length - 1]);
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nextIdx = Math.min(sorted.length - 1, lastIdx + 1);
                else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nextIdx = Math.max(0, lastIdx - 1);
            }

            if (e.shiftKey) {
                const lastIdx = _lastClicked !== null ? _lastClicked : 0;
                const start = Math.min(lastIdx, nextIdx);
                const end = Math.max(lastIdx, nextIdx);
                _selected = sorted.slice(start, end + 1).map(s => s.name);
            } else {
                _selected = [sorted[nextIdx].name];
                _lastClicked = nextIdx;
            }
            updateSelectionUI();

            // Scroll into view if possible
            const targetEl = content.querySelector(`[data-name="${CSS.escape(sorted[nextIdx].name)}"]`) ||
                _tableWidget?.element.querySelector(`tr:nth-child(${nextIdx + 1})`);
            targetEl?.scrollIntoView({ block: 'nearest' });
        }
    });

    // ── Selection Rectangle Logic ─────────────────────────────────────────────
    let isSelecting = false;
    let startX, startY;
    let selectionRect = null;

    content.addEventListener('mousedown', (e) => {
        const isTableEmptySpace = e.target.classList.contains('gos-w32-table-container') || e.target.tagName === 'TBODY' || e.target.tagName === 'TABLE' || e.target === content;
        if (!isTableEmptySpace && !e.target.classList.contains('gos-fm-icons-view')) return;
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
                selectionRect.className = 'gos-fm-selection-rect';
                content.appendChild(selectionRect);
            }

            if (selectionRect) {
                let left = Math.min(startX, currentX);
                let top = Math.min(startY, currentY);
                let width = Math.abs(startX - currentX);
                let height = Math.abs(startY - currentY);

                // Vertical only for details view
                if (_viewMode === 'details') {
                    left = 0;
                    width = content.clientWidth;
                }

                selectionRect.style.left = left + 'px';
                selectionRect.style.top = top + 'px';
                selectionRect.style.width = width + 'px';
                selectionRect.style.height = height + 'px';

                // Check intersection with items
                const selBounds = { left, top, right: left + width, bottom: top + height };
                const newSelection = [];

                if (_viewMode === 'details' && _tableWidget) {
                    const tbody = _tableWidget.element.querySelector('tbody');
                    Array.from(tbody.children).forEach(tr => {
                        const itemRect = {
                            left: tr.offsetLeft,
                            top: tr.offsetTop,
                            right: tr.offsetLeft + tr.offsetWidth,
                            bottom: tr.offsetTop + tr.offsetHeight
                        };
                        if (selBounds.left < itemRect.right && selBounds.right > itemRect.left &&
                            selBounds.top < itemRect.bottom && selBounds.bottom > itemRect.top) {
                            newSelection.push(tr.dataset.id);
                        }
                    });
                } else {
                    content.querySelectorAll('.gos-fm-item').forEach(item => {
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
                }

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
        content.querySelectorAll('.gos-fm-item').forEach(el => {
            el.classList.toggle('selected', _selected.includes(el.dataset.name));
        });
        if (_tableWidget) {
            _tableWidget.setSelectedIds(_selected);
        }
        updateStatus();
    }

    // ── Rendering ────────────────────────────────────────────────────────────
    let _viewMode = 'large';
    let _tableWidget = null;

    function renderContent() {
        content.innerHTML = '';
        _tableWidget = null;
        updateSidebar();
        const res = fs.ls(_cwd);
        if (res.error) {
            content.innerHTML = `<div class="w-100 h-100 d-flex align-items-center justify-content-center text-secondary">${res.error}</div>`;
            return;
        }

        const sorted = [...res.entries].sort((a, b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1));

        if (_viewMode === 'details') {
            const cols = [
                {
                    id: 'name', label: 'Name', width: '50%',
                    render: (val, row) => `<i class="bi ${getIconForFile(val, row.origType)} mr-2" style="${row.origType === 'dir' ? 'color:#f0c330;' : ''}"></i> ${truncateFilename(val, 40)}`
                },
                { id: 'type', label: 'Type', width: '20%' },
                {
                    id: 'size', label: 'Size', width: '30%',
                    sortValue: row => row._sizeBytes || 0,
                    render: (val, row) => row.type === 'dir' ? '' : `${val} bytes`
                }
            ];

            const data = sorted.map(e => ({
                id: e.name,
                name: e.name,
                type: e.type === 'dir' ? 'File folder' : 'File',
                size: e.size !== 'N/A' ? (e.size || 0).toLocaleString() : '',
                _sizeBytes: e.size !== 'N/A' ? (e.size || 0) : 0,
                origType: e.type
            }));

            _tableWidget = Widgets.createTable({
                columns: cols,
                data: data,
                keyField: 'id',
                onSelectionChange: (selectedIds) => {
                    _selected = selectedIds;
                    updateSelectionUI();
                },
                onAction: (id, row) => {
                    openSelected();
                },
                onContextMenu: (id, row, e) => {
                    if (!_selected.includes(id)) {
                        _selected = [id];
                        updateSelectionUI();
                    }
                    showCtxMenu(e.clientX, e.clientY, _selected);
                }
            });

            // Drag support for table view
            _tableWidget.element.querySelectorAll('table tbody tr').forEach((tr, idx) => {
                tr.draggable = true;
                tr.ondragstart = (e) => {
                    const entryName = data[idx].name;
                    const paths = _selected.includes(entryName) ? _selected : [entryName];
                    const fullPaths = paths.map(n => (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n);
                    e.dataTransfer.setData('text/plain', JSON.stringify(fullPaths));
                    e.dataTransfer.effectAllowed = 'copyMove';
                };
            });
            content.appendChild(_tableWidget.element);

            // Set initial selection
            if (_selected.length > 0) {
                _tableWidget.setSelectedIds(_selected);
            }
        }
        else {
            // Icon View
            const iconContainer = document.createElement('div');
            iconContainer.className = 'gos-fm-icons-view';
            content.appendChild(iconContainer);

            sorted.forEach((entry, idx) => {
                const item = document.createElement('div');
                item.className = 'gos-fm-item';
                item.dataset.name = entry.name;
                item.dataset.idx = idx;
                item.draggable = true;
                item.ondragstart = (e) => {
                    const paths = _selected.length > 0 ? _selected : [entry.name];
                    const fullPaths = paths.map(n => (_cwd.endsWith('\\') ? _cwd : _cwd + '\\') + n);
                    e.dataTransfer.setData('text/plain', JSON.stringify(fullPaths));
                    e.dataTransfer.effectAllowed = 'copyMove';
                };
                const isDir = entry.type === 'dir';
                item.innerHTML = `
                    <div class="gos-fm-item-icon ${isDir ? 'dir' : 'file'}" style="${isDir ? 'color:#f0c330;' : ''}">
                        <i class="bi ${getIconForFile(entry.name, entry.type)}"></i>
                    </div>
                    <div class="gos-fm-item-name" title="${entry.name}">${truncateFilename(entry.name, 24)}</div>
                    ${!isDir ? `<div class="gos-fm-item-size text-secondary" style="font-size: 0.7rem; text-align: center;">${(entry.size || 0).toLocaleString()} bytes</div>` : ''}
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
                    openSelected();
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

                iconContainer.appendChild(item);
            });

            iconContainer.onmousedown = (e) => {
                if (e.target === iconContainer) {
                    _selected = [];
                    _lastClicked = null;
                    updateSelectionUI();
                }
            };
        }

        if (sorted.length === 0) {
            content.innerHTML = `<div class="w-100 h-100 d-flex align-items-center justify-content-center text-secondary">This folder is empty.</div>`;
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
        if (e.target === content || e.target.classList.contains('gos-fm-icons-view') || e.target.classList.contains('gos-w32-table-container') || e.target.tagName === 'TBODY' || e.target.tagName === 'TABLE') {
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
