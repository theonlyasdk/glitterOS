// Initialize System32 executables
(function () {
    if (typeof fs === 'undefined') return;

    if (!fs.exists('C:\\glitterOS\\System32')) fs.mkdir('C:\\glitterOS\\System32');
    if (!fs.exists('C:\\glitterOS\\System32\\Services')) fs.mkdir('C:\\glitterOS\\System32\\Services');
    if (!fs.exists('C:\\Recycle Bin')) fs.mkdir('C:\\Recycle Bin');
    if (!fs.exists('C:\\glitterOS\\System32\\Services\\NotificationService.service')) {
        fs.write('C:\\glitterOS\\System32\\Services\\NotificationService.service', '[glitterOS Service]\r\nName=NotificationService\r\nAutoStart=true');
    }

    if (!fs.exists('C:\\Users\\User\\Documents\\Scripts')) fs.mkdir('C:\\Users\\User\\Documents\\Scripts');
    if (!fs.exists('C:\\Users\\User\\Documents\\Scripts\\sample.smc')) {
        fs.write('C:\\Users\\User\\Documents\\Scripts\\sample.smc', [
            'echo === Sample SMC Script ===',
            'echo Current directory:',
            'cd',
            'if "1" == "1" then echo Condition matched else echo Condition failed',
            'notify Script Runner|sample.smc executed successfully'
        ].join('\r\n'));
    }
    if (!fs.exists('C:\\Users\\User\\Documents\\Scripts\\workspace_setup.smc')) {
        fs.write('C:\\Users\\User\\Documents\\Scripts\\workspace_setup.smc', [
            'echo Preparing workspace...',
            'md Work',
            'md Work\\Logs',
            'echo Ready > Work\\Logs\\status.txt',
            'type Work\\Logs\\status.txt',
            'notify Workspace|Workspace directories created'
        ].join('\r\n'));
    }
    if (!fs.exists('C:\\Users\\User\\Documents\\Scripts\\flow_demo.smc')) {
        fs.write('C:\\Users\\User\\Documents\\Scripts\\flow_demo.smc', [
            'echo === Flow Demo ===',
            'if "alpha" == "alpha" then echo EQ-OK else echo EQ-NO',
            'if "a" != "b" then echo NEQ-OK else echo NEQ-NO',
            'md TempFlow && echo Created TempFlow',
            'type no_such_file.txt || echo Fallback branch executed',
            'notify Flow Demo|Conditional and operator demo complete'
        ].join('\r\n'));
    }
    if (!fs.exists('C:\\Users\\User\\Documents\\Scripts\\loop_demo.smc')) {
        fs.write('C:\\Users\\User\\Documents\\Scripts\\loop_demo.smc', [
            'let counter = 0',
            'while "%counter%" != "3" do',
            '    echo Loop iteration %counter%',
            '    let counter = %counter% + 1',
            'end',
            'notify Loop Demo|Finished counter %counter%',
            'import workspace_setup.smc'
        ].join('\r\n'));
    }

    const apps = [
        { exe: 'notepad.exe', id: 'notepad' },
        { exe: 'explorer.exe', id: 'filemanager' },
        { exe: 'taskmgr.exe', id: 'taskmanager' },
        { exe: 'control.exe', id: 'controlpanel' },
        { exe: 'regedit.exe', id: 'regedit' },
        { exe: 'cmd.exe', id: 'cmd' }
    ];

    apps.forEach(app => {
        const path = `C:\\glitterOS\\System\\${app.exe}`;
        if (!fs.exists(path)) {
            fs.write(path, '[glitterOS System Executable]');
            fs.setattr(path, 'appId', app.id);
        }
    });
})();

function truncateFilename(name, limit) {
    if (name.length <= limit) return name;
    return name.substring(0, limit - 3) + "...";
}

// ── Application Initialization ───────────────────────────────────────────
async function restoreSession() {
    const restoreEnabled = registry.get('Software.GlitterOS.System.RestoreSession', true);
    if (!restoreEnabled) return;

    const session = registry.get('Software.GlitterOS.WindowManager.Session', []);
    if (!Array.isArray(session) || session.length === 0) return;

    if (typeof SysLog !== 'undefined') SysLog.info(`System: Restoring ${session.length} windows from previous session...`);

    // Sort by Z-index to restore stack order
    const sortedSession = [...session].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const winState of sortedSession) {
        const app = AppRegistry.get(winState.appId);
        if (app) {
            try {
                // Launch the app
                app.launch(winState.args);

                // The window is now in wm.windows. Find the most recent one for this appId.
                const newWin = wm.windows.filter(w => w.appId === winState.appId).pop();
                if (newWin) {
                    const winElem = newWin.element;

                    // Apply saved state
                    winElem.style.left = winState.x + 'px';
                    winElem.style.top = winState.y + 'px';
                    winElem.style.width = winState.width + 'px';
                    winElem.style.height = winState.height + 'px';
                    winElem.style.zIndex = winState.zIndex;

                    if (winState.maximized) {
                        // Mock a non-maximized state first to store old values
                        winElem.dataset.oldWidth = winElem.style.width;
                        winElem.dataset.oldHeight = winElem.style.height;
                        winElem.dataset.oldLeft = winElem.style.left;
                        winElem.dataset.oldTop = winElem.style.top;

                        // Then trigger maximization
                        wm.toggleMaximize(winElem);
                    }

                    if (winState.minimized) {
                        wm.minimizeWindow(newWin.id);
                    }
                }
            } catch (err) {
                console.error(`Failed to restore app ${winState.appId}:`, err);
            }
        }
    }
}

// ── LDE Boot — calls gosInit after all modules are loaded ────────────────────
async function gosInit() {
    assertExistsElseReload(menubar);
    assertExistsElseReload(desktop);
    assertExistsElseReload(taskbar);

    gosInitApplets();
    gosInitMenubar();
    renderCalendar(currentCalendarDate);

    const legacyDefaults = registry.get('defaults.ext', null);
    if (legacyDefaults && typeof legacyDefaults === 'object') {
        Object.entries(legacyDefaults).forEach(([ext, appId]) => {
            registry.set(`Software.GlitterOS.Explorer.Defaults.Extensions.${String(ext).toLowerCase()}`, appId);
        });
        registry.delete('defaults.ext');
    }

    if (!registry.get('Software.GlitterOS.Explorer.Defaults.Extensions.smc')) {
        registry.set('Software.GlitterOS.Explorer.Defaults.Extensions.smc', 'cmd');
    }

    // Set default wallpaper
    setWallpaper(registry.get('Software.GlitterOS.Personalization.Wallpaper', 'res/wall.png'));

    const currentDesktopName = desktops[currentDesktopIdx].name;
    desktopNameLbl.innerText = currentDesktopName;

    gosInitGlobalShortcuts();
    gosInitDesktopIcons();
    gosInitDesktopSelection();

    if (typeof SysLog !== 'undefined') SysLog.info("glitterOS: Core UI elements initialized.");

    // Fade in the desktop
    document.body.classList.add('loaded');
    if (typeof SysLog !== 'undefined') SysLog.info("glitterOS: Desktop loaded.");

    // Check if there are any windows. If not, maybe restore session or launch default app.
    const restoreEnabled = registry.get('Software.GlitterOS.System.RestoreSession', true);
    const sessionData = registry.get('Software.GlitterOS.WindowManager.Session', []);
    const hasSavedSession = Array.isArray(sessionData) && sessionData.length > 0;

    if (restoreEnabled && hasSavedSession) {
        await restoreSession();
    } else {
        // Launch initial CMD if no session to restore
        if (typeof launchCommandPrompt === 'function') {
            launchCommandPrompt(null, true);
        }
    }

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

    // Hide lock screen
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) {
        setTimeout(() => {
            lockScreen.classList.add('fade-out');
            setTimeout(() => lockScreen.style.display = 'none', 1000);
        }, 500);
    }
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

        // Arrow keys to navigate desktop icons
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            // Only navigate if NO window is active
            if (wm && wm.activeWindow) return;

            const icons = Array.from(document.querySelectorAll('.gos-desktop-shortcut'));
            if (icons.length === 0) return;

            e.preventDefault();

            const selectedIcons = icons.filter(i => i.classList.contains('selected'));
            let targetIcon = null;
            if (selectedIcons.length === 0) {
                targetIcon = icons[0];
            } else {
                // Find the "lead" icon (the last one selected)
                const leadIcon = selectedIcons[selectedIcons.length - 1];
                const leadRect = leadIcon.getBoundingClientRect();
                
                let bestDist = Infinity;
                
                icons.forEach(icon => {
                    if (icon === leadIcon) return;
                    const rect = icon.getBoundingClientRect();
                    
                    let isCorrectDirection = false;
                    let dist = 0;

                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const leadCenterX = leadRect.left + leadRect.width / 2;
                    const leadCenterY = leadRect.top + leadRect.height / 2;

                    if (key === 'arrowup') {
                        isCorrectDirection = centerY < leadCenterY - leadRect.height / 2;
                        // Favor vertical alignment
                        dist = Math.abs(centerX - leadCenterX) + Math.abs(centerY - leadCenterY) * 0.5;
                    } else if (key === 'arrowdown') {
                        isCorrectDirection = centerY > leadCenterY + leadRect.height / 2;
                        dist = Math.abs(centerX - leadCenterX) + Math.abs(centerY - leadCenterY) * 0.5;
                    } else if (key === 'arrowleft') {
                        isCorrectDirection = centerX < leadCenterX - leadRect.width / 2;
                        dist = Math.abs(centerX - leadCenterX) * 0.5 + Math.abs(centerY - leadCenterY);
                    } else if (key === 'arrowright') {
                        isCorrectDirection = centerX > leadCenterX + leadRect.width / 2;
                        dist = Math.abs(centerX - leadCenterX) * 0.5 + Math.abs(centerY - leadCenterY);
                    }

                    if (isCorrectDirection && dist < bestDist) {
                        bestDist = dist;
                        targetIcon = icon;
                    }
                });
            }

            if (targetIcon) {
                if (!e.shiftKey) {
                    icons.forEach(i => i.classList.remove('selected'));
                }
                targetIcon.classList.add('selected');
                targetIcon.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
    desktop.appendChild(marquee);

    const activateMarquee = (clientX, clientY) => {
        // Clear selection if not modified
        document.querySelectorAll('.gos-desktop-shortcut').forEach(el => el.classList.remove('selected'));

        const dRect = desktop.getBoundingClientRect();
        startX = Math.max(0, Math.min(clientX - dRect.left, dRect.width));
        startY = Math.max(0, Math.min(clientY - dRect.top, dRect.height));

        marquee.style.left = startX + 'px';
        marquee.style.top = startY + 'px';
        marquee.style.width = '0px';
        marquee.style.height = '0px';
        marquee.style.display = 'block';
    };

    const moveMarquee = (clientX, clientY, ctrlKey = false, shiftKey = false) => {
        const dRect = desktop.getBoundingClientRect();

        // Constrain mouse coordinates to desktop viewport (local coordinates)
        const curX = Math.max(0, Math.min(clientX - dRect.left, dRect.width));
        const curY = Math.max(0, Math.min(clientY - dRect.top, dRect.height));

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
