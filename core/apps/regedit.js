// ── Registry Editor ──────────────────────────────────────────────────────────

function launchRegistryEditor() {
    const container = document.createElement('div');
    container.className = 'lde-regedit';

    // ── State ─────────────────────────────────────────────────────────────
    let _selectedPath = '';
    let _selectedValueKey = null;
    let _expandedPaths = new Set();
    let _ctxMenu = null;

    // ── Input dialog helper (MessageBox with text field) ──────────────────
    function inputDialog(title, label, defaultVal, callback) {
        const dlgContainer = document.createElement('div');
        dlgContainer.className = 'lde-messagebox';

        const main = document.createElement('div');
        main.className = 'lde-messagebox-main';
        main.style.flexDirection = 'column';
        main.style.alignItems = 'stretch';
        main.style.gap = '10px';

        const lblEl = document.createElement('div');
        lblEl.style.cssText = 'font-size:0.85rem;color:#ccc;';
        lblEl.textContent = label;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultVal || '';
        input.style.cssText = 'background:#1a1a1a;border:1px solid #555;color:#eee;padding:5px 8px;font-size:0.85rem;font-family:monospace;width:100%;box-sizing:border-box;outline:none;';
        input.addEventListener('focus', () => input.style.borderColor = 'var(--accent-color)');
        input.addEventListener('blur', () => input.style.borderColor = '#555');

        main.append(lblEl, input);

        const buttons = document.createElement('div');
        buttons.className = 'lde-messagebox-buttons';

        const okBtn = document.createElement('button');
        okBtn.className = 'lde-msg-btn default';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => { wm.closeWindow(dlgWin.id); callback(input.value); };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'lde-msg-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => wm.closeWindow(dlgWin.id);

        buttons.append(okBtn, cancelBtn);
        dlgContainer.append(main, buttons);

        const dlgWin = wm.createWindow(title, dlgContainer, {
            noControls: true, noResize: true,
            width: 360, height: 180,
            icon: 'bi-pencil-square'
        });
        dlgWin.element.classList.add('lde-window-messagebox');

        setTimeout(() => { input.focus(); input.select(); }, 100);

        // Enter key submits
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
        });
    }

    // ── Edit Value dialog (name + data) ──────────────────────────────────
    function editValueDialog(title, nameVal, dataVal, nameReadOnly, callback) {
        const dlgContainer = document.createElement('div');
        dlgContainer.className = 'lde-messagebox';

        const main = document.createElement('div');
        main.className = 'lde-messagebox-main';
        main.style.flexDirection = 'column';
        main.style.alignItems = 'stretch';
        main.style.gap = '8px';

        const nameLbl = document.createElement('div');
        nameLbl.style.cssText = 'font-size:0.85rem;color:#aaa;';
        nameLbl.textContent = 'Value name:';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = nameVal || '';
        nameInput.readOnly = !!nameReadOnly;
        nameInput.style.cssText = 'background:#1a1a1a;border:1px solid #555;color:#eee;padding:5px 8px;font-size:0.85rem;font-family:monospace;width:100%;box-sizing:border-box;outline:none;' + (nameReadOnly ? 'opacity:0.5;' : '');

        const dataLbl = document.createElement('div');
        dataLbl.style.cssText = 'font-size:0.85rem;color:#aaa;margin-top:4px;';
        dataLbl.textContent = 'Value data:';

        const dataInput = document.createElement('input');
        dataInput.type = 'text';
        dataInput.value = dataVal !== undefined ? String(dataVal) : '';
        dataInput.style.cssText = 'background:#1a1a1a;border:1px solid #555;color:#eee;padding:5px 8px;font-size:0.85rem;font-family:monospace;width:100%;box-sizing:border-box;outline:none;';
        dataInput.addEventListener('focus', () => dataInput.style.borderColor = 'var(--accent-color)');
        dataInput.addEventListener('blur', () => dataInput.style.borderColor = '#555');

        main.append(nameLbl, nameInput, dataLbl, dataInput);

        const buttons = document.createElement('div');
        buttons.className = 'lde-messagebox-buttons';

        const okBtn = document.createElement('button');
        okBtn.className = 'lde-msg-btn default';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => { wm.closeWindow(dlgWin.id); callback(nameInput.value, dataInput.value); };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'lde-msg-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => wm.closeWindow(dlgWin.id);

        buttons.append(okBtn, cancelBtn);
        dlgContainer.append(main, buttons);

        const dlgWin = wm.createWindow(title, dlgContainer, {
            noControls: true, noResize: true,
            width: 380, height: 260,
            icon: 'bi-pencil-square'
        });
        dlgWin.element.classList.add('lde-window-messagebox');

        setTimeout(() => { (nameReadOnly ? dataInput : nameInput).focus(); }, 100);

        const handleKey = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
        };
        nameInput.addEventListener('keydown', handleKey);
        dataInput.addEventListener('keydown', handleKey);
    }

    // ── Actions ───────────────────────────────────────────────────────────
    function doAddKey() {
        const parentPath = _selectedPath;
        inputDialog('New Key', 'Enter key name:', '', (name) => {
            if (!name) return;
            const path = parentPath ? parentPath + '.' + name : name;
            // Ensure key exists as an object by setting a temp value
            registry.set(path + '.__init', '');
            registry.delete(path + '.__init');
            if (parentPath) _expandedPaths.add(parentPath);
            _selectedPath = path;
            rebuildTree();
        });
    }

    function doAddValue() {
        if (!_selectedPath) {
            wm.messageBox('Registry Editor', 'Select a key first.', { buttons: 'ok', icon: 'bi-info-circle-fill' });
            return;
        }
        editValueDialog('New Value', '', '', false, (name, data) => {
            if (!name) return;
            let parsed = parseValue(data);
            registry.set(_selectedPath + '.' + name, parsed);
            renderValues();
        });
    }

    function doDeleteSelected() {
        if (_selectedValueKey && _selectedPath) {
            wm.messageBox('Confirm Value Delete', `Are you sure you want to delete the value "${_selectedValueKey}"?`, {
                buttons: 'yesno', icon: 'bi-exclamation-triangle-fill',
                onYes: () => {
                    registry.delete(_selectedPath + '.' + _selectedValueKey);
                    _selectedValueKey = null;
                    renderValues();
                }
            });
        } else if (_selectedPath) {
            wm.messageBox('Confirm Key Delete', `Are you sure you want to permanently delete the key "${_selectedPath}" and all of its subkeys and values?`, {
                buttons: 'yesno', icon: 'bi-exclamation-triangle-fill',
                onYes: () => {
                    registry.delete(_selectedPath);
                    _expandedPaths.delete(_selectedPath);
                    _selectedPath = '';
                    rebuildTree();
                }
            });
        }
    }

    function doRenameKey() {
        if (!_selectedPath) return;
        const parts = _selectedPath.split('.');
        const oldName = parts[parts.length - 1];
        inputDialog('Rename Key', 'Enter new name:', oldName, (newName) => {
            if (!newName || newName === oldName) return;
            const parentPath = parts.slice(0, -1).join('.');
            const oldPath = _selectedPath;
            const newPath = parentPath ? parentPath + '.' + newName : newName;
            // Copy data to new path, delete old
            const data = registry.get(oldPath);
            if (data !== undefined) {
                registry.set(newPath, data);
                registry.delete(oldPath);
                _selectedPath = newPath;
                rebuildTree();
            }
        });
    }

    function parseValue(str) {
        if (str === 'true') return true;
        if (str === 'false') return false;
        if (str === 'null') return null;
        if (!isNaN(str) && str.trim() !== '') return Number(str);
        return str;
    }

    // ── Context Menu ──────────────────────────────────────────────────────
    function showContextMenu(x, y, items) {
        if (_ctxMenu) _ctxMenu.remove();

        _ctxMenu = document.createElement('div');
        _ctxMenu.style.cssText = `
            position:fixed;left:${x}px;top:${y}px;z-index:99999;
            background:#2b2b2b;border:1px solid #444;min-width:180px;padding:2px;
            box-shadow:2px 2px 8px rgba(0,0,0,0.45);font-size:0.85rem;
        `;

        items.forEach(item => {
            if (item === 'separator') {
                const hr = document.createElement('hr');
                hr.style.cssText = 'margin:2px 0;border-color:#444;';
                _ctxMenu.appendChild(hr);
                return;
            }
            const el = document.createElement('div');
            el.style.cssText = 'padding:5px 20px;color:' + (item.color || '#eee') + ';cursor:pointer;';
            if (item.disabled) { el.style.opacity = '0.4'; el.style.pointerEvents = 'none'; }
            el.textContent = item.label;
            el.onmouseenter = () => el.style.backgroundColor = '#3f3f3f';
            el.onmouseleave = () => el.style.backgroundColor = '';
            el.onclick = () => { _ctxMenu.remove(); _ctxMenu = null; if (item.action) item.action(); };
            _ctxMenu.appendChild(el);
        });

        document.body.appendChild(_ctxMenu);

        // Ensure menu stays within viewport
        const rect = _ctxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) _ctxMenu.style.left = (window.innerWidth - rect.width - 4) + 'px';
        if (rect.bottom > window.innerHeight) _ctxMenu.style.top = (window.innerHeight - rect.height - 4) + 'px';

        const closeCtx = (ev) => {
            if (_ctxMenu && !_ctxMenu.contains(ev.target)) {
                _ctxMenu.remove(); _ctxMenu = null;
                document.removeEventListener('mousedown', closeCtx);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeCtx), 10);
    }

    function showTreeContextMenu(e, path) {
        e.preventDefault();
        e.stopPropagation();
        // Select the node
        _selectedPath = path;
        _selectedValueKey = null;
        updatePathDisplay();
        renderValues();
        treePanel.querySelectorAll('.lde-regedit-node-row').forEach(r => r.classList.remove('selected'));
        // Find the clicked row
        const rows = treePanel.querySelectorAll('.lde-regedit-node-row');
        rows.forEach(r => { if (r._regPath === path) r.classList.add('selected'); });

        const isRoot = !path; // Computer root
        showContextMenu(e.clientX, e.clientY, [
            { label: 'New Key', action: doAddKey },
            { label: 'New Value', action: doAddValue, disabled: isRoot },
            'separator',
            { label: 'Rename', action: doRenameKey, disabled: isRoot || !path },
            { label: 'Delete', action: doDeleteSelected, disabled: isRoot || !path, color: '#f44336' },
            'separator',
            { label: 'Refresh', action: rebuildTree }
        ]);
    }

    function showValueContextMenu(e, key, value) {
        e.preventDefault();
        e.stopPropagation();
        _selectedValueKey = key;

        showContextMenu(e.clientX, e.clientY, [
            {
                label: 'Modify...', action: () => {
                    editValueDialog('Edit Value', key, value, true, (name, data) => {
                        registry.set(_selectedPath + '.' + key, parseValue(data));
                        renderValues();
                    });
                }
            },
            'separator',
            {
                label: 'Delete', action: () => {
                    wm.messageBox('Confirm Value Delete', `Are you sure you want to delete the value "${key}"?`, {
                        buttons: 'yesno', icon: 'bi-exclamation-triangle-fill',
                        onYes: () => {
                            registry.delete(_selectedPath + '.' + key);
                            _selectedValueKey = null;
                            renderValues();
                        }
                    });
                }, color: '#f44336'
            },
            'separator',
            {
                label: 'Rename', action: () => {
                    inputDialog('Rename Value', 'Enter new name:', key, (newName) => {
                        if (!newName || newName === key) return;
                        const val = registry.get(_selectedPath + '.' + key);
                        registry.set(_selectedPath + '.' + newName, val);
                        registry.delete(_selectedPath + '.' + key);
                        _selectedValueKey = newName;
                        renderValues();
                    });
                }
            }
        ]);
    }

    // ── Menu Bar ──────────────────────────────────────────────────────────
    const menuBar = buildAppMenuBar();

    menuBar.createMenu('File', [
        { label: 'Refresh', action: rebuildTree },
        { type: 'sep' },
        { label: 'Exit', action: () => wm.closeWindow(win.id) }
    ]);

    menuBar.createMenu('Edit', [
        { label: 'New Key', action: doAddKey },
        { label: 'New Value', action: doAddValue },
        { type: 'sep' },
        { label: 'Rename', action: doRenameKey },
        { label: 'Delete', action: doDeleteSelected, color: '#f44336' }
    ]);

    // ── Path Bar (own row, full width, editable) ─────────────────────────
    const pathBar = document.createElement('div');
    pathBar.className = 'lde-regedit-toolbar';
    pathBar.style.padding = '2px 8px';

    const pathInput = document.createElement('input');
    pathInput.className = 'lde-regedit-path';
    pathInput.value = 'Computer';
    pathInput.style.outline = 'none';

    pathInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const raw = pathInput.value.trim();
            // Parse path: strip leading "Computer\" or "Computer"
            let dotPath = raw.replace(/^Computer\\?/i, '').replace(/\\/g, '.').replace(/^\.|\.$/, '');

            if (!dotPath) {
                // Navigate to Computer root
                _selectedPath = '';
                _selectedValueKey = null;
                updatePathDisplay();
                rebuildTree();
                return;
            }

            // Validate that the path exists
            const val = registry.get(dotPath);
            if (val === undefined) {
                wm.messageBox('Registry Editor', `The key "${raw}" could not be found.`, { buttons: 'ok', icon: 'bi-x-circle-fill' });
                updatePathDisplay(); // Reset to current valid path
                return;
            }

            _selectedPath = dotPath;
            _selectedValueKey = null;
            // Expand all parents
            const parts = dotPath.split('.');
            _expandedPaths.add('__root');
            for (let i = 1; i <= parts.length; i++) {
                _expandedPaths.add(parts.slice(0, i).join('.'));
            }
            updatePathDisplay();
            rebuildTree();
        }
    });

    pathBar.appendChild(pathInput);

    // ── Body ──────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'lde-regedit-body';

    const treePanel = document.createElement('div');
    treePanel.className = 'lde-regedit-tree';

    const valuesPanel = document.createElement('div');
    valuesPanel.className = 'lde-regedit-values';

    body.append(treePanel, valuesPanel);

    // ── Status ────────────────────────────────────────────────────────────
    const statusBar = document.createElement('div');
    statusBar.className = 'lde-regedit-status';
    statusBar.textContent = 'Computer';

    container.append(menuBar, pathBar, body, statusBar);

    function updatePathDisplay() {
        const display = _selectedPath ? 'Computer\\' + _selectedPath.replace(/\./g, '\\') : 'Computer';
        pathInput.value = display;
        statusBar.textContent = display;
    }

    // ── Tree Building ─────────────────────────────────────────────────────
    function buildTreeNode(key, value, path, depth) {
        const node = document.createElement('div');
        node.className = 'lde-regedit-node';

        const row = document.createElement('div');
        row.className = 'lde-regedit-node-row';
        row._regPath = path;
        if (path === _selectedPath) row.classList.add('selected');

        const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
        const isExpanded = _expandedPaths.has(path);

        // Check if this object has any child objects (sub-keys)
        const hasChildKeys = isObject && Object.values(value).some(v => v !== null && typeof v === 'object' && !Array.isArray(v));

        const arrow = document.createElement('span');
        arrow.className = 'lde-regedit-node-arrow' + (isExpanded ? ' expanded' : '');
        arrow.innerHTML = hasChildKeys ? '▶' : '';

        const icon = document.createElement('i');
        icon.className = 'lde-regedit-node-icon ' + (isObject ? 'bi-folder-fill' : 'bi-file-earmark-text');

        const label = document.createElement('span');
        label.className = 'lde-regedit-node-label';
        label.textContent = key;

        row.append(arrow, icon, label);
        node.appendChild(row);

        const childrenWrap = document.createElement('div');
        childrenWrap.className = 'lde-regedit-children';
        childrenWrap.style.display = isExpanded ? 'block' : 'none';

        if (isObject) {
            Object.keys(value).forEach(childKey => {
                const childPath = path ? path + '.' + childKey : childKey;
                const childVal = value[childKey];
                // Only show objects (keys/hives) in the tree, not leaf values
                if (childVal !== null && typeof childVal === 'object' && !Array.isArray(childVal)) {
                    childrenWrap.appendChild(buildTreeNode(childKey, childVal, childPath, depth + 1));
                }
            });
            node.appendChild(childrenWrap);
        }

        row.onclick = (e) => {
            e.stopPropagation();
            treePanel.querySelectorAll('.lde-regedit-node-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            _selectedPath = path;
            _selectedValueKey = null;
            updatePathDisplay();

            if (isObject) {
                if (_expandedPaths.has(path)) _expandedPaths.delete(path);
                else _expandedPaths.add(path);
                childrenWrap.style.display = _expandedPaths.has(path) ? 'block' : 'none';
                arrow.classList.toggle('expanded', _expandedPaths.has(path));
            }

            renderValues();
        };

        row.addEventListener('contextmenu', (e) => showTreeContextMenu(e, path));

        return node;
    }

    function rebuildTree() {
        treePanel.innerHTML = '';
        const data = registry.getAll();

        // Build Computer root node
        const rootNode = document.createElement('div');
        rootNode.className = 'lde-regedit-node';

        const rootRow = document.createElement('div');
        rootRow.className = 'lde-regedit-node-row';
        rootRow._regPath = '';
        if (_selectedPath === '') rootRow.classList.add('selected');

        const rootExpanded = _expandedPaths.has('__root');
        const rootArrow = document.createElement('span');
        rootArrow.className = 'lde-regedit-node-arrow' + (rootExpanded ? ' expanded' : '');
        rootArrow.innerHTML = '▶';

        const rootIcon = document.createElement('i');
        rootIcon.className = 'lde-regedit-node-icon bi-pc-display';

        const rootLabel = document.createElement('span');
        rootLabel.className = 'lde-regedit-node-label';
        rootLabel.textContent = 'Computer';
        rootLabel.style.fontWeight = '600';

        rootRow.append(rootArrow, rootIcon, rootLabel);
        rootNode.appendChild(rootRow);

        const rootChildren = document.createElement('div');
        rootChildren.className = 'lde-regedit-children';
        rootChildren.style.display = rootExpanded ? 'block' : 'none';

        Object.keys(data).forEach(key => {
            rootChildren.appendChild(buildTreeNode(key, data[key], key, 0));
        });

        rootNode.appendChild(rootChildren);

        rootRow.onclick = (e) => {
            e.stopPropagation();
            treePanel.querySelectorAll('.lde-regedit-node-row').forEach(r => r.classList.remove('selected'));
            rootRow.classList.add('selected');
            _selectedPath = '';
            _selectedValueKey = null;
            updatePathDisplay();

            if (_expandedPaths.has('__root')) _expandedPaths.delete('__root');
            else _expandedPaths.add('__root');
            rootChildren.style.display = _expandedPaths.has('__root') ? 'block' : 'none';
            rootArrow.classList.toggle('expanded', _expandedPaths.has('__root'));

            renderValues();
        };

        rootRow.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            _selectedPath = '';
            _selectedValueKey = null;
            updatePathDisplay();
            treePanel.querySelectorAll('.lde-regedit-node-row').forEach(r => r.classList.remove('selected'));
            rootRow.classList.add('selected');
            showContextMenu(e.clientX, e.clientY, [
                { label: 'New Key', action: doAddKey },
                'separator',
                { label: 'Refresh', action: rebuildTree }
            ]);
        });

        treePanel.appendChild(rootNode);

        // Auto-expand root on first build
        if (!_expandedPaths.has('__root') && treePanel.children.length === 1) {
            _expandedPaths.add('__root');
            rootChildren.style.display = 'block';
            rootArrow.classList.add('expanded');
        }

        renderValues();
    }

    // ── Values Panel ──────────────────────────────────────────────────────
    function renderValues() {
        valuesPanel.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'lde-regedit-values-table';
        table.innerHTML = `
            <thead><tr>
                <th style="width:35%">Name</th>
                <th style="width:20%">Type</th>
                <th>Data</th>
            </tr></thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        if (_selectedPath === '') {
            tbody.innerHTML = '<tr><td colspan="3" style="color:#666;padding:10px;">Select a key to view its values.</td></tr>';
            valuesPanel.appendChild(table);
            return;
        }

        const node = registry.get(_selectedPath);
        if (node === undefined) {
            tbody.innerHTML = '<tr><td colspan="3" style="color:#666;padding:10px;">Key not found.</td></tr>';
            valuesPanel.appendChild(table);
            return;
        }

        if (typeof node === 'object' && node !== null) {
            let hasValues = false;
            Object.entries(node).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) return; // Skip sub-keys

                hasValues = true;
                const tr = document.createElement('tr');
                if (_selectedValueKey === key) tr.classList.add('selected');

                const typeStr = getRegType(value);
                const displayVal = truncateValue(value);

                tr.innerHTML = `
                    <td><i class="bi-file-earmark-text" style="color:#5bc0de;margin-right:6px;"></i>${escapeHtml(key)}</td>
                    <td class="lde-regedit-type">${typeStr}</td>
                    <td>${escapeHtml(displayVal)}</td>
                `;

                tr.onclick = () => {
                    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
                    tr.classList.add('selected');
                    _selectedValueKey = key;
                };

                tr.addEventListener('dblclick', () => {
                    editValueDialog('Edit Value', key, value, true, (name, data) => {
                        registry.set(_selectedPath + '.' + key, parseValue(data));
                        renderValues();
                    });
                });

                tr.addEventListener('contextmenu', (e) => showValueContextMenu(e, key, value));

                tbody.appendChild(tr);
            });

            if (!hasValues) {
                tbody.innerHTML = '<tr><td colspan="3" style="color:#666;padding:10px;">(No values)</td></tr>';
            }
        } else {
            const tr = document.createElement('tr');
            const typeStr = getRegType(node);
            tr.innerHTML = `
                <td><i class="bi-file-earmark-text" style="color:#5bc0de;margin-right:6px;"></i>(Default)</td>
                <td class="lde-regedit-type">${typeStr}</td>
                <td>${escapeHtml(truncateValue(node))}</td>
            `;
            tr.addEventListener('dblclick', () => {
                editValueDialog('Edit Value', '(Default)', node, true, (name, data) => {
                    registry.set(_selectedPath, parseValue(data));
                    renderValues();
                });
            });
            tbody.appendChild(tr);
        }

        valuesPanel.appendChild(table);
    }

    function getRegType(val) {
        if (val === null) return 'REG_NONE';
        if (typeof val === 'boolean') return 'REG_DWORD';
        if (typeof val === 'number') return 'REG_DWORD';
        if (typeof val === 'string') {
            if (val.startsWith('data:')) return 'REG_BINARY';
            return 'REG_SZ';
        }
        return 'REG_UNKNOWN';
    }

    function truncateValue(val) {
        const s = String(val);
        if (s.length > 80) return s.substring(0, 77) + '...';
        return s;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Init ──────────────────────────────────────────────────────────────
    const win = wm.createWindow('Registry Editor', container, {
        icon: 'bi-database-fill-gear',
        width: 720,
        height: 440
    });

    rebuildTree();
}

AppRegistry.register({
    id: 'regedit',
    name: 'Registry Editor',
    exe: 'regedit.exe',
    icon: 'bi-database-fill-gear',
    launch: () => launchRegistryEditor(),
    desktopShortcut: true
});
