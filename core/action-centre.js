// ── Action Centre ────────────────────────────────────────────────────────────
const _ac = document.getElementById('action-centre');
const _acOverlay = document.getElementById('action-centre-overlay');
const _acDateLabel = document.getElementById('ac-date-label');

function toggleActionCentre() {
    _ac.classList.contains('open') ? closeActionCentre() : openActionCentre();
}

function openActionCentre() {
    const now = new Date();
    _acDateLabel.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
    });
    _acOverlay.style.display = 'block';
    _ac.classList.add('open');
    document.getElementById('action-centre-btn').classList.add('lde-mbar-item-highlight');
}

function closeActionCentre() {
    _ac.classList.remove('open');
    _acOverlay.style.display = 'none';
    document.getElementById('action-centre-btn').classList.remove('lde-mbar-item-highlight');
}

// ── Tilt / ripple utilities (shared by tiles and icon buttons) ────────────────
function applyTiltPress(elem, e) {
    const rect = elem.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const rotY = (relX - 0.5) * 30;
    const rotX = -(relY - 0.5) * 30;
    elem.style.transform = `perspective(500px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.93)`;
}

function resetTilt(elem) { elem.style.transform = ''; }

function spawnRipple(elem, e) {
    const rect = elem.getBoundingClientRect();
    const ripple = document.createElement('div');
    ripple.className = 'lde-ac-tile-ripple';
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top = (e.clientY - rect.top) + 'px';
    elem.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

// ── Tiles: live-tracking tilt + spotlight glow ────────────────────────────────
_ac.querySelectorAll('.lde-ac-tile').forEach(tile => {
    let _pressing = false;

    tile.addEventListener('mousedown', (e) => {
        _pressing = true;
        applyTiltPress(tile, e);
        spawnRipple(tile, e);
    });
    tile.addEventListener('mouseup', () => { _pressing = false; resetTilt(tile); });
    tile.addEventListener('mouseleave', () => { _pressing = false; resetTilt(tile); });

    tile.addEventListener('mousemove', (e) => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty('--glow-x', (e.clientX - r.left) + 'px');
        tile.style.setProperty('--glow-y', (e.clientY - r.top) + 'px');
        if (_pressing) applyTiltPress(tile, e); // live tilt tracking
    });

    tile.addEventListener('click', () => tile.classList.toggle('active'));
});

// ── Icon tile buttons: live tilt + glow ──────────────────────────────────
_ac.querySelectorAll('.lde-ac-icon-tile').forEach(btn => {
    let _pressing = false;

    btn.addEventListener('mousedown', (e) => { _pressing = true; applyTiltPress(btn, e); });
    btn.addEventListener('mouseup', () => { _pressing = false; resetTilt(btn); });
    btn.addEventListener('mouseleave', () => { _pressing = false; resetTilt(btn); });

    btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--glow-x', (e.clientX - r.left) + 'px');
        btn.style.setProperty('--glow-y', (e.clientY - r.top) + 'px');
        if (_pressing) applyTiltPress(btn, e);
    });
});

// ── Slider fill sync ──────────────────────────────────────────────────────────
function updateSliderFill(slider) {
    const min = slider.min || 0;
    const max = slider.max || 100;
    const pct = ((slider.value - min) / (max - min)) * 100;
    slider.style.setProperty('--slider-fill', pct + '%');
}

document.querySelectorAll('.lde-ac-slider').forEach(slider => {
    updateSliderFill(slider);
    slider.addEventListener('input', () => updateSliderFill(slider));
});

// ── Volume mute toggle ────────────────────────────────────────────────────────
const _volBtn = document.getElementById('ac-vol-btn');
const _volSlider = document.getElementById('ac-vol-slider');
let _volLastValue = _volSlider.value;

_volBtn.addEventListener('click', () => {
    if (_volSlider.value > 0) {
        _volLastValue = _volSlider.value;
        _volSlider.value = 0;
        _volBtn.querySelector('i').className = 'bi bi-volume-mute-fill';
        _volBtn.classList.add('active');
    } else {
        _volSlider.value = _volLastValue;
        _volBtn.querySelector('i').className = 'bi bi-volume-up-fill';
        _volBtn.classList.remove('active');
    }
    updateSliderFill(_volSlider);
});

// ── Brightness toggle ─────────────────────────────────────────────────────────
const _brightBtn = document.getElementById('ac-bright-btn');
const _brightSlider = document.getElementById('ac-bright-slider');
let _brightLastValue = _brightSlider.value;

_brightBtn.addEventListener('click', () => {
    if (_brightSlider.value > 0) {
        _brightLastValue = _brightSlider.value;
        _brightSlider.value = 0;
        _brightBtn.classList.add('active');
    } else {
        _brightSlider.value = _brightLastValue;
        _brightBtn.classList.remove('active');
    }
    updateSliderFill(_brightSlider);
});
