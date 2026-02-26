/**
 * glitterOS UI Widget Library (Qt style approach)
 * Centralizes UI components for consistent theme and behavior across apps.
 */
const Widgets = (() => {

    /**
     * Tilt / Ripple Utilities (Shared across the OS widgets)
     */
    function applyTiltPress(elem, e) {
        const rect = elem.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;
        const rotY = (relX - 0.5) * 30;
        const rotX = -(relY - 0.5) * 30;
        elem.style.transform = `perspective(500px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.93)`;
    }

    function resetTilt(elem) { elem.style.transform = ''; }

    function spawnRipple(elem, e) {
        const rect = elem.getBoundingClientRect();
        const ripple = document.createElement('div');
        ripple.className = 'gos-ac-tile-ripple';
        ripple.style.left = (e.clientX - rect.left) + 'px';
        ripple.style.top = (e.clientY - rect.top) + 'px';
        elem.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }

    /**
     * registerTileEffect - Global registration helper for Win10-style tile interactions
     * @param {HTMLElement} elem 
     * @param {Object} options { tilt: bool, ripple: bool, glow: bool, liveTilt: bool }
     */
    function registerTileEffect(elem, options = { tilt: true, ripple: true, glow: true, liveTilt: true }) {
        let _pressing = false;

        const onStart = (e, clientX, clientY) => {
            _pressing = true;
            if (options.tilt) applyTiltPress(elem, { clientX, clientY });
            if (options.ripple) spawnRipple(elem, { clientX, clientY });
        };

        const onEnd = () => {
            _pressing = false;
            if (options.tilt) resetTilt(elem);
        };

        const onMove = (clientX, clientY) => {
            if (options.glow) {
                const r = elem.getBoundingClientRect();
                elem.style.setProperty('--glow-x', (clientX - r.left) + 'px');
                elem.style.setProperty('--glow-y', (clientY - r.top) + 'px');
            }
            if (_pressing && options.liveTilt) {
                applyTiltPress(elem, { clientX, clientY });
            }
        };

        elem.addEventListener('mousedown', (e) => onStart(e, e.clientX, e.clientY));
        elem.addEventListener('touchstart', (e) => onStart(e, e.touches[0].clientX, e.touches[0].clientY), { passive: true });

        elem.addEventListener('mouseup', onEnd);
        elem.addEventListener('touchend', onEnd);

        elem.addEventListener('mouseleave', onEnd);

        elem.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
        elem.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

        // Ensure element has necessary CSS for these effects
        if (options.ripple || options.glow) {
            if (getComputedStyle(elem).position === 'static') elem.style.position = 'relative';
            elem.style.overflow = 'hidden';
        }
    }

    return {
        registerTileEffect,

        createGroup(label, content) {
            const group = document.createElement('div');
            group.className = 'gos-w32-group';
            group.innerHTML = `<div class="gos-w32-group-label">${label}</div>`;
            group.appendChild(content);
            return group;
        },

        createButton(text, onClick) {
            const btn = document.createElement('button');
            btn.className = 'gos-w32-btn';
            btn.textContent = text;
            if (onClick) btn.onclick = onClick;
            return btn;
        },

        createCheckbox(label, checked, onChange) {
            const row = document.createElement('div');
            row.className = 'gos-w32-check-row';
            const check = document.createElement('div');
            check.className = 'gos-w32-check' + (checked ? ' checked' : '');
            const txt = document.createElement('span');
            txt.textContent = label;
            row.append(check, txt);

            row.onclick = () => {
                const isChecked = check.classList.toggle('checked');
                if (onChange) onChange(isChecked);
            };
            return row;
        },

        createUWPCheckbox(label, checked, onChange) {
            const row = document.createElement('div');
            row.className = 'gos-uwp-check-row';

            const check = document.createElement('div');
            check.className = 'gos-uwp-check' + (checked ? ' checked' : '');

            const checkMark = document.createElement('div');
            checkMark.className = 'gos-uwp-check-mark';
            checkMark.innerHTML = '<i class="bi bi-check"></i>';
            check.appendChild(checkMark);

            const txt = document.createElement('span');
            txt.textContent = label;
            row.append(check, txt);

            // Register Tile Effect for the whole row
            this.registerTileEffect(row, { tilt: true, ripple: true, glow: true, liveTilt: true });

            row.onclick = () => {
                const isChecked = !check.classList.contains('checked');
                check.classList.toggle('checked', isChecked);
                if (onChange) onChange(isChecked);
            };
            return row;
        },

        createRadioGroup(options, selectedIndex, onChange) {
            const container = document.createElement('div');
            container.className = 'd-flex gap-3';

            options.forEach((txt, i) => {
                const rRow = document.createElement('div');
                rRow.className = 'gos-w32-check-row';
                const radio = document.createElement('div');
                radio.className = 'gos-w32-radio' + (i === selectedIndex ? ' checked' : '');
                rRow.append(radio, document.createTextNode(txt));

                rRow.onclick = () => {
                    container.querySelectorAll('.gos-w32-radio').forEach(r => r.classList.remove('checked'));
                    radio.classList.add('checked');
                    if (onChange) onChange(txt, i);
                };
                container.appendChild(rRow);
            });
            return container;
        },

        createProgress(percent, labelText) {
            const container = document.createElement('div');
            const pBar = document.createElement('div');
            pBar.className = 'gos-w32-progress';
            const pFill = document.createElement('div');
            pFill.className = 'gos-w32-progress-fill';
            pFill.style.width = percent + '%';
            pBar.appendChild(pFill);
            container.appendChild(pBar);

            if (labelText) {
                const lbl = document.createElement('div');
                lbl.style.fontSize = '0.75rem';
                lbl.style.marginTop = '4px';
                lbl.style.color = '#888';
                lbl.textContent = labelText;
                lbl.className = 'gos-w32-progress-label';
                container.appendChild(lbl);
            }

            // Allow programmatic update
            container.setProgress = (newPercent, newLabel) => {
                pFill.style.width = newPercent + '%';
                if (newLabel && container.querySelector('.gos-w32-progress-label')) {
                    container.querySelector('.gos-w32-progress-label').textContent = newLabel;
                }
            };

            return container;
        },

        createList(items, selectedIndex, onChange) {
            const listBox = document.createElement('div');
            listBox.className = 'gos-w32-list';

            items.forEach((itemText, i) => {
                const item = document.createElement('div');
                item.className = 'gos-w32-list-item' + (i === selectedIndex ? ' selected' : '');
                item.textContent = itemText;
                item.onclick = () => {
                    listBox.querySelectorAll('.gos-w32-list-item').forEach(li => li.classList.remove('selected'));
                    item.classList.add('selected');
                    if (onChange) onChange(itemText, i);
                };
                listBox.appendChild(item);
            });
            return listBox;
        },

        createInput(label, value, placeholder) {
            const box = document.createElement('div');
            box.style.marginTop = '12px';
            if (label) {
                const lbl = document.createElement('div');
                lbl.style.fontSize = '0.8rem';
                lbl.style.marginBottom = '2px';
                lbl.textContent = label;
                box.appendChild(lbl);
            }
            const input = document.createElement('input');
            input.className = 'gos-w32-input';
            if (value) input.value = value;
            if (placeholder) input.placeholder = placeholder;
            box.appendChild(input);
            box.inputElement = input; // access to the actual input
            return box;
        },

        createSlider(label, min, max, val, unit, onChange) {
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '4px';

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.fontSize = '0.8rem';

            const lbl = document.createElement('span');
            lbl.textContent = label;
            const valDisplay = document.createElement('span');
            valDisplay.style.color = 'var(--accent-color)';
            valDisplay.textContent = val + (unit || '');

            header.append(lbl, valDisplay);

            const input = document.createElement('input');
            input.type = 'range';
            input.min = min;
            input.max = max;
            input.value = val;
            input.className = 'gos-w32-slider'; // assuming css exists or using default
            input.style.width = '100%';

            input.oninput = () => {
                valDisplay.textContent = input.value + (unit || '');
                if (onChange) onChange(input.value);
            };

            container.append(header, input);
            return container;
        },

        createTable({ columns, data, keyField = 'id', onSelectionChange, onAction }) {
            const container = document.createElement('div');
            container.className = 'gos-w32-table-container';

            const table = document.createElement('table');
            table.className = 'gos-w32-table';
            container.appendChild(table);

            let sortCol = null;
            let sortDesc = false;
            let selectedIds = [];
            let lastClickedIndex = -1;
            let currentData = [...data];

            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');
            table.append(thead, tbody);

            function renderHeader() {
                thead.innerHTML = '';
                const tr = document.createElement('tr');
                columns.forEach(col => {
                    const th = document.createElement('th');
                    th.textContent = col.label;
                    if (col.width) th.style.width = col.width;

                    if (col.sortable !== false) {
                        th.style.cursor = 'pointer';
                        if (sortCol === col.id) {
                            th.innerHTML += `<span class="sort-icon">${sortDesc ? '▼' : '▲'}</span>`;
                        }
                        th.onclick = () => {
                            if (sortCol === col.id) {
                                sortDesc = !sortDesc;
                            } else {
                                sortCol = col.id;
                                sortDesc = false;
                            }
                            applySort();
                            renderBody();
                        };
                    }
                    tr.appendChild(th);
                });
                thead.appendChild(tr);
            }

            function applySort() {
                if (!sortCol) return;
                const colDef = columns.find(c => c.id === sortCol);
                currentData.sort((a, b) => {
                    let valA = a[sortCol];
                    let valB = b[sortCol];
                    if (colDef && colDef.sortValue) {
                        valA = colDef.sortValue(a);
                        valB = colDef.sortValue(b);
                    }
                    if (valA < valB) return sortDesc ? 1 : -1;
                    if (valA > valB) return sortDesc ? -1 : 1;
                    return 0;
                });
            }

            // Click handling with delay for double click distinction
            let clickTimer = null;
            let preventSingle = false;

            function renderBody() {
                tbody.innerHTML = '';
                currentData.forEach((row, index) => {
                    const tr = document.createElement('tr');
                    const rowKey = row[keyField];
                    tr.dataset.id = rowKey;

                    if (selectedIds.includes(rowKey)) {
                        tr.classList.add('selected');
                    }

                    columns.forEach(col => {
                        const td = document.createElement('td');
                        if (col.render) {
                            td.innerHTML = col.render(row[col.id], row);
                        } else {
                            td.textContent = row[col.id] !== undefined ? row[col.id] : '';
                        }
                        tr.appendChild(td);
                    });

                    // Multi-select logic and double click handling
                    tr.onclick = (e) => {
                        if (e.ctrlKey || e.metaKey) {
                            if (selectedIds.includes(rowKey)) {
                                selectedIds = selectedIds.filter(id => id !== rowKey);
                            } else {
                                selectedIds.push(rowKey);
                            }
                        } else if (e.shiftKey && lastClickedIndex !== -1) {
                            const start = Math.min(lastClickedIndex, index);
                            const end = Math.max(lastClickedIndex, index);
                            selectedIds = currentData.slice(start, end + 1).map(r => r[keyField]);
                        } else {
                            selectedIds = [rowKey];
                        }
                        lastClickedIndex = index;

                        // Visual update only
                        Array.from(tbody.children).forEach((childTr, i) => {
                            const rKey = currentData[i][keyField];
                            childTr.classList.toggle('selected', selectedIds.includes(rKey));
                        });

                        if (onSelectionChange) onSelectionChange([...selectedIds]);
                    };

                    tr.ondblclick = (e) => {
                        if (onAction) onAction(rowKey, row);
                    };

                    tbody.appendChild(tr);
                });
                renderHeader();
            }

            applySort();
            renderBody();

            // Return controller for updates
            return {
                element: container,
                updateData: (newData) => {
                    currentData = [...newData];
                    // Keep valid selections
                    const validKeys = currentData.map(r => r[keyField]);
                    selectedIds = selectedIds.filter(id => validKeys.includes(id));

                    applySort();
                    renderBody();
                    if (onSelectionChange) onSelectionChange([...selectedIds]);
                },
                getSelectedIds: () => [...selectedIds],
                setSelectedIds: (newIds) => {
                    selectedIds = [...newIds];
                    Array.from(tbody.children).forEach((childTr, i) => {
                        const rKey = currentData[i][keyField];
                        childTr.classList.toggle('selected', selectedIds.includes(rKey));
                    });
                },
                clearSelection: () => {
                    selectedIds = [];
                    lastClickedIndex = -1;
                    renderBody();
                    if (onSelectionChange) onSelectionChange([]);
                }
            };
        }
    };
})();

// For backward compatibility until refactored

