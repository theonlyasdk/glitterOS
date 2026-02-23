// ── Aero Window Switcher (Shift+Tab) ─────────────────────────────────────────

(() => {
    // Create overlay + switcher container once
    const overlay = document.createElement('div');
    overlay.className = 'lde-switcher-overlay';
    document.body.appendChild(overlay);

    const switcher = document.createElement('div');
    switcher.className = 'lde-switcher';
    document.body.appendChild(switcher);

    let _active = false;
    let _selectedIdx = 0;
    let _thumbs = []; // ordered thumb elements
    let _winList = []; // ordered winObj references

    // ── Build / rebuild thumbnails ────────────────────────────────────────────
    function buildThumbs() {
        switcher.innerHTML = '';
        _thumbs = [];
        _winList = [];

        // Include all windows
        const visible = wm.windows.filter(w => !!w.element);

        if (visible.length === 0) return;

        _winList = visible;

        // Find the active window index to pre-select the *next* one
        const activeIdx = visible.findIndex(w => w === wm.activeWindow);
        _selectedIdx = visible.length > 1 ? (activeIdx + 1) % visible.length : 0;

        visible.forEach((winObj, i) => {
            const card = document.createElement('div');
            card.className = 'lde-switcher-thumb';
            card.style.animationDelay = (i * 0.04) + 's';

            // Preview box
            const preview = document.createElement('div');
            preview.className = 'lde-switcher-preview';

            // Clone the window body scaled down
            const body = winObj.element.querySelector('.lde-win-body');
            if (body) {
                const clone = body.cloneNode(true);
                const bodyW = body.offsetWidth || 400;
                const bodyH = body.offsetHeight || 300;
                const scaleX = 178 / bodyW;
                const scaleY = 108 / bodyH;
                const scale = Math.min(scaleX, scaleY);
                clone.style.transform = `scale(${scale})`;
                clone.style.width = bodyW + 'px';
                clone.style.height = bodyH + 'px';
                clone.style.overflow = 'hidden';
                clone.style.position = 'relative';
                clone.style.pointerEvents = 'none';
                preview.appendChild(clone);
            }

            // Label
            const label = document.createElement('div');
            label.className = 'lde-switcher-label';
            label.innerHTML = `<i class="bi ${winObj.icon || 'bi-window'}"></i><span>${winObj.title}</span>`;

            card.appendChild(preview);
            card.appendChild(label);

            // Click to select + close switcher
            card.addEventListener('click', () => {
                _selectedIdx = i;
                activateSelected();
                closeSwitcher();
            });

            switcher.appendChild(card);
            _thumbs.push(card);
        });

        updateSelection();
    }

    function updateSelection() {
        _thumbs.forEach((t, i) => t.classList.toggle('selected', i === _selectedIdx));
    }

    // ── Save & restore window positions during switcher ───────────────────────
    let _savedPositions = [];

    function saveWindowPositions() {
        if (_savedPositions.length > 0) return;
        _savedPositions = wm.windows.map(w => ({
            el: w.element,
            left: w.element.style.left,
            top: w.element.style.top,
            width: w.element.style.width,
            height: w.element.style.height,
            zIndex: w.element.style.zIndex,
            transform: w.element.style.transform,
            transition: w.element.style.transition,
            opacity: w.element.style.opacity,
            display: w.element.style.display,
        }));
    }

    function hideWindowsForSwitcher() {
        wm.windows.forEach(w => {
            w.element.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.1,0.9,0.2,1)';
            w.element.style.opacity = '0';
            w.element.style.transform = 'scale(0.92)';
            w.element.style.pointerEvents = 'none';
        });
    }

    let _restoreTimeout = null;

    function restoreWindowPositions() {
        _savedPositions.forEach(saved => {
            saved.el.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.1,0.9,0.2,1)';
            saved.el.style.opacity = saved.opacity || '1';
            saved.el.style.transform = saved.transform || '';
            saved.el.style.pointerEvents = '';
        });

        if (_restoreTimeout) clearTimeout(_restoreTimeout);

        // Clean up the inline transition after animation
        _restoreTimeout = setTimeout(() => {
            _savedPositions.forEach(saved => {
                saved.el.style.transition = saved.transition || '';
            });
            _savedPositions = [];
            _restoreTimeout = null;
        }, 400);
    }

    // ── Open / close ──────────────────────────────────────────────────────────
    function openSwitcher() {
        if (_active) return;
        if (wm.windows.length === 0) return;

        if (_restoreTimeout) {
            clearTimeout(_restoreTimeout);
            _restoreTimeout = null;
        }

        _active = true;
        document.body.classList.add('lde-switcher-active');

        saveWindowPositions();
        hideWindowsForSwitcher();

        buildThumbs();

        overlay.classList.add('active');
        switcher.classList.add('active');
    }

    function closeSwitcher() {
        if (!_active) return;
        _active = false;

        overlay.classList.remove('active');
        switcher.classList.remove('active');
        document.body.classList.remove('lde-switcher-active');

        restoreWindowPositions();
        activateSelected();

        // Clean up thumbs after transition
        setTimeout(() => { switcher.innerHTML = ''; }, 350);
    }

    function activateSelected() {
        if (_winList[_selectedIdx]) {
            wm.focusWindow(_winList[_selectedIdx].id);
        }
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Shift+Tab to toggle
        if (e.shiftKey && e.key === 'Tab') {
            e.preventDefault();

            if (!_active) {
                openSwitcher();
            } else {
                // Cycle forward
                _selectedIdx = (_selectedIdx + 1) % _winList.length;
                updateSelection();
            }
        }

        // Escape to cancel
        if (e.key === 'Escape' && _active) {
            e.preventDefault();
            closeSwitcher();
        }

        // Enter to confirm
        if (e.key === 'Enter' && _active) {
            e.preventDefault();
            closeSwitcher();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift' && _active) {
            closeSwitcher();
        }
    });

    // Also close on overlay click
    overlay.addEventListener('click', closeSwitcher);
})();
