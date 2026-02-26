/**
 * Window Manager for glitterOS - Enhanced version
 */

function getFullIcon(ico) {
    if (!ico) return 'ri-window-line';
    if (ico.includes(' ')) return ico;
    if (ico.startsWith('ri-')) return ico;
    if (ico.startsWith('bi-')) return 'bi ' + ico;
    return 'ri-' + ico;
}

class WindowManager {
    constructor() {
        this.windows = []; // Store window objects: { id, title, icon, element, zIndex }
        this.activeWindow = null;
        this.zIndexCounter = 100;
        this.desktop = document.getElementById('desktop');
        this.taskbar = document.getElementById('taskbar');

        // Create snap preview element
        this.snapPreview = document.createElement('div');
        this.snapPreview.className = 'gos-snap-preview';
        document.body.appendChild(this.snapPreview);

        // Unfocus active window when clicking the desktop background or icon container
        this.desktop.addEventListener('mousedown', (e) => {
            if (e.target === this.desktop || e.target.classList.contains('gos-desktop-icons')) {
                this.unfocusActive();
            }
        });

        // Phone/Touch slide support for taskbar
        let isDown = false;
        let startX;
        let scrollLeft;

        this.taskbar.addEventListener('touchstart', (e) => {
            isDown = true;
            startX = e.touches[0].pageX - this.taskbar.offsetLeft;
            scrollLeft = this.taskbar.scrollLeft;
        }, { passive: true });
        this.taskbar.addEventListener('touchend', () => isDown = false);
        this.taskbar.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            const x = e.touches[0].pageX - this.taskbar.offsetLeft;
            const walk = (x - startX) * 2;
            this.taskbar.scrollLeft = scrollLeft - walk;
        }, { passive: true });

        // Menubar app menu handlers
        const closeAppBtn = document.getElementById('mbar-close-app');
        if (closeAppBtn) closeAppBtn.onclick = () => {
            if (this.activeWindow) this.closeWindow(this.activeWindow.id);
        };
        const prefsBtn = document.getElementById('mbar-app-prefs');
        if (prefsBtn) prefsBtn.onclick = () => {
            if (this.activeWindow && this.activeWindow.preferencesProvider) {
                this.activeWindow.preferencesProvider();
            }
        };
    }

    unfocusActive() {
        if (this.activeWindow) {
            this.activeWindow.element.classList.remove('active');
            this.activeWindow = null;
            this.updateTaskbar();
            this.updateMenubarLabel();
        }
    }

    createWindow(title, content, options = {}) {
        const isPhone = window.innerWidth < 600;
        const mbarHeight = document.getElementById('menubar').offsetHeight;
        const taskbarHeight = document.getElementById('taskbar').offsetHeight;
        const availableH = window.innerHeight - mbarHeight - taskbarHeight;

        const id = 'win-' + Math.random().toString(36).substr(2, 9);
        const win = document.createElement('div');
        win.className = 'gos-window';
        win.id = id;

        if (isPhone) {
            // Full screen on phone unless it's a messageBox (which is handled later via class)
            win.style.width = '100%';
            win.style.height = availableH + 'px';
            win.style.left = '0';
            win.style.top = mbarHeight + 'px';
            if (!options.noControls) win.dataset.maximized = 'true';
        } else {
            win.style.left = (options.x || 100 + (this.windows.length * 20)) + 'px';
            win.style.top = (options.y || 50 + (this.windows.length * 20)) + 'px';
            win.style.width = (options.width || 400) + 'px';
            win.style.height = (options.height || 300) + 'px';
        }
        win.style.zIndex = ++this.zIndexCounter;

        const header = document.createElement('div');
        header.className = 'gos-win-header';

        const titleElem = document.createElement('div');
        titleElem.className = 'gos-win-title';
        titleElem.innerHTML = `<span>${title}</span>`;

        const controls = document.createElement('div');
        controls.className = 'gos-win-controls';

        const minBtn = document.createElement('div');
        minBtn.className = 'gos-win-btn gos-win-btn-min';
        minBtn.innerHTML = '<i class="ri-subtract-line"></i>';
        minBtn.onclick = (e) => {
            e.stopPropagation();
            this.minimizeWindow(id);
        };

        const maxBtn = document.createElement('div');
        maxBtn.className = 'gos-win-btn gos-win-btn-max';
        maxBtn.innerHTML = '<i class="ri-checkbox-blank-line"></i>';
        maxBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMaximize(win);
        };

        const closeBtn = document.createElement('div');
        closeBtn.className = 'gos-win-btn gos-win-btn-close';
        closeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.closeWindow(id);
        };

        if (!options.noControls) {
            controls.appendChild(minBtn);
            controls.appendChild(maxBtn);
        }
        controls.appendChild(closeBtn);

        const iconElem = document.createElement('div');
        iconElem.className = 'gos-win-icon';
        // getFullIcon is now global

        iconElem.innerHTML = `<i class="${getFullIcon(options.icon)}"></i>`;

        // System menu popup
        const sysMenu = document.createElement('div');
        sysMenu.className = 'gos-win-sysmenu';
        sysMenu.innerHTML = `
            ${!options.noControls ? `
                <div class="gos-win-sysmenu-item" data-action="restore"><span>Restore</span></div>
                <div class="gos-win-sysmenu-item" data-action="minimize"><span>Minimize</span></div>
                <div class="gos-win-sysmenu-item" data-action="maximize"><span>Maximize</span></div>
                <hr class="gos-win-sysmenu-divider">
            ` : ''}
            <div class="gos-win-sysmenu-item gos-win-sysmenu-close" data-action="close"><span>Close</span><span class="gos-sysmenu-shortcut">Alt+F4</span></div>
        `;
        sysMenu.querySelectorAll('.gos-win-sysmenu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                sysMenu.classList.remove('visible');
                const action = item.dataset.action;
                if (action === 'close') this.closeWindow(id);
                if (action === 'minimize') this.minimizeWindow(id);
                if (action === 'maximize') this.toggleMaximize(win);
                if (action === 'restore' && win.dataset.maximized === 'true') this.toggleMaximize(win);
            });
        });

        const showSysMenu = (x, y) => {
            sysMenu.classList.add('visible');
            const rect = sysMenu.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) x -= rect.width;
            if (y + rect.height > window.innerHeight) y -= rect.height;
            sysMenu.style.left = x + 'px';
            sysMenu.style.top = y + 'px';
        };

        // const winObj = ... removed to avoid redeclaration

        iconElem.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = iconElem.getBoundingClientRect();
            sysMenu.classList.contains('visible')
                ? sysMenu.classList.remove('visible')
                : showSysMenu(rect.left, rect.bottom);
        });

        // Right-click on header (title area) also shows sysmenu
        header.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.gos-win-btn') || e.target.closest('.gos-win-icon')) return;
            e.preventDefault();
            showSysMenu(e.clientX, e.clientY);
        });

        // Double-click to maximize/restore
        header.addEventListener('dblclick', (e) => {
            if (e.target.closest('.gos-win-btn') || e.target.closest('.gos-win-icon')) return;
            this.toggleMaximize(win);
        });

        // Close sysmenu when clicking elsewhere
        document.addEventListener('mousedown', (e) => {
            if (!sysMenu.contains(e.target) && !iconElem.contains(e.target)) {
                sysMenu.classList.remove('visible');
            }
        });

        header.appendChild(iconElem);
        header.appendChild(titleElem);
        header.appendChild(controls);
        document.body.appendChild(sysMenu);

        const body = document.createElement('div');
        body.className = 'gos-win-body';

        // Windows 10 UWP Style Splash Screen (if enabled in registry)
        const showSplash = registry.get('personalization.showSplash', true);
        if (showSplash) {
            const splash = document.createElement('div');
            splash.className = 'gos-splash';
            // Pick a background color based on app or default
            const splashColors = {
                'Command Prompt': '#000000',
                'File Explorer': '#0078d7',
                'Notepad': '#222222',
                'Control Panel': '#1e1e1e',
                'Editor': '#0000aa'
            };
            splash.style.backgroundColor = splashColors[title] || '#0078d7';
            splash.innerHTML = `
                <div class="gos-splash-icon">
                    <i class="${getFullIcon(options.icon)}"></i>
                </div>
            `;
            body.appendChild(splash);

            // Fade out splash after 700ms
            setTimeout(() => {
                splash.classList.add('fade-out');
                setTimeout(() => splash.remove(), 400); // Cleanup after CSS transition
            }, 700);
        }

        if (typeof content === 'string') {
            const contentDiv = document.createElement('div');
            contentDiv.innerHTML = content;
            body.appendChild(contentDiv);
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }

        win.appendChild(header);
        win.appendChild(body);

        if (!options.noResize) {
            const resizers = ['r', 'b', 'rb'];
            resizers.forEach(r => {
                const resizer = document.createElement('div');
                resizer.className = `gos-win-resizer gos-win-resizer-${r}`;
                win.appendChild(resizer);
                this.makeResizable(win, resizer, r);
            });
        }

        // Add opening class BEFORE inserting into DOM so browser paints initial state
        win.classList.add('opening');
        this.desktop.appendChild(win);

        const winObj = {
            id: id,
            title: title,
            icon: options.icon || 'ri-window-line',
            element: win,
            zIndex: win.style.zIndex,
            showSysMenu: showSysMenu
        };

        this.windows.push(winObj);
        this.makeDraggable(win, header);

        if (options.onClose) winObj.onClose = options.onClose;
        if (options.modal) {
            winObj.modal = true;
            if (options.parentTitle) {
                winObj.parentTitle = options.parentTitle;
                const parentWin = this.windows.find(w => w.title.includes(options.parentTitle) || (w.parentTitle && w.parentTitle.includes(options.parentTitle)) || (w.id === options.parentId));
                if (parentWin) {
                    winObj.parentId = parentWin.id;
                    const overlay = document.createElement('div');
                    overlay.className = 'gos-modal-shim';
                    overlay.style.cssText = 'position:absolute;inset:0;background:transparent;z-index:9999;';
                    overlay.onmousedown = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.focusWindow(winObj.id);
                        win.classList.add('modal-flash');
                        setTimeout(() => win.classList.remove('modal-flash'), 100);
                    };
                    parentWin.element.appendChild(overlay);
                    winObj.modalShim = overlay;
                }
            }
        }

        if (typeof SysLog !== 'undefined') SysLog.debug(`WindowManager: Created window "${title}" (${id})`);

        win.onmousedown = (e) => {
            e.stopPropagation();
            this.focusWindow(id);
        };

        this.focusWindow(id);
        this.updateTaskbar();

        // Notify system of window change
        window.dispatchEvent(new CustomEvent('gos-window-changed'));

        // Remove opening class after browser has painted the initial (scaled-down) state
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                win.classList.remove('opening');
            });
        });

        return winObj;
    }

    toggleMaximize(win) {
        const mbarHeight = document.getElementById('menubar').offsetHeight;
        const taskbarHeight = document.getElementById('taskbar').offsetHeight;
        const isMax = win.dataset.maximized === 'true';

        if (!isMax) {
            win.dataset.oldWidth = win.style.width;
            win.dataset.oldHeight = win.style.height;
            win.dataset.oldLeft = win.style.left;
            win.dataset.oldTop = win.style.top;
        }

        win.classList.add('no-transition');

        if (isMax) {
            win.style.width = win.dataset.oldWidth;
            win.style.height = win.dataset.oldHeight;
            win.style.left = win.dataset.oldLeft;
            win.style.top = win.dataset.oldTop;
            win.dataset.maximized = 'false';
        } else {
            win.style.width = '100%';
            win.style.height = `calc(100% - ${mbarHeight + taskbarHeight}px)`;
            win.style.left = '0';
            win.style.top = mbarHeight + 'px';
            win.dataset.maximized = 'true';
        }

        win.offsetHeight; // Force reflow
        win.classList.remove('no-transition');
        if (typeof SysLog !== 'undefined') SysLog.debug(`WindowManager: Window "${win.id}" ${isMax ? 'restored' : 'maximized'}`);
    }

    focusWindow(id) {
        const modalWin = this.windows.find(w => {
            if (!w.modal || w.element.classList.contains('minimized') || w.element.classList.contains('closing')) return false;

            // If it's a system modal (no parent), it blocks EVERYTHING except itself
            if (!w.parentId) {
                return w.id !== id;
            }

            // If it's an application modal, it ONLY blocks its parent
            return w.parentId === id;
        });

        if (modalWin) {
            // Flash the modal window
            modalWin.element.classList.add('modal-flash');
            setTimeout(() => modalWin.element.classList.remove('modal-flash'), 100);
            return;
        }

        const winObj = this.windows.find(w => w.id === id);
        if (!winObj) return;

        if (winObj.element.classList.contains('minimized')) {
            this.restoreWindow(id);
            return;
        }

        if (this.activeWindow === winObj) return;

        // Remove active class from previous window
        if (this.activeWindow) {
            this.activeWindow.element.classList.remove('active');
        }

        winObj.element.style.display = 'flex';
        winObj.element.style.zIndex = ++this.zIndexCounter;
        winObj.element.classList.add('active');
        this.activeWindow = winObj;

        this.updateTaskbar();
        this.updateMenubarLabel();
    }

    minimizeWindow(id) {
        const winObj = this.windows.find(w => w.id === id);
        if (!winObj) return;

        const win = winObj.element;
        const taskItem = document.querySelector(`.gos-taskbar-item[data-win-id="${id}"]`);

        if (taskItem) {
            const rect = taskItem.getBoundingClientRect();
            win.dataset.preMinLeft = win.offsetLeft + 'px';
            win.dataset.preMinTop = win.offsetTop + 'px';
            win.dataset.preMinW = win.offsetWidth + 'px';
            win.dataset.preMinH = win.offsetHeight + 'px';

            win.style.left = (rect.left + rect.width / 2 - win.offsetWidth / 2) + 'px';
            win.style.top = rect.top + 'px';
            win.style.transform = 'scale(0.01)';
        }

        if (win.minTimeout) clearTimeout(win.minTimeout);
        win.classList.remove('active');
        win.classList.add('minimized');
        win.minTimeout = setTimeout(() => {
            if (win.classList.contains('minimized')) {
                win.style.display = 'none';
                this.updateTaskbar();
            }
        }, 400);

        if (this.activeWindow === winObj) {
            this.activeWindow = null;
            // Focus next top window
            const visibleWindows = this.windows.filter(w => !w.element.classList.contains('minimized'));
            if (visibleWindows.length > 0) {
                const topWin = visibleWindows.sort((a, b) => b.element.style.zIndex - a.element.style.zIndex)[0];
            }
        }
        this.updateTaskbar();
        if (typeof SysLog !== 'undefined') SysLog.debug(`WindowManager: Window "${id}" minimized`);
    }

    restoreWindow(id) {
        const winObj = this.windows.find(w => w.id === id);
        if (!winObj) return;

        const win = winObj.element;
        if (win.minTimeout) clearTimeout(win.minTimeout);
        win.style.display = 'flex';

        // Force reflow
        win.offsetHeight;

        win.classList.remove('minimized');
        win.style.left = win.dataset.preMinLeft;
        win.style.top = win.dataset.preMinTop;
        win.style.width = win.dataset.preMinW;
        win.style.height = win.dataset.preMinH;
        win.style.transform = '';

        win.style.zIndex = ++this.zIndexCounter;
        this.activeWindow = winObj;
        this.updateTaskbar();
        if (typeof SysLog !== 'undefined') SysLog.debug(`WindowManager: Window "${id}" restored`);
    }

    closeWindow(id) {
        const index = this.windows.findIndex(w => w.id === id);
        if (index === -1) return;

        const winObj = this.windows[index];
        const win = winObj.element;

        if (winObj.onClose && winObj.onClose() === false) {
            return;
        }

        if (winObj.modalShim) {
            winObj.modalShim.remove();
        }

        if (typeof SysLog !== 'undefined') SysLog.debug(`WindowManager: Closed window "${winObj.title}" (${id})`);

        // Trigger window close animation
        win.classList.add('closing');

        // Find task item and trigger removal
        const taskItem = this.taskbar.querySelector(`.gos-taskbar-item[data-win-id="${id}"]`);
        if (taskItem) {
            taskItem.classList.add('removing');
        }

        // Delay actual removal
        setTimeout(() => {
            if (win.parentNode === this.desktop) {
                this.desktop.removeChild(win);
            }
            const finalIndex = this.windows.findIndex(w => w.id === id);
            if (finalIndex !== -1) {
                this.windows.splice(finalIndex, 1);
            }
            this.updateTaskbar();
            this.updateMenubarLabel();
            window.dispatchEvent(new CustomEvent('gos-window-changed'));
        }, 300);

        if (this.activeWindow && this.activeWindow.id === id) {
            this.activeWindow = null;
            if (this.windows.length > 1) {
                const topWin = this.windows
                    .filter(w => w.id !== id && !w.element.classList.contains('minimized') && !w.element.classList.contains('closing'))
                    .sort((a, b) => b.element.style.zIndex - a.element.style.zIndex)[0];
                if (topWin) this.focusWindow(topWin.id);
            }
        }
    }

    /**
     * Win32 style MessageBox in Dark Mode
     */
    messageBox(title, message, options = {}) {
        const container = document.createElement('div');
        container.className = 'gos-messagebox';

        const main = document.createElement('div');
        main.className = 'gos-messagebox-main';

        const icon = document.createElement('div');
        icon.className = 'gos-messagebox-icon';
        const iconName = options.icon || 'ri-information-line';
        icon.innerHTML = `<i class="${getFullIcon(iconName)}"></i>`;

        const text = document.createElement('div');
        text.className = 'gos-messagebox-text';
        text.innerHTML = message;

        main.append(icon, text);

        const buttons = document.createElement('div');
        buttons.className = 'gos-messagebox-buttons';

        const createBtn = (lbl, callback, isDefault) => {
            const b = document.createElement('button');
            b.className = 'gos-msg-btn' + (isDefault ? ' default' : '');
            b.textContent = lbl;
            b.onclick = (e) => {
                wm.closeWindow(win.id);
                if (callback) callback(e);
            };
            return b;
        };

        if (options.buttons === 'yesno') {
            buttons.appendChild(createBtn('Yes', options.onYes, true));
            buttons.appendChild(createBtn('No', options.onNo));
        } else if (options.buttons === 'yesnocancel') {
            buttons.appendChild(createBtn('Yes', options.onYes, true));
            buttons.appendChild(createBtn('No', options.onNo));
            buttons.appendChild(createBtn('Cancel', options.onCancel));
        } else {
            buttons.appendChild(createBtn('OK', options.onOk, true));
        }

        container.append(main, buttons);

        const win = this.createWindow(title, container, {
            noControls: true,
            noResize: true,
            width: 380,
            height: 190,
            icon: options.icon || 'ri-information-line',
            modal: options.modal || false
        });
        win.element.classList.add('gos-window-messagebox');

        // Center on phone
        if (window.innerWidth < 600) {
            const mbarHeight = document.getElementById('menubar').offsetHeight;
            const taskbarHeight = document.getElementById('taskbar').offsetHeight;
            const availableH = window.innerHeight - mbarHeight - taskbarHeight;
            win.element.style.width = '90%';
            win.element.style.left = '5%';
            win.element.style.top = (mbarHeight + (availableH - 190) / 2) + 'px';
            win.element.style.height = 'auto';
        }

        return win;
    }

    updateMenubarLabel() {
        const deskLabel = document.getElementById('desktop-name');
        const deskBtn = document.getElementById('desktop-name-btn');
        const appMenu = document.getElementById('mbar-app-menu');
        const closeAppBtn = document.getElementById('mbar-close-app');
        const prefsBtn = document.getElementById('mbar-app-prefs');

        if (!deskLabel) return;

        if (this.activeWindow) {
            const title = this.activeWindow.parentTitle || this.activeWindow.title;
            deskLabel.textContent = title;
            if (deskBtn) deskBtn.style.pointerEvents = 'auto';
            if (appMenu) appMenu.style.display = '';
            if (closeAppBtn) closeAppBtn.textContent = `Quit ${title}`;
            if (prefsBtn) {
                if (this.activeWindow.preferencesProvider) {
                    prefsBtn.parentElement.style.display = '';
                } else {
                    prefsBtn.parentElement.style.display = 'none';
                }
            }
        } else {
            deskLabel.textContent = 'Desktop';
            if (deskBtn) deskBtn.style.pointerEvents = 'none';
            if (appMenu) appMenu.style.display = 'none';
            if (closeAppBtn) closeAppBtn.textContent = 'Quit';
            if (prefsBtn) prefsBtn.parentElement.style.display = 'none';
        }
    }

    updateTaskbar() {
        // Collect existing task items
        const currentTaskItems = Array.from(this.taskbar.querySelectorAll('.gos-taskbar-item'));
        const existingIds = new Set(this.windows.map(w => w.id));

        // Mark items for removal that are not in the current windows list
        currentTaskItems.forEach(item => {
            const id = item.getAttribute('data-win-id');
            if (!existingIds.has(id) && !item.classList.contains('removing')) {
                item.classList.add('removing');
                setTimeout(() => item.remove(), 300);
            }
        });

        this.windows.forEach(win => {
            let task = this.taskbar.querySelector(`.gos-taskbar-item[data-win-id="${win.id}"]`);

            if (!task) {
                task = document.createElement('div');
                task.className = 'gos-taskbar-item mounting';
                task.setAttribute('data-win-id', win.id);
                task.innerHTML = `
                    <i class="${getFullIcon(win.icon)}"></i>
                    <span>${win.title}</span>
                `;
                task.onclick = () => {
                    if (this.activeWindow && this.activeWindow.id === win.id) {
                        this.minimizeWindow(win.id);
                    } else {
                        this.focusWindow(win.id);
                    }
                };
                task.oncontextmenu = (e) => {
                    e.preventDefault();
                    win.showSysMenu(e.clientX, e.clientY);
                };
                this.taskbar.appendChild(task);

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        task.classList.remove('mounting');
                    });
                });
            }

            if (this.activeWindow && this.activeWindow.id === win.id) {
                task.classList.add('active');
                // Ensure active item is visible in scrolled taskbar
                task.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            } else {
                task.classList.remove('active');
            }
        });
    }

    makeDraggable(win, header) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let startX = 0, startY = 0;
        let isDragging = false;
        let draggingMaximized = false;

        const startDragging = (clientX, clientY) => {
            startX = clientX;
            startY = clientY;
            isDragging = false;
            draggingMaximized = win.dataset.maximized === 'true';
            pos3 = clientX;
            pos4 = clientY;
        };

        const moveDragging = (clientX, clientY) => {
            // Threshold check before starting actual drag logic
            if (!isDragging) {
                const dx = clientX - startX;
                const dy = clientY - startY;
                if (dx * dx + dy * dy < 25) return; // 5px threshold squared

                isDragging = true;
                if (draggingMaximized) {
                    const oldW = parseFloat(win.dataset.oldWidth);
                    const mouseXRatio = clientX / window.innerWidth;
                    const newLeft = clientX - (oldW * mouseXRatio);

                    this.toggleMaximize(win);
                    win.style.left = newLeft + 'px';
                    win.style.top = clientY + 'px';

                    pos3 = clientX;
                    pos4 = clientY;
                }
                win.classList.add('dragging');
            }

            pos1 = pos3 - clientX;
            pos2 = pos4 - clientY;
            pos3 = clientX;
            pos4 = clientY;
            win.style.top = (win.offsetTop - pos2) + "px";
            win.style.left = (win.offsetLeft - pos1) + "px";

            this.updateSnapPreview(clientX, clientY);
        };

        const endDragging = () => {
            if (isDragging) {
                win.classList.remove('dragging');
                this.handleSnap(win, pos3, pos4);
                this.snapPreview.classList.remove('visible');
            }
        };

        header.onmousedown = (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.gos-win-btn') || e.target.closest('.gos-win-icon')) return;
            e.preventDefault();
            startDragging(e.clientX, e.clientY);
            document.onmousemove = (e) => moveDragging(e.clientX, e.clientY);
            document.onmouseup = () => {
                endDragging();
                document.onmouseup = null;
                document.onmousemove = null;
            };
            this.focusWindow(win.id);
        };

        header.ontouchstart = (e) => {
            if (e.target.closest('.gos-win-btn') || e.target.closest('.gos-win-icon')) return;
            const touch = e.touches[0];
            startDragging(touch.clientX, touch.clientY);
            this.focusWindow(win.id);
        };

        header.ontouchmove = (e) => {
            if (!startX) return;
            const touch = e.touches[0];
            moveDragging(touch.clientX, touch.clientY);
        };

        header.ontouchend = () => {
            endDragging();
            startX = null;
        };
    }


    updateSnapPreview(x, y) {
        const threshold = 10;
        const mbarHeight = document.getElementById('menubar').offsetHeight;
        const taskbarHeight = document.getElementById('taskbar').offsetHeight;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const availableH = h - mbarHeight - taskbarHeight;

        const isSnappingEnabled = registry.get('system.windowSnapping', true);
        if (!isSnappingEnabled) {
            this.snapPreview.classList.remove('visible');
            return;
        }

        if (y < mbarHeight + threshold) {
            // Top - Maximize
            this.showSnapPreview(0, mbarHeight, w, availableH);
        } else if (x < threshold) {
            // Left - Half
            this.showSnapPreview(0, mbarHeight, w / 2, availableH);
        } else if (x > w - threshold) {
            // Right - Half
            this.showSnapPreview(w / 2, mbarHeight, w / 2, availableH);
        } else {
            this.snapPreview.classList.remove('visible');
        }
    }

    showSnapPreview(x, y, w, h) {
        this.snapPreview.style.left = x + 'px';
        this.snapPreview.style.top = y + 'px';
        this.snapPreview.style.width = w + 'px';
        this.snapPreview.style.height = h + 'px';
        this.snapPreview.classList.add('visible');
    }

    handleSnap(win, x, y) {
        const threshold = 10;
        const mbarHeight = document.getElementById('menubar').offsetHeight;
        const taskbarHeight = document.getElementById('taskbar').offsetHeight;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const availableH = h - mbarHeight - taskbarHeight;

        const isSnappingEnabled = registry.get('system.windowSnapping', true);
        if (!isSnappingEnabled) {
            win.classList.remove('no-transition');
            return;
        }

        win.classList.add('no-transition');

        if (y < mbarHeight + threshold) {
            // Top - Maximize
            win.dataset.oldWidth = win.style.width;
            win.dataset.oldHeight = win.style.height;
            win.dataset.oldLeft = win.style.left;
            win.dataset.oldTop = win.style.top;

            win.style.width = '100%';
            win.style.height = availableH + 'px';
            win.style.left = '0';
            win.style.top = mbarHeight + 'px';
            win.dataset.maximized = 'true';
        } else if (x < threshold) {
            // Left - Half
            win.style.width = (w / 2) + 'px';
            win.style.height = availableH + 'px';
            win.style.left = '0';
            win.style.top = mbarHeight + 'px';
            win.dataset.maximized = 'false';
        } else if (x > w - threshold) {
            // Right - Half
            win.style.width = (w / 2) + 'px';
            win.style.height = availableH + 'px';
            win.style.left = (w / 2) + 'px';
            win.style.top = mbarHeight + 'px';
            win.dataset.maximized = 'false';
        }

        win.offsetHeight; // Force reflow
        win.classList.remove('no-transition');
    }

    makeResizable(win, resizer, type) {
        const startResize = (clientX, clientY) => {
            win.classList.add('resizing');
            const rect = win.getBoundingClientRect();
            const startWidth = rect.width;
            const startHeight = rect.height;
            const startX = clientX;
            const startY = clientY;

            const moveResize = (x, y) => {
                if (type.includes('r')) {
                    win.style.width = (startWidth + x - startX) + 'px';
                }
                if (type.includes('b')) {
                    win.style.height = (startHeight + y - startY) + 'px';
                }
            };

            const stopResize = () => {
                win.classList.remove('resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', stopResize);
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('touchend', stopResize);
            };

            const onMouseMove = (e) => moveResize(e.clientX, e.clientY);
            const onTouchMove = (e) => moveResize(e.touches[0].clientX, e.touches[0].clientY);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', stopResize);
            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', stopResize);
        };

        resizer.onmousedown = (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startResize(e.clientX, e.clientY);
        };

        resizer.ontouchstart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            startResize(touch.clientX, touch.clientY);
        };
    }
}

const wm = new WindowManager();
