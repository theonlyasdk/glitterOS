/**
 * Window Manager for glitterOS - Enhanced version
 */

class WindowManager {
    constructor() {
        this.windows = []; // Store window objects: { id, title, icon, element, zIndex }
        this.activeWindow = null;
        this.zIndexCounter = 100;
        this.desktop = document.getElementById('desktop');
        this.taskbar = document.getElementById('taskbar');

        // Unfocus active window when clicking the desktop background
        this.desktop.addEventListener('mousedown', (e) => {
            if (e.target === this.desktop) {
                this.unfocusActive();
            }
        });
    }

    unfocusActive() {
        if (this.activeWindow) {
            this.activeWindow.element.classList.remove('active');
            this.activeWindow = null;
            this.updateTaskbar();
        }
    }

    /**
     * Create a new window
     * @param {string} title 
     * @param {string|HTMLElement} content 
     * @param {object} options { x, y, width, height, icon }
     */
    createWindow(title, content, options = {}) {
        const id = 'win-' + Math.random().toString(36).substr(2, 9);
        const win = document.createElement('div');
        win.className = 'lde-window';
        win.id = id;
        win.style.left = (options.x || 100 + (this.windows.length * 20)) + 'px';
        win.style.top = (options.y || 50 + (this.windows.length * 20)) + 'px';
        win.style.width = (options.width || 400) + 'px';
        win.style.height = (options.height || 300) + 'px';
        win.style.zIndex = ++this.zIndexCounter;

        const header = document.createElement('div');
        header.className = 'lde-win-header';

        const titleElem = document.createElement('div');
        titleElem.className = 'lde-win-title';
        titleElem.innerHTML = `<span>${title}</span>`;

        const controls = document.createElement('div');
        controls.className = 'lde-win-controls';

        const minBtn = document.createElement('div');
        minBtn.className = 'lde-win-btn lde-win-btn-min';
        minBtn.innerHTML = '<i class="bi bi-dash-lg"></i>';
        minBtn.onclick = (e) => {
            e.stopPropagation();
            this.minimizeWindow(id);
        };

        const maxBtn = document.createElement('div');
        maxBtn.className = 'lde-win-btn lde-win-btn-max';
        maxBtn.innerHTML = '<i class="bi bi-app"></i>';
        maxBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMaximize(win);
        };

        const closeBtn = document.createElement('div');
        closeBtn.className = 'lde-win-btn lde-win-btn-close';
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
        iconElem.className = 'lde-win-icon';
        iconElem.innerHTML = `<i class="bi ${options.icon || 'bi-window-sidebar'}"></i>`;

        // System menu popup
        const sysMenu = document.createElement('div');
        sysMenu.className = 'lde-win-sysmenu';
        sysMenu.innerHTML = `
            ${!options.noControls ? `
                <div class="lde-win-sysmenu-item" data-action="restore"><span>Restore</span></div>
                <div class="lde-win-sysmenu-item" data-action="minimize"><span>Minimize</span></div>
                <div class="lde-win-sysmenu-item" data-action="maximize"><span>Maximize</span></div>
                <hr class="lde-win-sysmenu-divider">
            ` : ''}
            <div class="lde-win-sysmenu-item lde-win-sysmenu-close" data-action="close"><span>Close</span><span class="lde-sysmenu-shortcut">Alt+F4</span></div>
        `;
        sysMenu.querySelectorAll('.lde-win-sysmenu-item').forEach(item => {
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
            if (e.target.closest('.lde-win-btn') || e.target.closest('.lde-win-icon')) return;
            e.preventDefault();
            showSysMenu(e.clientX, e.clientY);
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
        body.className = 'lde-win-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }

        win.appendChild(header);
        win.appendChild(body);

        if (!options.noResize) {
            const resizers = ['r', 'b', 'rb'];
            resizers.forEach(r => {
                const resizer = document.createElement('div');
                resizer.className = `lde-win-resizer lde-win-resizer-${r}`;
                win.appendChild(resizer);
                this.makeResizable(win, resizer, r);
            });
        }

        this.desktop.appendChild(win);

        const winObj = {
            id: id,
            title: title,
            icon: options.icon || 'bi-window-sidebar',
            element: win,
            zIndex: win.style.zIndex,
            showSysMenu: showSysMenu
        };

        this.windows.push(winObj);
        this.makeDraggable(win, header);

        if (options.onClose) winObj.onClose = options.onClose;

        win.onmousedown = () => this.focusWindow(id);

        this.focusWindow(id);
        this.updateTaskbar();

        // Trigger opening animation
        win.classList.add('opening');
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

        const startW = parseFloat(win.style.width);
        const startH = parseFloat(win.style.height);
        const startL = parseFloat(win.style.left);
        const startT = parseFloat(win.style.top);

        const targetW = isMax ? parseFloat(win.dataset.oldWidth) : window.innerWidth;
        const targetH = isMax ? parseFloat(win.dataset.oldHeight) : window.innerHeight - mbarHeight - taskbarHeight;
        const targetL = isMax ? parseFloat(win.dataset.oldLeft) : 0;
        const targetT = isMax ? parseFloat(win.dataset.oldTop) : mbarHeight;

        // Snappy jump to 85%
        win.classList.add('no-transition');
        win.style.width = (startW + (targetW - startW) * 0.85) + 'px';
        win.style.height = (startH + (targetH - startH) * 0.85) + 'px';
        win.style.left = (startL + (targetL - startL) * 0.85) + 'px';
        win.style.top = (startT + (targetT - startT) * 0.85) + 'px';

        win.offsetHeight; // Reflow

        win.classList.remove('no-transition');
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
    }

    focusWindow(id) {
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
    }

    minimizeWindow(id) {
        const winObj = this.windows.find(w => w.id === id);
        if (!winObj) return;

        const win = winObj.element;
        const taskItem = document.querySelector(`.lde-taskbar-item[data-win-id="${id}"]`);

        if (taskItem) {
            const rect = taskItem.getBoundingClientRect();
            win.dataset.preMinLeft = win.style.left;
            win.dataset.preMinTop = win.style.top;
            win.dataset.preMinW = win.style.width;
            win.dataset.preMinH = win.style.height;

            win.style.left = (rect.left + rect.width / 2 - parseFloat(win.style.width) / 2) + 'px';
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
                this.focusWindow(topWin.id);
            }
        }
        this.updateTaskbar();
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
    }

    closeWindow(id) {
        const index = this.windows.findIndex(w => w.id === id);
        if (index === -1) return;

        const winObj = this.windows[index];
        const win = winObj.element;

        // Trigger window close animation
        win.classList.add('closing');

        // Find task item and trigger removal
        const taskItem = this.taskbar.querySelector(`.lde-taskbar-item[data-win-id="${id}"]`);
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

        if (winObj.onClose) winObj.onClose();
    }

    /**
     * Win32 style MessageBox in Dark Mode
     */
    messageBox(title, message, options = {}) {
        const container = document.createElement('div');
        container.className = 'lde-messagebox';

        const main = document.createElement('div');
        main.className = 'lde-messagebox-main';

        const icon = document.createElement('div');
        icon.className = 'lde-messagebox-icon';
        const iconName = options.icon || 'bi-info-circle-fill';
        icon.innerHTML = `<i class="bi ${iconName}"></i>`;

        const text = document.createElement('div');
        text.className = 'lde-messagebox-text';
        text.innerHTML = message;

        main.append(icon, text);

        const buttons = document.createElement('div');
        buttons.className = 'lde-messagebox-buttons';

        const createBtn = (lbl, callback, isDefault) => {
            const b = document.createElement('button');
            b.className = 'lde-msg-btn' + (isDefault ? ' default' : '');
            b.textContent = lbl;
            b.onclick = () => {
                wm.closeWindow(win.id);
                if (callback) callback();
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
            icon: options.icon || 'bi-info-circle-fill'
        });
        win.element.classList.add('lde-window-messagebox');
    }

    updateTaskbar() {
        // Collect existing task items
        const currentTaskItems = Array.from(this.taskbar.querySelectorAll('.lde-taskbar-item'));
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
            let task = this.taskbar.querySelector(`.lde-taskbar-item[data-win-id="${win.id}"]`);

            if (!task) {
                task = document.createElement('div');
                task.className = 'lde-taskbar-item mounting';
                task.setAttribute('data-win-id', win.id);
                task.innerHTML = `
                    <i class="bi ${win.icon}"></i>
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
            } else {
                task.classList.remove('active');
            }
        });
    }

    makeDraggable(win, header) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        header.onmousedown = (e) => {
            if (e.target.closest('.lde-win-btn')) return;

            e.preventDefault();

            if (win.dataset.maximized === 'true') {
                // Restore but keep under mouse
                const oldW = parseFloat(win.dataset.oldWidth);
                const mouseXRatio = e.clientX / window.innerWidth;
                const newLeft = e.clientX - (oldW * mouseXRatio);

                this.toggleMaximize(win);
                win.style.left = newLeft + 'px';
                win.style.top = e.clientY + 'px';
            }

            win.classList.add('dragging');
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = () => {
                win.classList.remove('dragging');
                document.onmouseup = null;
                document.onmousemove = null;
            };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                win.style.top = (win.offsetTop - pos2) + "px";
                win.style.left = (win.offsetLeft - pos1) + "px";
            };
            this.focusWindow(win.id);
        };
    }

    makeResizable(win, resizer, type) {
        resizer.onmousedown = (e) => {
            e.preventDefault();
            win.classList.add('resizing');
            const startWidth = parseFloat(getComputedStyle(win).width);
            const startHeight = parseFloat(getComputedStyle(win).height);
            const startX = e.clientX;
            const startY = e.clientY;

            const doResize = (e) => {
                if (type.includes('r')) {
                    win.style.width = (startWidth + e.clientX - startX) + 'px';
                }
                if (type.includes('b')) {
                    win.style.height = (startHeight + e.clientY - startY) + 'px';
                }
            };

            const stopResize = () => {
                win.classList.remove('resizing');
                document.removeEventListener('mousemove', doResize);
                document.removeEventListener('mouseup', stopResize);
            };

            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);
        };
    }
}

const wm = new WindowManager();

// Example window for testing
window.addEventListener('load', () => {
    launchWidgetGallery();
});
