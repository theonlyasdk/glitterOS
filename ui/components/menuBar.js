// ── Menubar hover navigation & desktop selection ─────────────────────────────

function gosInitMenubar() {
    let menuActive = false;
    const mbarItems = Array.from(document.querySelectorAll('.gos-mbar-item'))
        .filter(el => el.dataset.bsToggle === 'dropdown');

    mbarItems.forEach(item => {
        const dropdown = bootstrap.Dropdown.getOrCreateInstance(item);

        item.addEventListener('show.bs.dropdown', () => { menuActive = true; });

        item.addEventListener('shown.bs.dropdown', () => {
            if (item.title === "Calendar") renderCalendar(currentCalendarDate);
        });

        item.addEventListener('hide.bs.dropdown', () => {
            setTimeout(() => {
                if (!document.querySelector('.dropdown-menu.show')) menuActive = false;
            }, 100);
        });

        item.addEventListener('mouseenter', () => {
            if (menuActive) {
                const activeDropdown = document.querySelector('.dropdown-menu.show');
                if (activeDropdown && activeDropdown.parentElement !== item.parentElement) {
                    const activeBtn = activeDropdown.parentElement.querySelector('.gos-mbar-item');
                    if (activeBtn) bootstrap.Dropdown.getInstance(activeBtn).hide();
                    dropdown.show();
                }
            }
        });
    });

    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const activeDropdown = document.querySelector('.dropdown-menu.show');
            if (activeDropdown) {
                const activeBtn = activeDropdown.parentElement.querySelector('.gos-mbar-item');
                if (activeBtn) bootstrap.Dropdown.getInstance(activeBtn).hide();
            }
        });
    });
}

function gosInitDesktopSelection() {
    let selectionRect = null;
    let startX, startY;
    let isDragging = false;

    desktop.addEventListener('mousedown', (e) => {
        if (e.target !== desktop) return;
        startX = e.clientX;
        startY = e.clientY;
        isDragging = true;

        function onMouseMove(e) {
            if (!isDragging) return;

            // Clamping to desktop boundaries to prevent scroll expansion
            const rect = desktop.getBoundingClientRect();
            const currentX = Math.max(rect.left, Math.min(e.clientX, rect.right));
            const currentY = Math.max(rect.top, Math.min(e.clientY, rect.bottom));

            if (!selectionRect && (Math.abs(currentX - startX) > 2 || Math.abs(currentY - startY) > 2)) {
                selectionRect = document.createElement('div');
                selectionRect.className = 'gos-selection-rect';
                selectionRect.style.cssText = `left:${startX}px;top:${startY}px;width:0;height:0`;
                desktop.appendChild(selectionRect);
            }

            if (selectionRect) {
                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                selectionRect.style.left = left + 'px';
                selectionRect.style.top = top + 'px';
                selectionRect.style.width = Math.abs(startX - currentX) + 'px';
                selectionRect.style.height = Math.abs(startY - currentY) + 'px';
            }
        }

        function onMouseUp() {
            isDragging = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (selectionRect) {
                const r = selectionRect;
                r.style.opacity = '0';
                setTimeout(() => r.parentNode && r.parentNode.removeChild(r), 200);
                selectionRect = null;
            }
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });
}

/**
 * buildAppMenuBar - Creates a standardized menubar for applications
 */
function buildAppMenuBar() {
    const bar = document.createElement('div');
    bar.className = 'gos-app-menubar';

    let activeItem = null;
    let hoverEnabled = false;

    const closeAll = () => {
        if (activeItem) {
            activeItem.classList.remove('active');
            activeItem = null;
        }
        hoverEnabled = false;
        if (typeof PopupMenuManager !== 'undefined' && PopupMenuManager.closeSubmenus) {
            PopupMenuManager.closeSubmenus();
        }
    };

    const onClickOutside = (e) => {
        // Find if click is within the menubar, its dropdown, or any active submenu
        const isWithinMenu = bar.contains(e.target);
        const isWithinSubmenu = e.target.closest('.gos-context-submenu');
        
        if (!isWithinMenu && !isWithinSubmenu) {
            closeAll();
        }
    };

    document.addEventListener('mousedown', onClickOutside, true);

    bar._cleanup = () => {
        document.removeEventListener('mousedown', onClickOutside, true);
    };

    bar.createMenu = (label, items) => {
        const item = document.createElement('div');
        item.className = 'gos-app-menu-item';

        const lbl = document.createElement('span');
        lbl.textContent = label;
        item.appendChild(lbl);

        const dropdown = document.createElement('div');
        dropdown.className = 'gos-app-dropdown';

        items.forEach(menuItem => {
            if (menuItem.type === 'sep') {
                const sep = document.createElement('div');
                sep.className = 'gos-app-dropdown-sep';
                dropdown.appendChild(sep);
                return;
            }

            const el = document.createElement('div');
            el.className = 'gos-app-dropdown-item' + (menuItem.color === 'danger' || menuItem.color === '#f44336' ? ' danger' : '') + (menuItem.disabled ? ' disabled' : '');

            const iconStr = menuItem.icon ? `<i class="${menuItem.icon.startsWith('bi-') || menuItem.icon.startsWith('ri-') ? menuItem.icon : 'bi-' + menuItem.icon}"></i>` : '';
            const shortcutStr = menuItem.shortcut ? `<span class="shortcut">${menuItem.shortcut}</span>` : '';

            el.innerHTML = `${iconStr} <span style="flex:1; margin-left: ${menuItem.icon ? '8px' : '0'}">${menuItem.label}</span> ${shortcutStr}`;

            if (menuItem.hasSubmenu) {
                el.innerHTML += `<i class="bi bi-chevron-right ms-2" style="font-size:0.7rem; opacity:0.5;"></i>`;
            }

            el.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };

            el.onclick = (e) => {
                e.stopPropagation();
                if (menuItem.disabled) return;

                item.classList.add('item-clicked');
                el.classList.add('gos-dropdown-item-ghost');

                setTimeout(() => {
                    item.classList.remove('item-clicked');
                    el.classList.remove('gos-dropdown-item-ghost');
                    closeAll();
                    if (menuItem.action) menuItem.action();
                }, 300);
            };

            el.onmouseenter = (e) => {
                if (menuItem.hasSubmenu && menuItem.onMouseEnter) {
                    menuItem.onMouseEnter(e, el);
                } else {
                    if (typeof PopupMenuManager !== 'undefined' && PopupMenuManager.closeSubmenus) {
                        PopupMenuManager.closeSubmenus();
                    }
                }
            };

            dropdown.appendChild(el);
        });

        item.appendChild(dropdown);

        const toggleMenu = () => {
            if (item.classList.contains('active')) {
                closeAll();
            } else {
                closeAll();
                item.classList.add('active');
                activeItem = item;
                hoverEnabled = true;
            }
        };

        item.onmousedown = (e) => {
            e.stopPropagation();
            toggleMenu();
        };

        item.addEventListener('mouseenter', () => {
            if (hoverEnabled && activeItem && activeItem !== item) {
                toggleMenu();
            }
        });

        bar.appendChild(item);
    };

    bar.handleKey = (e) => {
        return false;
    };

    return bar;
}

window.gosInitMenubar = gosInitMenubar;
window.gosInitDesktopSelection = gosInitDesktopSelection;
window.buildAppMenuBar = buildAppMenuBar;
