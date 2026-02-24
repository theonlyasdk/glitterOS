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

            // If it has an exe name, ensure it exists in System32
            if (app.exe && typeof fs !== 'undefined') {
                const path = `C:\\Windows\\System32\\${app.exe}`;
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

/**
 * System Registry - Persistent configuration storage
 */
const registry = (() => {
    const KEY = 'lde_registry';
    let _data = {
        personalization: {
            wallpaper: 'res/wall.png'
        }
    };

    function _load() {
        const saved = localStorage.getItem(KEY);
        if (saved) {
            try {
                _data = { ..._data, ...JSON.parse(saved) };
            } catch (e) { console.error("Registry load failed", e); }
        }
    }

    function _save() {
        localStorage.setItem(KEY, JSON.stringify(_data));
    }

    _load();

    return {
        get(path, defaultVal) {
            const parts = path.split('.');
            let curr = _data;
            for (const p of parts) {
                if (curr[p] === undefined) return defaultVal;
                curr = curr[p];
            }
            return curr;
        },
        set(path, val) {
            const parts = path.split('.');
            let curr = _data;
            for (let i = 0; i < parts.length - 1; i++) {
                if (curr[parts[i]] === undefined) curr[parts[i]] = {};
                curr = curr[parts[i]];
            }
            curr[parts[parts.length - 1]] = val;
            _save();
        },
        /** Get entire registry data (deep copy) */
        getAll() { return JSON.parse(JSON.stringify(_data)); },
        /** Delete a key by dot-path */
        delete(path) {
            const parts = path.split('.');
            let curr = _data;
            for (let i = 0; i < parts.length - 1; i++) {
                if (curr[parts[i]] === undefined) return;
                curr = curr[parts[i]];
            }
            delete curr[parts[parts.length - 1]];
            _save();
        }
    };
})();

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
    bar.className = 'lde-app-menubar';

    function createMenu(label, items) {
        const menu = document.createElement('div');
        menu.className = 'lde-app-menu-item';
        menu.textContent = label;

        const dropdown = document.createElement('div');
        dropdown.className = 'lde-app-dropdown';

        items.forEach(item => {
            if (item.type === 'sep') {
                const sep = document.createElement('div');
                sep.className = 'lde-app-dropdown-sep';
                dropdown.appendChild(sep);
            } else {
                const el = document.createElement('div');
                el.className = 'lde-app-dropdown-item' + (item.color === '#f44336' ? ' danger' : '') + (item.disabled ? ' disabled' : '');
                el.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
                el.onclick = (e) => {
                    e.stopPropagation();
                    // Perform action instantly
                    if (item.action) item.action();

                    // Ghosting effect
                    el.classList.add('lde-dropdown-item-ghost');
                    menu.classList.add('item-clicked');

                    setTimeout(() => {
                        menu.classList.remove('active');
                        menu.classList.remove('item-clicked');
                        el.classList.remove('lde-dropdown-item-ghost');
                    }, 300);
                };
                dropdown.appendChild(el);
            }
        });

        menu.appendChild(dropdown);

        // Click to toggle
        menu.onclick = (e) => {
            e.stopPropagation();
            const wasActive = menu.classList.contains('active');
            bar.querySelectorAll('.lde-app-menu-item').forEach(m => m.classList.remove('active'));
            if (!wasActive) menu.classList.add('active');
        };

        // Hover to switch if one is already open
        menu.onmouseenter = () => {
            const anyActive = bar.querySelector('.lde-app-menu-item.active');
            if (anyActive && anyActive !== menu) {
                anyActive.classList.remove('active');
                menu.classList.add('active');
            }
        };

        bar.appendChild(menu);
        return menu;
    }

    // Close menus on outside click
    const onMouseDown = (e) => {
        if (!bar.contains(e.target)) {
            bar.querySelectorAll('.lde-app-menu-item').forEach(m => m.classList.remove('active'));
        }
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
function ldeShowContextMenu(x, y, items) {
    const existing = document.querySelector('.lde-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'lde-context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    items.forEach(item => {
        if (item.type === 'sep') {
            const sep = document.createElement('div');
            sep.className = 'lde-context-menu-sep';
            menu.appendChild(sep);
        } else {
            const el = document.createElement('div');
            el.className = 'lde-context-menu-item' + (item.color === 'danger' ? ' danger' : '') + (item.disabled ? ' disabled' : '');
            el.innerHTML = `${item.icon ? `<i class="${getFullIcon(item.icon)}"></i>` : ''} <span>${item.label}</span>`;
            el.onclick = (e) => {
                e.stopPropagation();
                // Perform action instantly
                if (item.action) item.action();

                // Ghosting effect
                el.classList.add('lde-dropdown-item-ghost');
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
function ldeMbarItemClicked(item_index, sender) { alert(sender); }

function kaboom(sender) {
    const kaboomCandidates = [menubar, desktop, taskbar];
    kaboomCandidates.forEach((elem) => {
        elem.addEventListener("mouseup", () => {
            elem.classList.add("kaboom");
            kaboomCandidates.pop(elem);
            if (kaboomCandidates.length < 2) {
                document.body.classList.add("kaboom-ticking");
                setInterval(() => {
                    document.body.classList.remove("kaboom-ticking");
                    document.body.classList.add("kaboom");
                }, 5000);
            }
        });
    });
}

function aboutGlitterOS(app_name) {
    const sub_text = app_name ? `<div class="mb-3 text-secondary" style="font-size: 0.85rem;">This product is licensed under the glitterOS License to:<br><b>${app_name} User</b></div>` : '';
    const msg = `
		<div class="lde-app-padded">
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
 * Tilt / Ripple Utilities (Shared across the OS)
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
    ripple.className = 'lde-ac-tile-ripple';
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

    elem.addEventListener('mousedown', (e) => {
        _pressing = true;
        if (options.tilt) applyTiltPress(elem, e);
        if (options.ripple) spawnRipple(elem, e);
    });

    elem.addEventListener('mouseup', () => {
        _pressing = false;
        if (options.tilt) resetTilt(elem);
    });

    elem.addEventListener('mouseleave', () => {
        _pressing = false;
        if (options.tilt) resetTilt(elem);
    });

    elem.addEventListener('mousemove', (e) => {
        if (options.glow) {
            const r = elem.getBoundingClientRect();
            elem.style.setProperty('--glow-x', (e.clientX - r.left) + 'px');
            elem.style.setProperty('--glow-y', (e.clientY - r.top) + 'px');
        }
        if (_pressing && options.liveTilt) {
            applyTiltPress(elem, e);
        }
    });

    // Ensure element has necessary CSS for these effects
    if (options.ripple || options.glow) {
        if (getComputedStyle(elem).position === 'static') elem.style.position = 'relative';
        elem.style.overflow = 'hidden';
    }
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
    const layers = desktop.querySelectorAll('.lde-wallpaper-layer');
    const oldLayer = layers[layers.length - 1]; // Assume latest is current

    const newLayer = document.createElement('div');
    newLayer.className = 'lde-wallpaper-layer';
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
    container.className = 'lde-taskmgr'; // Reuse layout
    container.style.height = '100%';

    let activeTab = 'general';

    const header = document.createElement('div');
    header.className = 'lde-taskmgr-tabs';

    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'attributes', label: 'Attributes' }
    ];

    const contentArea = document.createElement('div');
    contentArea.className = 'lde-taskmgr-content';
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
        const size = stat.type === 'dir' ? '-' : (stat.size ? (stat.size / 1024).toFixed(1) + ' KB' : '0 KB');

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
        header.querySelectorAll('.lde-taskmgr-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.id === id);
        });
        if (id === 'general') renderGeneral();
        else renderAttributes();
    }

    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'lde-taskmgr-tab' + (tab.id === activeTab ? ' active' : '');
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

