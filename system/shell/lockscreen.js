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
    let wall = registry.get('personalization.lockscreenWallpaper', null);
    if (!wall) {
        wall = registry.get('personalization.wallpaper', 'res/wall.png');
    }
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

const finishUnlock = () => {
    _lockScreen.style.transition = 'transform 0.4s ease-out';
    _lockScreen.style.transform = 'translateY(-100%)';
    setTimeout(() => {
        _lockScreen.classList.remove('active');
        _lockScreen.style.transform = '';
        _lockScreen.style.transition = '';
        isDraggingLock = false;
    }, 400);
};

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
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
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
        setTimeout(() => { isDraggingLock = false; }, 100);
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
        const delta = startY - ev.changedTouches[0].clientY;
        if (delta > window.innerHeight / 4) {
            finishUnlock();
        } else {
            _lockScreen.style.transform = '';
            _lockScreen.style.transition = '';
        }
        _lockScreen.removeEventListener('touchmove', onTouchMove);
        _lockScreen.removeEventListener('touchend', onTouchEnd);
    };

    _lockScreen.addEventListener('touchmove', onTouchMove);
    _lockScreen.addEventListener('touchend', onTouchEnd);
}, { passive: true });
