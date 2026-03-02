// ── Registry Editor ──────────────────────────────────────────────────────────

function launchRegistryEditor() {
    const container = document.createElement('div');
    container.className = 'gos-regedit';

    // ── State ─────────────────────────────────────────────────────────────
    let _selectedPath = '';
    let _selectedPaths = new Set();
    let _selectedValueKeys = [];
    let _expandedPaths = new Set();
    let _ctxMenu = null;

    // ── Input dialog helper (MessageBox with text field) ──────────────────
    function inputDialog(title, label, defaultVal, callback) {
        const dlgContainer = document.createElement('div');
        dlgContainer.className = 'gos-messagebox';

        const main = document.createElement('div');
        main.className = 'gos-messagebox-main';
        main.style.flexDirection = 'column';
        main.style.alignItems = 'stretch';
        main.style.gap = '10px';

        const lblEl = document.createElement('div');
        lblEl.style.cssText = 'font-size:0.85rem;color:#ccc;';
        lblEl.textContent = label;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultVal || '';
        input.classList.add('gos-w32-input');

        main.append(lblEl, input);

        const buttons = document.createElement('div');
        buttons.className = 'gos-messagebox-buttons';

        const okBtn = document.createElement('button');
        okBtn.className = 'gos-msg-btn default';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => { wm.closeWindow(dlgWin.id); callback(input.value); };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'gos-msg-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => wm.closeWindow(dlgWin.id);

        buttons.append(okBtn, cancelBtn);
        dlgContainer.append(main, buttons);

        const dlgWin = wm.createWindow(title, dlgContainer, {
            noControls: true, noResize: true,
            width: 360, height: 180,
            icon: 'bi-pencil-square',
            modal: true,
            parentTitle: 'Registry Editor'
        });
        dlgWin.element.classList.add('gos-window-messagebox');

        setTimeout(() => { input.focus(); input.select(); }, 100);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
        });
    }

    function openValueDialog(defaultData) {
        editValueDialog('New Value', '', defaultData, false, (name, finalData) => {
            if (!name) return;
            registry.set(_selectedPath + '.' + name, finalData);
            renderValues();
        });
    }

    // ── Edit Value dialog (adaptive) ────────────────────────────────────
    function editValueDialog(title, nameVal, dataVal, nameReadOnly, callback) {
        const dlgContainer = document.createElement('div');
        dlgContainer.className = 'gos-messagebox';
        dlgContainer.style.height = '100%';

        const main = document.createElement('div');
        main.className = 'gos-messagebox-main';
        main.style.cssText = 'display:grid;grid-template-columns:100px 1fr;gap:6px;padding:10px 14px;align-items:start;overflow-y:auto;';

        const nameLbl = document.createElement('div');
        nameLbl.style.cssText = 'font-size:0.85rem;color:#ccc;padding-top:6px;';
        nameLbl.textContent = 'Value name:';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = nameVal === '(Default)' ? '' : (nameVal || '');
        nameInput.placeholder = '(Default)';
        nameInput.readOnly = !!nameReadOnly;
        nameInput.style.cssText = 'background:#1a1a1a;border:1px solid #444;color:#eee;padding:6px 10px;font-size:0.85rem;font-family:var(--font-family-mono);width:100%;box-sizing:border-box;' + (nameReadOnly ? 'opacity:0.6;background:transparent;' : '');

        const dataLbl = document.createElement('div');
        dataLbl.style.cssText = 'font-size:0.85rem;color:#ccc;padding-top:6px;';
        dataLbl.textContent = 'Value data:';

        let getData = () => dataInput.value;
        const dataWrap = document.createElement('div');
        dataWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

        if (typeof dataVal === 'boolean') {
            const radioWrap = document.createElement('div');
            radioWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:4px 0;';

            const createRadio = (lbl, val) => {
                const l = document.createElement('label');
                l.style.cssText = 'display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.85rem;';
                const r = document.createElement('input');
                r.type = 'radio';
                r.name = 'reg-bool';
                r.style.cssText = 'width:16px;height:16px;accent-color:var(--accent-color);';
                r.value = val;
                r.checked = dataVal === val;
                l.append(r, document.createTextNode(lbl));
                return { label: l, radio: r };
            };

            const t = createRadio('True', true);
            const f = createRadio('False', false);
            radioWrap.append(t.label, f.label);
            dataWrap.appendChild(radioWrap);
            getData = () => t.radio.checked;
        } else if (typeof dataVal === 'number') {
            const numInput = document.createElement('input');
            numInput.type = 'number';
            numInput.value = dataVal;
            numInput.style.cssText = 'background:#1a1a1a;border:1px solid #444;color:#eee;padding:6px 10px;font-size:0.85rem;font-family:var(--font-family-mono);width:100%;box-sizing:border-box;';
            dataWrap.appendChild(numInput);
            getData = () => {
                const v = parseFloat(numInput.value);
                return isNaN(v) ? 0 : v;
            };
        } else if (Array.isArray(dataVal)) {
            const container = document.createElement('div');
            container.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

            let selectedRowIds = [];
            const delBtn = document.createElement('button');
            delBtn.className = 'gos-msg-btn';
            delBtn.textContent = 'Remove';
            delBtn.style.display = dataVal.length ? 'inline-block' : 'none';
            delBtn.disabled = true;

            const rows = dataVal.map((v, i) => ({ id: i, value: v }));
            const tbl = Widgets.createTable({
                columns: [
                    {
                        id: 'value', label: 'Value', width: '100%', render: (val, row) => `
                        <input type="text" class="gos-table-edit" value="${val}" 
                        style="width:100%;background:transparent;border:none;color:inherit;font-size:inherit;padding:0;outline:none;"
                        onchange="this.parentElement.dataset.val = this.value">`
                    }
                ],
                data: rows,
                keyField: 'id',
                onSelectionChange: (ids) => {
                    selectedRowIds = ids;
                    delBtn.disabled = selectedRowIds.length === 0;
                }
            });
            tbl.element.style.height = '180px';

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:8px;';

            const addBtn = document.createElement('button');
            addBtn.className = 'gos-msg-btn';
            addBtn.textContent = 'Add';
            addBtn.onclick = () => {
                const newId = rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 0;
                rows.push({ id: newId, value: '' });
                tbl.updateData(rows);
                delBtn.style.display = 'inline-block';
            };

            delBtn.onclick = () => {
                if (selectedRowIds.length > 0) {
                    selectedRowIds.forEach(id => {
                        const idx = rows.findIndex(r => r.id === id);
                        if (idx !== -1) rows.splice(idx, 1);
                    });
                    tbl.updateData(rows);
                    selectedRowIds = [];
                    delBtn.disabled = true;
                    if (rows.length === 0) delBtn.style.display = 'none';
                }
            };

            btnRow.append(addBtn, delBtn);
            container.append(tbl.element, btnRow);
            dataWrap.appendChild(container);

            getData = () => {
                // Collect values from table inputs
                const inputs = tbl.element.querySelectorAll('.gos-table-edit');
                return Array.from(inputs).map(inp => inp.value);
            };
        } else {
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.value = dataVal !== undefined ? String(dataVal) : '';
            textInput.style.cssText = 'background:#1a1a1a;border:1px solid #444;color:#eee;padding:6px 10px;font-size:0.85rem;font-family:var(--font-family-mono);width:100%;box-sizing:border-box;';
            dataWrap.appendChild(textInput);
            getData = () => textInput.value;
        }

        main.append(nameLbl, nameInput, dataLbl, dataWrap);

        const footer = document.createElement('div');
        footer.className = 'gos-messagebox-buttons';
        footer.style.cssText = 'justify-content:space-between;align-items:center;padding:6px 14px;min-height:38px;';

        const type = getRegType(dataVal);
        const typeDisplay = document.createElement('div');
        typeDisplay.style.cssText = 'font-size:0.75rem;color:#888;padding-left:4px;';
        typeDisplay.textContent = type;

        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex';
        btnWrap.style.gap = '8px';

        const okBtn = document.createElement('button');
        okBtn.className = 'gos-msg-btn default';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => {
            const finalData = getData();
            wm.closeWindow(dlgWin.id);
            callback(nameInput.value || '(Default)', finalData);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'gos-msg-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => wm.closeWindow(dlgWin.id);

        btnWrap.append(okBtn, cancelBtn);
        footer.append(typeDisplay, btnWrap);
        dlgContainer.append(main, footer);

        const dlgWin = wm.createWindow(title, dlgContainer, {
            noResize: false,
            width: 480, height: Array.isArray(dataVal) ? 400 : 250,
            icon: 'bi-pencil-square',
            modal: true,
            parentTitle: 'Registry Editor'
        });
        dlgWin.element.classList.add('gos-window-messagebox');

        const focusTarget = (nameReadOnly ? dataWrap.querySelector('input') : nameInput);
        if (focusTarget) setTimeout(() => focusTarget.focus(), 100);
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
        if (_selectedValueKeys.length > 0 && _selectedPath) {
            const count = _selectedValueKeys.length;
            const msg = count === 1 ? `Are you sure you want to delete the value "${_selectedValueKeys[0]}"?` : `Are you sure you want to delete these ${count} values?`;
            wm.messageBox('Confirm Value Delete', msg, {
                buttons: 'yesno', icon: 'bi-exclamation-triangle-fill', modal: true,
                onYes: () => {
                    _selectedValueKeys.forEach(key => {
                        registry.delete(_selectedPath + '.' + (key === '(Default)' ? '' : key));
                    });
                    _selectedValueKeys = [];
                    renderValues();
                }
            });
        } else if (_selectedPaths.size > 0) {
            const paths = Array.from(_selectedPaths);
            const count = paths.length;
            const msg = count === 1 ? `Are you sure you want to permanently delete the key "${paths[0]}"?` : `Are you sure you want to permanently delete these ${count} keys and all of their subkeys?`;

            wm.messageBox('Confirm Key Delete', msg, {
                buttons: 'yesno', icon: 'bi-exclamation-triangle-fill', modal: true,
                onYes: () => {
                    paths.forEach(p => {
                        registry.delete(p);
                        _expandedPaths.delete(p);
                    });
                    _selectedPaths.clear();
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
    function showTreeContextMenu(e, path) {
        e.preventDefault();
        e.stopPropagation();
        _selectedPath = path;
        _selectedValueKeys = [];
        updatePathDisplay();
        renderValues();
        treePanel.querySelectorAll('.gos-regedit-node-row').forEach(r => r.classList.remove('selected'));
        const rows = treePanel.querySelectorAll('.gos-regedit-node-row');
        rows.forEach(r => { if (r._regPath === path) r.classList.add('selected'); });

        const isRoot = !path;
        gosShowContextMenu(e.clientX, e.clientY, [
            {
                label: 'New', icon: 'bi-plus-lg', hasSubmenu: true,
                onMouseEnter: (ev, el) => {
                    const rect = el.getBoundingClientRect();
                    gosShowContextMenu(rect.right, rect.top, [
                        { label: 'Key', icon: 'bi-folder-plus', action: doAddKey },
                        { type: 'sep' },
                        { label: 'String Value', icon: 'bi-file-earmark-text', action: () => openValueDialog('') },
                        { label: 'Binary Value', icon: 'bi-file-earmark-binary', action: () => openValueDialog(0) },
                        { label: 'DWORD (32-bit) Value', icon: 'bi-file-earmark-binary', action: () => openValueDialog(0) },
                        { label: 'Multi-String Value', icon: 'bi-file-earmark-medical', action: () => openValueDialog([]) }
                    ], true);
                }
            },
            { type: 'sep' },
            { label: 'Rename', icon: 'bi-pencil', action: doRenameKey, disabled: isRoot || !path },
            { label: 'Delete', icon: 'bi-trash', action: doDeleteSelected, disabled: isRoot || !path, color: 'danger' },
            { type: 'sep' },
            { label: 'Refresh', icon: 'bi-arrow-clockwise', action: rebuildTree }
        ]);
    }

    function showValueContextMenu(e, key, value) {
        e.preventDefault();
        e.stopPropagation();
        if (!_selectedValueKeys.includes(key)) {
            _selectedValueKeys = [key];
            if (_valuesTbl) _valuesTbl.setSelectedIds(_selectedValueKeys);
        }

        gosShowContextMenu(e.clientX, e.clientY, [
            {
                label: 'Modify...', icon: 'bi-pencil-square', action: () => {
                    editValueDialog('Edit Value', key, value, true, (name, finalData) => {
                        registry.set(_selectedPath + '.' + key, finalData);
                        renderValues();
                    });
                }
            },
            { type: 'sep' },
            {
                label: 'Delete', icon: 'bi-trash', action: () => {
                    wm.messageBox('Confirm Value Delete', `Are you sure you want to delete the value "${key}"?`, {
                        buttons: 'yesno', icon: 'bi-exclamation-triangle-fill', modal: true,
                        onYes: () => {
                            registry.delete(_selectedPath + '.' + key);
                            _selectedValueKeys = [];
                            renderValues();
                        }
                    });
                }, color: 'danger'
            },
            {
                label: 'Rename', icon: 'bi-pencil', action: () => {
                    inputDialog('Rename Value', 'Enter new name:', key, (newName) => {
                        if (!newName || newName === key) return;
                        const val = registry.get(_selectedPath + '.' + key);
                        registry.set(_selectedPath + '.' + newName, val);
                        registry.delete(_selectedPath + '.' + key);
                        _selectedValueKeys = [newName];
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
    pathBar.className = 'gos-regedit-toolbar';
    pathBar.style.padding = '2px 8px';

    const pathInput = document.createElement('input');
    pathInput.className = 'gos-regedit-path';
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
                _selectedValueKeys = [];
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
            _selectedValueKeys = [];
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
    body.className = 'gos-regedit-body';

    const treePanel = document.createElement('div');
    treePanel.className = 'gos-regedit-tree';

    const valuesPanel = document.createElement('div');
    valuesPanel.className = 'gos-regedit-values';

    body.append(treePanel, valuesPanel);

    // ── Status ────────────────────────────────────────────────────────────
    const statusBar = document.createElement('div');
    statusBar.className = 'gos-regedit-status';
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
        node.className = 'gos-regedit-node';

        const row = document.createElement('div');
        row.className = 'gos-regedit-node-row';
        row._regPath = path;
        if (_selectedPaths.has(path)) row.classList.add('selected');

        const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
        const isExpanded = _expandedPaths.has(path);

        // Check if this object has any child objects (sub-keys)
        const hasChildKeys = isObject && Object.values(value).some(v => v !== null && typeof v === 'object' && !Array.isArray(v));

        const arrow = document.createElement('span');
        arrow.className = 'gos-regedit-node-arrow' + (isExpanded ? ' expanded' : '');
        arrow.innerHTML = hasChildKeys ? '▶' : '';

        const icon = document.createElement('i');
        icon.className = 'gos-regedit-node-icon ' + (isObject ? 'bi-folder-fill' : 'bi-file-earmark-text');

        const label = document.createElement('span');
        label.className = 'gos-regedit-node-label';
        label.textContent = key;

        row.append(arrow, icon, label);
        node.appendChild(row);

        const childrenWrap = document.createElement('div');
        childrenWrap.className = 'gos-regedit-children';
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
            if (e.ctrlKey || e.metaKey) {
                if (_selectedPaths.has(path)) _selectedPaths.delete(path);
                else _selectedPaths.add(path);
            } else {
                _selectedPaths.clear();
                _selectedPaths.add(path);
                _selectedPath = path;
            }

            treePanel.querySelectorAll('.gos-regedit-node-row').forEach(r => {
                r.classList.toggle('selected', _selectedPaths.has(r._regPath));
            });

            _selectedValueKeys = [];
            updatePathDisplay();

            if (isObject && !e.ctrlKey && !e.metaKey) {
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
        rootNode.className = 'gos-regedit-node';

        const rootRow = document.createElement('div');
        rootRow.className = 'gos-regedit-node-row';
        rootRow._regPath = '__root_node'; // unique identifier for internal use
        if (_selectedPaths.has('')) rootRow.classList.add('selected');

        const rootExpanded = _expandedPaths.has('__root');
        const rootArrow = document.createElement('span');
        rootArrow.className = 'gos-regedit-node-arrow' + (rootExpanded ? ' expanded' : '');
        rootArrow.innerHTML = '▶';

        const rootIcon = document.createElement('i');
        rootIcon.className = 'gos-regedit-node-icon bi-pc-display';

        const rootLabel = document.createElement('span');
        rootLabel.className = 'gos-regedit-node-label';
        rootLabel.textContent = 'Computer';
        rootLabel.style.fontWeight = '600';

        rootRow.append(rootArrow, rootIcon, rootLabel);
        rootNode.appendChild(rootRow);

        const rootChildren = document.createElement('div');
        rootChildren.className = 'gos-regedit-children';
        rootChildren.style.display = rootExpanded ? 'block' : 'none';

        Object.keys(data).forEach(key => {
            rootChildren.appendChild(buildTreeNode(key, data[key], key, 0));
        });

        rootNode.appendChild(rootChildren);

        rootRow.onclick = (e) => {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
                if (_selectedPaths.has('')) _selectedPaths.delete('');
                else _selectedPaths.add('');
            } else {
                _selectedPaths.clear();
                _selectedPaths.add('');
                _selectedPath = '';
            }

            treePanel.querySelectorAll('.gos-regedit-node-row').forEach(r => {
                r.classList.toggle('selected', _selectedPaths.has(r._regPath === '__root_node' ? '' : r._regPath));
            });

            _selectedValueKeys = [];
            updatePathDisplay();

            if (!e.ctrlKey && !e.metaKey) {
                if (_expandedPaths.has('__root')) _expandedPaths.delete('__root');
                else _expandedPaths.add('__root');
                rootChildren.style.display = _expandedPaths.has('__root') ? 'block' : 'none';
                rootArrow.classList.toggle('expanded', _expandedPaths.has('__root'));
            }

            renderValues();
        };

        rootRow.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            _selectedPath = '';
            _selectedValueKeys = [];
            updatePathDisplay();
            treePanel.querySelectorAll('.gos-regedit-node-row').forEach(r => r.classList.remove('selected'));
            rootRow.classList.add('selected');
            rootRow.classList.add('selected');
            gosShowContextMenu(e.clientX, e.clientY, [
                {
                    label: 'New', icon: 'bi-plus-lg', hasSubmenu: true,
                    onMouseEnter: (ev, el) => {
                        const rect = el.getBoundingClientRect();
                        gosShowContextMenu(rect.right, rect.top, [
                            { label: 'Key', icon: 'bi-folder-plus', action: doAddKey }
                        ], true);
                    }
                },
                { type: 'sep' },
                { label: 'Refresh', icon: 'bi-arrow-clockwise', action: rebuildTree }
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
    let _valuesTbl = null;
    function renderValues() {
        valuesPanel.innerHTML = '';
        _selectedValueKeys = [];

        if (_selectedPath === '') {
            valuesPanel.innerHTML = '<div style="color:#666;padding:10px;font-size:0.85rem;">Select a key to view its values.</div>';
            return;
        }

        const node = registry.get(_selectedPath);
        if (node === undefined) {
            valuesPanel.innerHTML = '<div style="color:#666;padding:10px;font-size:0.85rem;">Key not found.</div>';
            return;
        }

        const rows = [];
        if (typeof node === 'object' && node !== null) {
            Object.entries(node).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) return;
                rows.push({
                    name: key,
                    type: getRegType(value),
                    data: truncateValue(value),
                    raw: value
                });
            });
        } else {
            rows.push({
                name: '(Default)',
                type: getRegType(node),
                data: truncateValue(node),
                raw: node
            });
        }

        if (rows.length === 0) {
            valuesPanel.innerHTML = '<div style="color:#666;padding:10px;font-size:0.85rem;">(No values)</div>';
            return;
        }

        _valuesTbl = Widgets.createTable({
            columns: [
                { id: 'name', label: 'Name', width: '35%', render: (v) => `<i class="bi-file-earmark-text" style="color:#5bc0de;margin-right:6px;"></i>${escapeHtml(v)}` },
                { id: 'type', label: 'Type', width: '20%' },
                { id: 'data', label: 'Data', width: '45%' }
            ],
            data: rows,
            keyField: 'name',
            onSelectionChange: (ids) => {
                _selectedValueKeys = ids;
            },
            onAction: (key, row) => {
                editValueDialog('Edit Value', key, row.raw, true, (name, finalData) => {
                    registry.set(_selectedPath + '.' + key, finalData);
                    renderValues();
                });
            }
        });

        // Context menu support for the table rows
        _valuesTbl.element.addEventListener('contextmenu', (e) => {
            const tr = e.target.closest('tr');
            if (!tr) return;
            const rowIndex = Array.from(tr.parentElement.children).indexOf(tr);
            const row = rows[rowIndex];
            if (row) {
                if (!_selectedValueKeys.includes(row.name)) {
                    _valuesTbl.setSelectedIds([row.name]);
                    _selectedValueKeys = [row.name];
                }
                showValueContextMenu(e, row.name, row.raw);
            }
        });

        _valuesTbl.element.style.height = '100%';
        valuesPanel.appendChild(_valuesTbl.element);
    }

    function getRegType(val) {
        if (val === null) return 'REG_NONE';
        if (Array.isArray(val)) return 'REG_MULTI_SZ';
        if (typeof val === 'boolean') return 'REG_DWORD';
        if (typeof val === 'number') return 'REG_DWORD';
        if (typeof val === 'string') {
            if (val.startsWith('data:')) return 'REG_BINARY';
            return 'REG_SZ';
        }
        return 'REG_UNKNOWN';
    }

    function truncateValue(val) {
        let s = '';
        if (Array.isArray(val)) {
            s = '[' + val.join(', ') + ']';
        } else {
            s = String(val);
        }
        if (s.length > 80) return s.substring(0, 77) + '...';
        return s;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Keyboard Support ─────────────────────────────────────────────────
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Delete') {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                doDeleteSelected();
            }
        }
    });

    const win = wm.createWindow('Registry Editor', container, {
        icon: 'bi-database-fill-gear',
        width: 720,
        height: 440,
        onClose: () => {
            if (_ctxMenu) _ctxMenu.remove();
        }
    });

    container.tabIndex = 0;
    container.style.outline = 'none';

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
