// ── LDE Boot — calls ldeInit after all modules are loaded ────────────────────
function ldeInit() {
    assertExistsElseReload(menubar);
    assertExistsElseReload(desktop);
    assertExistsElseReload(taskbar);

    ldeInitApplets();
    ldeInitMenubar();
    renderCalendar(currentCalendarDate);

    const currentDesktopName = desktops[currentDesktopIdx].name;
    desktopNameLbl.innerText = currentDesktopName;

    ldeInitGlobalShortcuts();
    ldeInitDesktopIcons();
    ldeInitDesktopSelection();

    // Fade in the desktop
    document.body.classList.add('loaded');

    // Disable browser right-click menu globally and show custom desktop menu
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (e.target === desktop || e.target.classList.contains('lde-desktop-icons')) {
            ldeShowContextMenu(e.clientX, e.clientY, [
                { label: 'View', icon: 'bi-grid-3x3-gap', action: () => { } },
                { label: 'Sort by', icon: 'bi-sort-alpha-down', action: () => { } },
                { label: 'Refresh', icon: 'bi-arrow-clockwise', action: () => ldeInitDesktopIcons() },
                { type: 'sep' },
                {
                    label: 'New', icon: 'bi-plus-circle', action: () => {
                        ldeShowContextMenu(e.clientX + 160, e.clientY, [
                            { label: 'Folder', icon: 'bi-folder-plus', action: () => { } },
                            { label: 'Text Document', icon: 'bi-file-earmark-plus', action: () => { } }
                        ]);
                    }
                },
                { type: 'sep' },
                { label: 'Display settings', icon: 'bi-monitor', action: () => AppRegistry.get('controlpanel')?.launch() },
                { label: 'Personalize', icon: 'bi-palette', action: () => AppRegistry.get('controlpanel')?.launch() }
            ]);
        }
    });

    // Launch CMD on boot
    launchCommandPrompt(null, true);
}

function ldeInitGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
        let key = e.key.toLowerCase();
        if (e.altKey && key !== 'alt') key = 'alt+' + key;
        if (e.ctrlKey && key !== 'control') key = 'control+' + key;
        if (e.shiftKey && key !== 'shift') key = 'shift+' + key;

        if (SYSTEM_SHORTCUTS.has(key)) {
            const shortcut = SYSTEM_SHORTCUTS.get(key);
            if (shortcut.action) {
                e.preventDefault();
                shortcut.action();
            }
        }

        // Enter key to launch selected desktop apps
        if (key === 'enter') {
            const selectedIcons = document.querySelectorAll('.lde-desktop-shortcut.selected');
            if (selectedIcons.length > 0 && (!wm || !wm.activeWindow)) {
                e.preventDefault();
                selectedIcons.forEach(el => {
                    const appId = el.dataset.appId;
                    const appObj = AppRegistry.get(appId);
                    if (appObj) appObj.launch();
                });
            }
        }
    });
}

/**
 * Desktop Icons — auto-generated from AppRegistry
 */
function ldeInitDesktopIcons() {
    // Remove existing icon container if present (for refresh)
    const existing = desktop.querySelector('.lde-desktop-icons');
    if (existing) existing.remove();

    const apps = AppRegistry.getDesktopApps();
    const iconContainer = document.createElement('div');
    iconContainer.className = 'lde-desktop-icons';

    apps.forEach(app => {
        const icon = document.createElement('div');
        icon.className = 'lde-desktop-shortcut';
        icon.dataset.appId = app.id;
        icon.title = app.name;
        icon.innerHTML = `
            <div class="lde-desktop-shortcut-icon">
                <i class="${getFullIcon(app.icon)}"></i>
            </div>
            <span class="lde-desktop-shortcut-label">${app.name}</span>
        `;

        // Single click to select
        icon.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent browser text selection/dragging
            e.stopPropagation();
            if (!e.ctrlKey && !e.shiftKey) {
                document.querySelectorAll('.lde-desktop-shortcut').forEach(el => el.classList.remove('selected'));
            }
            icon.classList.add('selected');
        });

        // Double click to launch all selected
        icon.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const selectedIcons = document.querySelectorAll('.lde-desktop-shortcut.selected');
            if (selectedIcons.length > 0) {
                selectedIcons.forEach(el => {
                    const appId = el.dataset.appId;
                    const appObj = AppRegistry.get(appId);
                    if (appObj) appObj.launch();
                });
            } else {
                app.launch();
            }
        });

        iconContainer.appendChild(icon);
    });

    desktop.appendChild(iconContainer);
}

/**
 * Desktop Selection — marquee rect and background clicks
 */
function ldeInitDesktopSelection() {
    let startX, startY;
    const marquee = document.createElement('div');
    marquee.className = 'lde-selection-marquee';
    document.body.appendChild(marquee);

    desktop.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Left click only
        if (e.target !== desktop && !e.target.classList.contains('lde-desktop-icons')) return;

        e.preventDefault(); // Prevent browser text selection

        // Clear selection if not modified
        if (!e.ctrlKey && !e.shiftKey) {
            document.querySelectorAll('.lde-desktop-shortcut').forEach(el => el.classList.remove('selected'));
        }

        const dRect = desktop.getBoundingClientRect();
        startX = Math.max(dRect.left, Math.min(e.clientX, dRect.right));
        startY = Math.max(dRect.top, Math.min(e.clientY, dRect.bottom));

        marquee.style.left = startX + 'px';
        marquee.style.top = startY + 'px';
        marquee.style.width = '0px';
        marquee.style.height = '0px';
        marquee.style.display = 'block';

        const onMouseMove = (ev) => {
            ev.preventDefault();
            const dRect = desktop.getBoundingClientRect();

            // Constrain mouse coordinates to desktop viewport
            const curX = Math.max(dRect.left, Math.min(ev.clientX, dRect.right));
            const curY = Math.max(dRect.top, Math.min(ev.clientY, dRect.bottom));

            const x = Math.min(startX, curX);
            const y = Math.min(startY, curY);
            const w = Math.abs(startX - curX);
            const h = Math.abs(startY - curY);

            marquee.style.left = x + 'px';
            marquee.style.top = y + 'px';
            marquee.style.width = w + 'px';
            marquee.style.height = h + 'px';

            const mRect = marquee.getBoundingClientRect();
            document.querySelectorAll('.lde-desktop-shortcut').forEach(icon => {
                const iRect = icon.getBoundingClientRect();
                const intersect = !(mRect.left > iRect.right ||
                    mRect.right < iRect.left ||
                    mRect.top > iRect.bottom ||
                    mRect.bottom < iRect.top);

                if (intersect) {
                    icon.classList.add('selected');
                } else if (!ev.ctrlKey && !ev.shiftKey) {
                    icon.classList.remove('selected');
                }
            });
        };

        const onMouseUp = () => {
            marquee.style.display = 'none';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

ldeInit();
