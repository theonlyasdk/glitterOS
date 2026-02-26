// ── LDE Boot — calls gosInit after all modules are loaded ────────────────────
function gosInit() {
    assertExistsElseReload(menubar);
    assertExistsElseReload(desktop);
    assertExistsElseReload(taskbar);

    gosInitApplets();
    gosInitMenubar();
    renderCalendar(currentCalendarDate);

    const currentDesktopName = desktops[currentDesktopIdx].name;
    desktopNameLbl.innerText = currentDesktopName;

    gosInitGlobalShortcuts();
    gosInitDesktopIcons();
    gosInitDesktopSelection();

    if (typeof SysLog !== 'undefined') SysLog.info("glitterOS: Core UI elements initialized.");

    // Fade in the desktop
    document.body.classList.add('loaded');
    if (typeof SysLog !== 'undefined') SysLog.info("glitterOS: Desktop loaded.");

    // Disable browser right-click menu globally and show custom desktop menu
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (e.target === desktop || e.target.classList.contains('gos-desktop-icons')) {
            gosShowContextMenu(e.clientX, e.clientY, [
                { label: 'View', icon: 'bi-grid-3x3-gap', action: () => { } },
                { label: 'Sort by', icon: 'bi-sort-alpha-down', action: () => { } },
                { label: 'Refresh', icon: 'bi-arrow-clockwise', action: () => gosInitDesktopIcons() },
                { type: 'sep' },
                {
                    label: 'New', icon: 'bi-plus-circle', hasSubmenu: true,
                    onMouseEnter: (e, el) => {
                        const rect = el.getBoundingClientRect();
                        gosShowContextMenu(rect.right, rect.top, [
                            { label: 'Folder', icon: 'bi-folder-plus', action: () => { } },
                            { label: 'Text Document', icon: 'bi-file-earmark-plus', action: () => { } }
                        ], true);
                    },
                    action: () => { }
                },
                { type: 'sep' },
                { label: 'Display settings', icon: 'bi-display', action: () => AppRegistry.get('controlpanel')?.launch() },
                { label: 'Personalize', icon: 'bi-palette', action: () => AppRegistry.get('controlpanel')?.launch() }
            ]);
        }
    });

    // Launch CMD on boot
    launchCommandPrompt(null, true);
}

function gosInitGlobalShortcuts() {
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
            const selectedIcons = document.querySelectorAll('.gos-desktop-shortcut.selected');
            if (selectedIcons.length > 0 && (!wm || !wm.activeWindow)) {
                e.preventDefault();
                selectedIcons.forEach((el, index) => {
                    setTimeout(() => {
                        const appId = el.dataset.appId;
                        const appObj = AppRegistry.get(appId);
                        if (appObj) appObj.launch();
                    }, index * 100);
                });
            }
        }
    });
}

/**
 * Desktop Icons — auto-generated from AppRegistry
 */
function gosInitDesktopIcons() {
    // Remove existing icon container if present (for refresh)
    const existing = desktop.querySelector('.gos-desktop-icons');
    if (existing) existing.remove();

    const apps = AppRegistry.getDesktopApps();
    const iconContainer = document.createElement('div');
    iconContainer.className = 'gos-desktop-icons';

    apps.forEach(app => {
        const icon = document.createElement('div');
        icon.className = 'gos-desktop-shortcut';
        icon.dataset.appId = app.id;
        icon.title = app.name;
        icon.innerHTML = `
            <div class="gos-desktop-shortcut-icon">
                <i class="${getFullIcon(app.icon)}"></i>
            </div>
            <span class="gos-desktop-shortcut-label">${truncateFilename(app.name, 18)}</span>
        `;

        // Single click to select
        let clickTimer = null;
        let preventSingle = false;

        icon.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.button === 0) {
                const isSelected = icon.classList.contains('selected');
                if (e.ctrlKey || e.metaKey) {
                    icon.classList.toggle('selected');
                } else if (e.shiftKey) {
                    icon.classList.add('selected');
                } else if (!isSelected) {
                    // Not selected, clear others and select this
                    document.querySelectorAll('.gos-desktop-shortcut').forEach(el => el.classList.remove('selected'));
                    icon.classList.add('selected');
                }
            } else if (e.button === 2) {
                if (!icon.classList.contains('selected')) {
                    document.querySelectorAll('.gos-desktop-shortcut').forEach(el => el.classList.remove('selected'));
                    icon.classList.add('selected');
                }
            }
        });

        icon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;

            clearTimeout(clickTimer);
            if (preventSingle) {
                preventSingle = false;
                return;
            }

            clickTimer = setTimeout(() => {
                // Determine if this was just a single click on a selected item 
                // in an existing selection. If so, clear others!
                const selected = document.querySelectorAll('.gos-desktop-shortcut.selected');
                if (selected.length > 1 && icon.classList.contains('selected')) {
                    document.querySelectorAll('.gos-desktop-shortcut').forEach(el => el.classList.remove('selected'));
                    icon.classList.add('selected');
                }
            }, 200); // Wait for double click
        });

        // Context menu
        icon.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selectedIcons = document.querySelectorAll('.gos-desktop-shortcut.selected');

            if (selectedIcons.length > 1) {
                gosShowContextMenu(e.clientX, e.clientY, [
                    {
                        label: `Open (${selectedIcons.length} items)`,
                        icon: 'bi-box-arrow-up-right',
                        action: () => {
                            selectedIcons.forEach((el, index) => {
                                setTimeout(() => {
                                    const appObj = AppRegistry.get(el.dataset.appId);
                                    if (appObj) appObj.launch();
                                }, index * 100);
                            });
                        }
                    }
                ]);
            } else {
                gosShowContextMenu(e.clientX, e.clientY, [
                    { label: 'Open', icon: 'bi-box-arrow-up-right', action: () => app.launch() },
                    { type: 'sep' },
                    {
                        label: 'Uninstall',
                        icon: 'bi-trash',
                        color: 'danger',
                        action: () => {
                            wm.messageBox('Uninstall', `Are you sure you want to uninstall ${app.name}?`, {
                                buttons: 'yesno',
                                icon: 'bi-exclamation-triangle-fill',
                                onYes: () => {
                                    AppRegistry.unregister(app.id);
                                    gosInitDesktopIcons(); // reload icons
                                }
                            });
                        }
                    }
                ]);
            }
        });

        // Double click to launch all selected (staggered)
        icon.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            clearTimeout(clickTimer);
            preventSingle = true;

            const selectedIcons = document.querySelectorAll('.gos-desktop-shortcut.selected');
            if (selectedIcons.length > 0) {
                selectedIcons.forEach((el, index) => {
                    setTimeout(() => {
                        const appObj = AppRegistry.get(el.dataset.appId);
                        if (appObj) appObj.launch();
                    }, index * 100);
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
function gosInitDesktopSelection() {
    let startX, startY;
    const marquee = document.createElement('div');
    marquee.className = 'gos-selection-marquee';
    document.body.appendChild(marquee);

    const activateMarquee = (clientX, clientY) => {
        // Clear selection if not modified
        document.querySelectorAll('.gos-desktop-shortcut').forEach(el => el.classList.remove('selected'));

        const dRect = desktop.getBoundingClientRect();
        startX = Math.max(dRect.left, Math.min(clientX, dRect.right));
        startY = Math.max(dRect.top, Math.min(clientY, dRect.bottom));

        marquee.style.left = startX + 'px';
        marquee.style.top = startY + 'px';
        marquee.style.width = '0px';
        marquee.style.height = '0px';
        marquee.style.display = 'block';
    };

    const moveMarquee = (clientX, clientY, ctrlKey = false, shiftKey = false) => {
        const dRect = desktop.getBoundingClientRect();

        // Constrain mouse coordinates to desktop viewport
        const curX = Math.max(dRect.left, Math.min(clientX, dRect.right));
        const curY = Math.max(dRect.top, Math.min(clientY, dRect.bottom));

        const x = Math.min(startX, curX);
        const y = Math.min(startY, curY);
        const w = Math.abs(startX - curX);
        const h = Math.abs(startY - curY);

        marquee.style.left = x + 'px';
        marquee.style.top = y + 'px';
        marquee.style.width = w + 'px';
        marquee.style.height = h + 'px';

        const mRect = marquee.getBoundingClientRect();
        document.querySelectorAll('.gos-desktop-shortcut').forEach(icon => {
            const iRect = icon.getBoundingClientRect();
            const intersect = !(mRect.left > iRect.right ||
                mRect.right < iRect.left ||
                mRect.top > iRect.bottom ||
                mRect.bottom < iRect.top);

            if (intersect) {
                icon.classList.add('selected');
            } else if (!ctrlKey && !shiftKey) {
                icon.classList.remove('selected');
            }
        });
    };

    const deactivateMarquee = () => {
        marquee.style.display = 'none';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onMouseUp);
    };

    const onMouseMove = (ev) => {
        ev.preventDefault();
        moveMarquee(ev.clientX, ev.clientY, ev.ctrlKey, ev.shiftKey);
    };

    const onTouchMove = (ev) => {
        moveMarquee(ev.touches[0].clientX, ev.touches[0].clientY);
    };

    const onMouseUp = () => deactivateMarquee();

    desktop.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Left click only
        if (e.target !== desktop && !e.target.classList.contains('gos-desktop-icons')) return;
        e.preventDefault();
        activateMarquee(e.clientX, e.clientY);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    desktop.addEventListener('touchstart', (e) => {
        if (e.target !== desktop && !e.target.classList.contains('gos-desktop-icons')) return;
        // Don't preventDefault here to allow tap actions (launching icons)
        activateMarquee(e.touches[0].clientX, e.touches[0].clientY);
        document.addEventListener('touchmove', onTouchMove);
        document.addEventListener('touchend', onMouseUp);
    }, { passive: true });
}

gosInit();
