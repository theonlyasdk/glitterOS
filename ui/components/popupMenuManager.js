/**
 * Popup Menu Manager - Standardized menu system for glitterOS
 */
const PopupMenuManager = (() => {
    let _activeMenus = [];
    let _outerClickListener = null;
    let _activeSubmenu = null;

    function _closeAll() {
        _activeMenus.forEach(m => {
            m.classList.add('fade-out');
            setTimeout(() => m.remove(), 200);
        });
        _activeMenus = [];
        _activeSubmenu = null;
        if (_outerClickListener) {
            window.removeEventListener('mousedown', _outerClickListener, true);
            _outerClickListener = null;
        }
    }

    function _closeSubmenus() {
        if (_activeSubmenu) {
            const m = _activeSubmenu;
            m.classList.add('fade-out');
            setTimeout(() => m.remove(), 200);
            _activeMenus = _activeMenus.filter(x => x !== m);
            _activeSubmenu = null;
        }
    }

    function create(x, y, items, isSubmenu = false) {
        if (typeof glidBus !== 'undefined') glidBus.publish('menu:registered', { type: 'context', x, y, items, isSubmenu });
        
        if (!isSubmenu) {
            _closeAll();
        } else {
            _closeSubmenus();
        }

        const menu = document.createElement('div');
        menu.className = 'gos-context-menu' + (isSubmenu ? ' gos-context-submenu' : '');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        if (isSubmenu) {
            _activeSubmenu = menu;
        }

        items.forEach(item => {
            if (item.type === 'sep') {
                const sep = document.createElement('div');
                sep.className = 'gos-context-menu-sep';
                menu.appendChild(sep);
                return;
            }

            const el = document.createElement('div');
            el.className = 'gos-context-menu-item' + (item.color === 'danger' ? ' danger' : '') + (item.disabled ? ' disabled' : '');

            const iconStr = item.icon ? `<i class="${item.icon.startsWith('bi-') || item.icon.startsWith('ri-') ? item.icon : 'bi-' + item.icon}"></i>` : '';
            const shortcutStr = item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : '';
            el.innerHTML = `${iconStr} <span style="flex:1">${item.label}</span> ${shortcutStr}`;

            if (item.hasSubmenu) {
                el.innerHTML += `<i class="bi bi-chevron-right ms-2" style="font-size:0.7rem; opacity:0.5;"></i>`;
            }

            el.onclick = (e) => {
                e.stopPropagation();
                if (item.disabled) return;
                
                if (!item.hasSubmenu) {
                    menu.classList.add('item-clicked');
                    el.classList.add('gos-dropdown-item-ghost');
                    
                    // Fast track _closeAll without the fade-out animation on this specific menu
                    _activeMenus = _activeMenus.filter(m => m !== menu);
                    if (_activeSubmenu === menu) _activeSubmenu = null;
                    _closeAll(); // Close any other menus (like parents) normally
                    
                    setTimeout(() => {
                        menu.classList.remove('item-clicked');
                        el.classList.remove('gos-dropdown-item-ghost');
                        menu.remove();
                        if (item.action) item.action();
                    }, 300);
                }
            };

            el.onmouseenter = (e) => {
                if (item.hasSubmenu && item.onMouseEnter) {
                    item.onMouseEnter(e, el);
                } else if (!isSubmenu) {
                    _closeSubmenus();
                }
            };

            menu.appendChild(el);
        });

        document.body.appendChild(menu);
        _activeMenus.push(menu);

        // Keep on screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

        if (!isSubmenu && !_outerClickListener) {
            _outerClickListener = (e) => {
                const clickedInside = _activeMenus.some(m => m.contains(e.target));
                if (!clickedInside) {
                    _closeAll();
                }
            };
            setTimeout(() => window.addEventListener('mousedown', _outerClickListener, true), 10);
        }

        return menu;
    }

    return {
        show: create,
        closeAll: _closeAll,
        closeSubmenus: _closeSubmenus,
        /**
         * Specialized File Context Menu
         */
        showFileMenu(x, y, selectedItems, cwd, callbacks) {
            const items = [];
            if (selectedItems.length > 0) {
                items.push({
                    label: selectedItems.length > 1 ? `Open (${selectedItems.length})` : 'Open',
                    icon: selectedItems.length === 1 && selectedItems[0].type === 'dir' ? 'bi-folder2-open' : 'bi-eye',
                    action: () => callbacks.onOpen(selectedItems)
                });

                if (selectedItems.length === 1 && selectedItems[0].type === 'file') {
                    const name = selectedItems[0].name;
                    const ext = name.split('.').pop();
                    const apps = typeof AppRegistry !== 'undefined' ? AppRegistry.getAppsForExt(ext) : [];

                    items.push({
                        label: 'Open with',
                        icon: 'bi-box-arrow-up-right',
                        hasSubmenu: apps.length > 0,
                        onMouseEnter: (e, el) => {
                            if (apps.length === 0) return;
                            const rect = el.getBoundingClientRect();
                            const subItems = apps.map(app => ({
                                label: app.name,
                                icon: app.icon,
                                action: () => app.launch((cwd.endsWith('\\') ? cwd : cwd + '\\') + name)
                            }));
                            subItems.push({ type: 'sep' });
                            subItems.push({
                                label: 'Choose another app...',
                                action: () => typeof showOpenWithDialog === 'function' ? showOpenWithDialog((cwd.endsWith('\\') ? cwd : cwd + '\\') + name) : wm.messageBox('Open With', 'Feature not available.')
                            });
                            this.show(rect.right, rect.top, subItems, true);
                        },
                        action: () => {
                            if (typeof showOpenWithDialog === 'function') {
                                showOpenWithDialog((cwd.endsWith('\\') ? cwd : cwd + '\\') + name);
                            }
                        }
                    });
                }

                if (selectedItems.length === 1 && callbacks.onRename) {
                    items.push({ label: 'Rename', icon: 'bi-pencil', action: () => callbacks.onRename(selectedItems[0]) });
                }

                if (callbacks.onDelete) {
                    items.push({
                        label: 'Delete',
                        icon: 'bi-trash',
                        color: 'danger',
                        action: () => callbacks.onDelete(selectedItems)
                    });
                }

                if (selectedItems.length === 1 && callbacks.onProperties) {
                    items.push({ type: 'sep' });
                    items.push({
                        label: 'Properties',
                        icon: 'bi-info-circle',
                        action: () => callbacks.onProperties(selectedItems[0])
                    });
                }
            } else {
                items.push({
                    label: 'New', icon: 'bi-plus-circle', hasSubmenu: true,
                    onMouseEnter: (e, el) => {
                        const rect = el.getBoundingClientRect();
                        this.show(rect.right, rect.top, [
                            { label: 'Folder', icon: 'bi-folder-plus', action: () => callbacks.onNewFolder && callbacks.onNewFolder() },
                            { label: 'Text Document', icon: 'bi-file-earmark-plus', action: () => callbacks.onNewFile && callbacks.onNewFile() }
                        ], true);
                    },
                    action: () => { }
                });
                items.push({ type: 'sep' });
                items.push({ label: 'Refresh', icon: 'bi-arrow-clockwise', action: () => callbacks.onRefresh && callbacks.onRefresh() });

                if (callbacks.onProperties) {
                    items.push({ type: 'sep' });
                    items.push({ label: 'Properties', icon: 'bi-info-circle', action: () => callbacks.onProperties({ name: cwd, type: 'dir', isCwd: true }) });
                }
            }
            this.show(x, y, items);
        }
    };
})();

window.PopupMenuManager = PopupMenuManager;
// Compatibility aliases
window.gosShowContextMenu = PopupMenuManager.show.bind(PopupMenuManager);
window.gosShowFileContextMenu = PopupMenuManager.showFileMenu.bind(PopupMenuManager);
