// ── Lock Screen Logic ────────────────────────────────────────────────────────
const _lockScreen = document.getElementById('lock-screen');
const _lockTime = document.getElementById('lock-time');
const _lockDate = document.getElementById('lock-date');

function updateLockClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
    });

    if (_lockTime) _lockTime.textContent = timeStr;
    if (_lockDate) _lockDate.textContent = dateStr;
}

setInterval(updateLockClock, 1000);
updateLockClock();

function lockScreen() {
    // Hide search and action centre if open
    if (typeof closeSearch === 'function') closeSearch();
    if (typeof closeActionCentre === 'function') closeActionCentre();

    // Set background to current wallpaper
    const wall = registry.get('personalization.wallpaper', 'res/wall.png');
    _lockScreen.style.backgroundImage = `url("${wall}")`;

    _lockScreen.classList.add('active');
    _lockScreen.focus();
}

function unlockScreen() {
    _lockScreen.classList.remove('active');
}

// ── Interactivity ─────────────────────────────────────────────────────────────

// Key press to unlock
window.addEventListener('keydown', (e) => {
    if (_lockScreen.classList.contains('active')) {
        e.preventDefault();
        unlockScreen();
    }
});

// Click to unlock (fallback for no keyboard)
_lockScreen.addEventListener('click', (e) => {
    // Only if it's not a drag
    if (!isDraggingLock) unlockScreen();
});

// Swipe up to unlock
let startY = 0;
let isDraggingLock = false;

_lockScreen.addEventListener('mousedown', (e) => {
    startY = e.clientY;
    isDraggingLock = false;

    const onMouseMove = (ev) => {
        const delta = startY - ev.clientY;
        if (delta > 20) {
            isDraggingLock = true;
            _lockScreen.style.transition = 'none';
            _lockScreen.style.transform = `translateY(-${delta}px)`;
        }

        if (delta > window.innerHeight / 3) {
            finishUnlock();
        }
    };

    const onMouseUp = (ev) => {
        _lockScreen.style.transition = '';
        const delta = startY - ev.clientY;
        if (delta > window.innerHeight / 3) {
            finishUnlock();
        } else {
            _lockScreen.style.transform = '';
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // Delay resetting isDraggingLock so click event doesn't trigger immediately
        setTimeout(() => { isDraggingLock = false; }, 100);
    };

    const finishUnlock = () => {
        _lockScreen.style.transition = 'transform 0.4s ease-out';
        _lockScreen.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            _lockScreen.classList.remove('active');
            _lockScreen.style.transform = '';
            _lockScreen.style.transition = '';
        }, 400);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

// Touch support
_lockScreen.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    isDraggingLock = false;

    const onTouchMove = (ev) => {
        const delta = startY - ev.touches[0].clientY;
        if (delta > 10) {
            isDraggingLock = true;
            _lockScreen.style.transition = 'none';
            _lockScreen.style.transform = `translateY(-${delta}px)`;
        }
    };

    const onTouchEnd = (ev) => {
        _lockScreen.style.transition = '';
        const delta = startY - ev.changedTouches[0].clientY;
        if (delta > window.innerHeight / 4) {
            _lockScreen.style.transform = 'translateY(-100%)';
            setTimeout(() => _lockScreen.classList.remove('active'), 300);
        } else {
            _lockScreen.style.transform = '';
        }
    };

    _lockScreen.addEventListener('touchmove', onTouchMove);
    _lockScreen.addEventListener('touchend', onTouchEnd);
}, { passive: true });
