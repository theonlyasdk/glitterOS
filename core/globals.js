// ── Shared DOM references ────────────────────────────────────────────────────
const menubar = fromId("menubar");
const desktop = fromId("desktop");
const taskbar = fromId("taskbar");

const desktopNameLbl = fromId("desktop-name");

// ── Desktop / virtual desktop state ─────────────────────────────────────────
const currentDesktopIdx = 0;
const desktops = [{ name: "Desktop" }];

/**
 * Application Registry — single source of truth for installed applications.
 * Each app self-registers via AppRegistry.register() at the end of its file.
 */
const AppRegistry = (() => {
    const _apps = [];

    return {
        /**
         * Register an application.
         * @param {object} app { id, name, icon, launch, desktopShortcut? }
         */
        register(app) {
            if (!app.id || !app.name || !app.launch) {
                console.warn('AppRegistry: invalid registration', app);
                return;
            }
            _apps.push(app);

            // If it has an exe name, ensure it exists in System
            if (app.exe && typeof fs !== 'undefined') {
                const path = `C:\\glitterOS\\System\\${app.exe}`;
                if (!fs.exists(path)) {
                    fs.write(path, '[glitterOS System Executable]');
                }
                fs.setattr(path, 'appId', app.id);
            }
        },
        /** Unregister an application by id */
        unregister(id) {
            const idx = _apps.findIndex(a => a.id === id);
            if (idx !== -1) _apps.splice(idx, 1);
        },
        /** Get all registered apps */
        getAll() { return [..._apps]; },
        /** Get app by id */
        get(id) { return _apps.find(a => a.id === id); },
        /** Get all apps that want a desktop shortcut */
        getDesktopApps() { return _apps.filter(a => a.desktopShortcut); }
    };
})();

/**
 * System Shortcuts Map
 * Used for global keyboard listeners and help documentation.
 */
const SYSTEM_SHORTCUTS = new Map([
    ['alt+s', { description: 'Toggle App Search', action: () => typeof toggleSearch === 'function' && toggleSearch() }],
    ['alt+f4', { description: 'Close Active Window', action: () => wm && wm.activeWindow && wm.closeWindow(wm.activeWindow.id) }],
    ['escape', {
        description: 'Close all overlays', action: () => {
            if (typeof closeSearch === 'function') closeSearch();
            if (typeof closeActionCentre === 'function') closeActionCentre();
        }
    }]
]);

function assertExistsElseReload(elem) {
    if (!elem) {
        window.alert(elem + " does not exist! Reloading in 5s...");
        setTimeout(() => location.reload(), 5000);
    }
}

/**
 * Creates a reusable app menu bar with hover-switch behavior.
 * Returns { bar: HTMLElement, createMenu(label, items): HTMLElement }
 * Item format: { label, shortcut?, action, color?, disabled? } or { type: 'sep' }
 */
function buildAppMenuBar() {
    const bar = document.createElement('div');
    bar.className = 'gos-app-menubar';

    const menuElements = [];
    const menuItemsData = [];
    let _activeMenuIdx = -1;
    let _activeItemIdx = -1;

    function closeAll() {
        bar.querySelectorAll('.gos-app-menu-item').forEach(m => {
            m.classList.remove('active');
            m.classList.remove('kb-focus');
        });
        bar.querySelectorAll('.gos-app-dropdown-item').forEach(m => m.classList.remove('kb-focus'));
        _activeMenuIdx = -1;
        _activeItemIdx = -1;
    }

    function highlight() {
        menuElements.forEach((m, i) => {
            m.classList.toggle('kb-focus', i === _activeMenuIdx);
            const isOpen = m.classList.contains('active');
            if (i === _activeMenuIdx && !isOpen && _activeItemIdx !== -1) {
                m.classList.add('active');
            }
            if (i !== _activeMenuIdx) {
                m.classList.remove('active');
            }
        });

        if (_activeMenuIdx !== -1) {
            const items = menuItemsData[_activeMenuIdx];
            items.forEach((item, i) => {
                if (item.el) item.el.classList.toggle('kb-focus', i === _activeItemIdx);
            });
        }
    }

    function createMenu(label, items) {
        const menu = document.createElement('div');
        menu.className = 'gos-app-menu-item';
        menu.textContent = label;

        const dropdown = document.createElement('div');
        dropdown.className = 'gos-app-dropdown';

        const myItems = [];

        items.forEach(item => {
            if (item.type === 'sep') {
                const sep = document.createElement('div');
                sep.className = 'gos-app-dropdown-sep';
                dropdown.appendChild(sep);
                myItems.push({ type: 'sep' });
            } else {
                const el = document.createElement('div');
                el.className = 'gos-app-dropdown-item' + (item.color === '#f44336' ? ' danger' : '') + (item.disabled ? ' disabled' : '');
                el.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;

                const itemAction = () => {
                    if (item.disabled) return;
                    if (item.action) item.action();
                    el.classList.add('gos-dropdown-item-ghost');
                    menu.classList.add('item-clicked');
                    setTimeout(() => {
                        closeAll();
                        menu.classList.remove('item-clicked');
                        el.classList.remove('gos-dropdown-item-ghost');
                    }, 300);
                };

                el.onclick = (e) => { e.stopPropagation(); itemAction(); };
                dropdown.appendChild(el);
                myItems.push({ label: item.label, action: itemAction, el: el, type: 'item', disabled: !!item.disabled });
            }
        });

        menu.appendChild(dropdown);

        menu.onclick = (e) => {
            e.stopPropagation();
            const wasActive = menu.classList.contains('active');
            const idx = menuElements.indexOf(menu);
            closeAll();
            if (!wasActive) {
                menu.classList.add('active');
                _activeMenuIdx = idx;
            }
        };

        menu.onmouseenter = () => {
            const anyActive = bar.querySelector('.gos-app-menu-item.active');
            if (anyActive && anyActive !== menu) {
                const idx = menuElements.indexOf(menu);
                closeAll();
                menu.classList.add('active');
                _activeMenuIdx = idx;
            }
        };

        bar.appendChild(menu);
        menuElements.push(menu);
        menuItemsData.push(myItems);
        return menu;
    }

    bar.handleKey = (e) => {
        if (e.key === 'Alt') {
            e.preventDefault();
            if (_activeMenuIdx === -1) {
                _activeMenuIdx = 0;
                highlight();
            } else {
                closeAll();
            }
            return true;
        }

        if (_activeMenuIdx === -1) return false;

        if (e.key === 'Escape') {
            closeAll();
            return true;
        }

        if (e.key === 'ArrowRight') {
            _activeMenuIdx = (_activeMenuIdx + 1) % menuElements.length;
            _activeItemIdx = -1;
            highlight();
            return true;
        }
        if (e.key === 'ArrowLeft') {
            _activeMenuIdx = (_activeMenuIdx - 1 + menuElements.length) % menuElements.length;
            _activeItemIdx = -1;
            highlight();
            return true;
        }

        const items = menuItemsData[_activeMenuIdx];
        if (e.key === 'ArrowDown') {
            let nextIndex = _activeItemIdx;
            for (let i = 0; i < items.length; i++) {
                nextIndex = (nextIndex + 1) % items.length;
                if (items[nextIndex].type === 'item' && !items[nextIndex].disabled) {
                    _activeItemIdx = nextIndex;
                    break;
                }
            }
            highlight();
            return true;
        }
        if (e.key === 'ArrowUp') {
            let prevIndex = _activeItemIdx === -1 ? items.length : _activeItemIdx;
            for (let i = 0; i < items.length; i++) {
                prevIndex = (prevIndex - 1 + items.length) % items.length;
                if (items[prevIndex].type === 'item' && !items[prevIndex].disabled) {
                    _activeItemIdx = prevIndex;
                    break;
                }
            }
            highlight();
            return true;
        }
        if (e.key === 'Enter') {
            if (_activeItemIdx !== -1) {
                items[_activeItemIdx].action();
            } else {
                _activeItemIdx = 0;
                if (items[0] && items[0].type !== 'item') {
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type === 'item') { _activeItemIdx = i; break; }
                    }
                }
                highlight();
            }
            return true;
        }
        return true;
    };

    const onMouseDown = (e) => {
        if (!bar.contains(e.target)) closeAll();
    };
    window.addEventListener('mousedown', onMouseDown);

    bar._cleanup = () => window.removeEventListener('mousedown', onMouseDown);
    bar.createMenu = createMenu;

    return bar;
}

/**
 * Shared Context Menu Helper
 * @param {number} x Screen X
 * @param {number} y Screen Y
 * @param {Array} items [{ label, icon?, action, color?, disabled?, type? }]
 */
function gosShowContextMenu(x, y, items) {
    const existing = document.querySelector('.gos-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'gos-context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    items.forEach(item => {
        if (item.type === 'sep') {
            const sep = document.createElement('div');
            sep.className = 'gos-context-menu-sep';
            menu.appendChild(sep);
        } else {
            const el = document.createElement('div');
            el.className = 'gos-context-menu-item' + (item.color === 'danger' ? ' danger' : '') + (item.disabled ? ' disabled' : '');
            el.innerHTML = `${item.icon ? `<i class="${getFullIcon(item.icon)}"></i>` : ''} <span>${item.label}</span>`;
            el.onclick = (e) => {
                e.stopPropagation();
                // Perform action instantly
                if (item.action) item.action();

                // Ghosting effect
                el.classList.add('gos-dropdown-item-ghost');
                menu.classList.add('item-clicked');

                setTimeout(() => {
                    menu.remove();
                }, 300);
            };
            menu.appendChild(el);
        }
    });

    document.body.appendChild(menu);

    // Reposition if out of bounds
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 5) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 5) + 'px';

    const onOuterClick = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            window.removeEventListener('mousedown', onOuterClick);
        }
    };
    setTimeout(() => window.addEventListener('mousedown', onOuterClick), 10);
}

/**
 * System Execution Logic
 */
const SystemExec = {
    /** Launch a file if it's an executable */
    run(path) {
        const stat = fs.stat(path);
        if (stat.error) return { error: stat.error };
        if (stat.type !== 'file') return { error: 'Not a valid executable.' };

        const nodeId = fs.getattr(path, 'appId');
        if (nodeId) {
            const app = AppRegistry.get(nodeId);
            if (app) {
                app.launch();
                return { ok: true };
            } else {
                wm.messageBox('glitterOS', `The system cannot find the application associated with this file.<br><br>App not installed: <b>${nodeId}</b>`, { icon: 'bi-x-circle-fill' });
                return { error: 'App not installed' };
            }
        }

        // Fallback for .txt or other known extensions
        if (path.endsWith('.txt')) {
            const notepad = AppRegistry.get('notepad');
            if (notepad) notepad.launch(path);
            return { ok: true };
        }

        return { error: 'No application associated with this file.' };
    }
};

// ── Misc utils ───────────────────────────────────────────────────────────────
function gosMbarItemClicked(item_index, sender) { alert(sender); }

function kaboom() {
    const kaboomCandidates = [menubar, desktop, taskbar];
    kaboomCandidates.forEach((elem) => {
        elem.classList.add("kaboom");
    });
    document.body.classList.add("kaboom-ticking");
    setTimeout(() => {
        document.body.classList.remove("kaboom-ticking");
        document.body.classList.add("kaboom");
        setTimeout(() => location.reload(), 3000);
    }, 5000);
}

function aboutGlitterOS(app_name) {
    const sub_text = app_name ? `<div class="mb-3 text-secondary" style="font-size: 0.85rem;">This product is licensed under the glitterOS License to:<br><b>${app_name} User</b></div>` : '';
    const msg = `
		<div class="gos-app-padded">
			<div class="d-flex flex-column align-items-center text-center">
				<i class="ri-sparkling-2-fill display-1 mb-3"></i>
				<h1 class="mb-0"><b>glitterOS</b></h1>
				<p class="text-secondary mb-4">Version 4.2.0.6969</p>
				<div class="text-start w-100 px-3">
					<p><b>glitterOS</b> is an experimental web-based desktop environment designed for speed and simplicity.</p>
					<p>Built with vanilla JS and Bootstrap, it brings a familiar multitasking experience to your browser.</p>
                    ${sub_text}
				</div>
				<hr class="w-100">
				<i class="mb-2">"It's like a balloon, but digital."</i>
				<small class="text-secondary">(c) glitterOS Corporation 2025-26. All rights reserved.</small>
			</div>
		</div>
	`;
    wm.createWindow("About glitterOS", msg, { width: 350, height: 480 });
}

/**
 * Truncate filename (macOS style: middle truncation)
 */
function truncateFilename(filename, maxLength = 24) {
    if (!filename || filename.length <= maxLength) return filename;

    const extIdx = filename.lastIndexOf('.');
    // If no extension or extension is too long (> 8 chars), standard middle truncation
    if (extIdx === -1 || (filename.length - extIdx) > 8 || extIdx === 0) {
        const front = Math.ceil((maxLength - 3) / 2);
        const back = Math.floor((maxLength - 3) / 2);
        return filename.substring(0, front) + '...' + filename.substring(filename.length - back);
    }

    const ext = filename.substring(extIdx);
    const namePart = filename.substring(0, extIdx);
    const remainingLength = maxLength - 3 - ext.length;

    // If extension takes up too much space, fallback to standard truncation
    if (remainingLength < 4) {
        const front = Math.ceil((maxLength - 3) / 2);
        const back = Math.floor((maxLength - 3) / 2);
        return filename.substring(0, front) + '...' + filename.substring(filename.length - back);
    }

    const front = Math.ceil(remainingLength / 2);
    const back = Math.floor(remainingLength / 2);
    return namePart.substring(0, front) + '...' + namePart.substring(namePart.length - back) + ext;
}

function systemSleep() {
    // Hang the desktop for 2-3s to make it feel "real"
    const hangDuration = 2000 + Math.random() * 1000;
    const start = Date.now();
    while (Date.now() - start < hangDuration) {
        // Intensive lame work to block the main thread
        for (let i = 0; i < 1000; i++) Math.sqrt(Math.random());
    }

    const bsod = document.createElement('div');
    bsod.style.cssText = `
        position: fixed;
        inset: 0;
        background: #0078d7;
        color: #fff;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 10%;
        font-family: 'Segoe UI', system-ui, sans-serif;
        cursor: none;
    `;
    bsod.innerHTML = `
        <div style="font-size: 15rem; line-height: 1; margin-bottom: 2rem;">: )</div>
        <div style="font-size: 2.2rem; line-height: 1.3; font-weight: 300; max-width: 800px;">
            Your desktop has gone to sleep. 
            We're just collecting some nap time info, and then we'll restart for you.
        </div>
        <div style="margin-top: 3rem; font-size: 1.2rem; opacity: 0.8;">
            0% complete
        </div>
        <div style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.6;">
            For more information about this issue and possible fixes, visit https://napping.glitteros.org/stopcode<br><br>
            If you call a support person, give them this info:<br>
            Stop code: DESKTOP_FELL_ASLEEP
        </div>
    `;
    document.body.appendChild(bsod);

    let progress = 0;
    const progressEl = bsod.querySelector('div:nth-child(3)');
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 5);
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
        progressEl.textContent = `${progress}% complete`;
    }, 200);
}

/**
 * Wallpaper System with Dissolve Effect
 */
let CURRENT_WALL_URL = '';
function setWallpaper(url) {
    if (url === CURRENT_WALL_URL) return;
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    CURRENT_WALL_URL = url;

    // Get current layers
    const layers = desktop.querySelectorAll('.gos-wallpaper-layer');
    const oldLayer = layers[layers.length - 1]; // Assume latest is current

    const newLayer = document.createElement('div');
    newLayer.className = 'gos-wallpaper-layer';
    newLayer.style.backgroundImage = `url("${url}")`;
    newLayer.style.opacity = '0';
    desktop.appendChild(newLayer);

    // Initial first set
    if (!oldLayer) {
        newLayer.style.opacity = '1';
        return;
    }

    // Trigger transition
    requestAnimationFrame(() => {
        newLayer.style.opacity = '1';
        oldLayer.style.transition = 'opacity 1s ease-in-out';
        oldLayer.style.opacity = '0';

        // Update registry
        registry.set('personalization.wallpaper', url);

        // Cleanup old layer
        setTimeout(() => {
            if (oldLayer.parentNode) oldLayer.remove();
        }, 1100);
    });
}

// Initial default wallpaper - call immediately so preload is utilized early
const wall = registry.get('personalization.wallpaper', 'res/wall.png');
// We don't set CURRENT_WALL_URL yet so it triggers the first fade-in
setWallpaper(wall);

/**
 * File Properties Dialog
 */
function launchPropertiesDialog(path) {
    const stat = fs.stat(path);
    if (stat.error) return wm.messageBox('Properties', stat.error, { icon: 'bi-x-circle-fill' });

    const container = document.createElement('div');
    container.className = 'gos-taskmgr'; // Reuse layout
    container.style.height = '100%';

    let activeTab = 'general';

    const header = document.createElement('div');
    header.className = 'gos-taskmgr-tabs';

    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'attributes', label: 'Attributes' }
    ];

    const contentArea = document.createElement('div');
    contentArea.className = 'gos-taskmgr-content';
    contentArea.style.padding = '20px';

    function renderGeneral() {
        contentArea.innerHTML = '';
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '100px 1fr';
        grid.style.gap = '12px';
        grid.style.fontSize = '0.85rem';

        const name = path.split('\\').pop() || path;
        const type = stat.type === 'dir' ? 'Folder' : (name.includes('.') ? name.split('.').pop().toUpperCase() + ' File' : 'File');
        const size = stat.type === 'dir' ? 'N/A' : (stat.size !== undefined ? stat.size.toLocaleString() + ' bytes (' + (stat.size / 1024).toFixed(2) + ' KB)' : '0 bytes');

        const rows = [
            ['Name:', name],
            ['Type:', type],
            ['Location:', path.substring(0, path.lastIndexOf('\\')) || 'C:\\'],
            ['Full Path:', path],
            ['Size:', size]
        ];

        rows.forEach(([label, value]) => {
            const lbl = document.createElement('div');
            lbl.style.color = '#888';
            lbl.textContent = label;
            const val = document.createElement('div');
            val.style.color = '#ccc';
            val.textContent = value;
            grid.append(lbl, val);
        });

        contentArea.appendChild(grid);
    }

    function renderAttributes() {
        contentArea.innerHTML = '';
        const attrs = fs.getattributes(path);
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '120px 1fr';
        grid.style.gap = '8px';
        grid.style.fontSize = '0.85rem';

        if (!attrs) return;

        Object.keys(attrs).forEach(key => {
            const lbl = document.createElement('div');
            lbl.style.color = '#888';
            lbl.textContent = key + ':';
            const val = document.createElement('div');
            val.style.color = '#00ff00';
            val.style.fontFamily = 'monospace';
            val.textContent = attrs[key];
            grid.append(lbl, val);
        });

        if (grid.children.length === 0) {
            contentArea.innerHTML = '<div style="color:#666;font-size:0.85rem;font-style:italic;">No custom attributes found.</div>';
        } else {
            contentArea.appendChild(grid);
        }
    }

    function switchTab(id) {
        activeTab = id;
        header.querySelectorAll('.gos-taskmgr-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.id === id);
        });
        if (id === 'general') renderGeneral();
        else renderAttributes();
    }

    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'gos-taskmgr-tab' + (tab.id === activeTab ? ' active' : '');
        el.dataset.id = tab.id;
        el.innerText = tab.label;
        el.onclick = () => switchTab(tab.id);
        header.appendChild(el);
    });

    container.append(header, contentArea);

    wm.createWindow(`Properties: ${path.split('\\').pop() || path}`, container, {
        width: 400,
        height: 450,
        icon: stat.type === 'dir' ? 'bi-folder-fill' : 'bi-info-circle',
        noResize: true
    });

    renderGeneral();
}

