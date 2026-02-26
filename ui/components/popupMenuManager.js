/**
 * Popup Menu Manager - Standardized menu system for glitterOS
 */
const PopupMenuManager = (() => {
    let _activeMenus = [];

    function _closeAll() {
        _activeMenus.forEach(m => {
            m.classList.add('fade-out');
            setTimeout(() => m.remove(), 200);
        });
        _activeMenus = [];
    }

    function create(x, y, items, isSubmenu = false) {
        if (typeof glidBus !== 'undefined') glidBus.publish('menu:registered', { type: 'context', x, y, items, isSubmenu });
        if (!isSubmenu) _closeAll();

        const menu = document.createElement('div');
        menu.className = 'gos-context-menu' + (isSubmenu ? ' gos-context-submenu' : '');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

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
                if (item.disabled) return;
                if (!item.hasSubmenu) {
                    item.action && item.action();
                    _closeAll();
                }
            };

            if (item.onMouseEnter) {
                el.onmouseenter = (e) => item.onMouseEnter(e, el);
            }

            menu.appendChild(el);
        });

        document.body.appendChild(menu);
        _activeMenus.push(menu);

        // Keep on screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

        if (!isSubmenu) {
            const onOuterClick = (e) => {
                if (!menu.contains(e.target)) {
                    _closeAll();
                    window.removeEventListener('mousedown', onOuterClick, true);
                }
            };
            setTimeout(() => window.addEventListener('mousedown', onOuterClick, true), 10);
        }

        return menu;
    }

    return {
        show: create,
        closeAll: _closeAll,
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
