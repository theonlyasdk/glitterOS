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
