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

// ── Tiles: live-tracking tilt + spotlight glow ────────────────────────────────
_ac.querySelectorAll('.lde-ac-tile').forEach(tile => {
    registerTileEffect(tile);
    tile.addEventListener('click', () => tile.classList.toggle('active'));
});

// ── Icon tile buttons: live tilt + glow ──────────────────────────────────
_ac.querySelectorAll('.lde-ac-icon-tile').forEach(btn => {
    // Only tilt and glow for sliders, no ripple usually (but registerTileEffect handles it)
    registerTileEffect(btn, { tilt: true, ripple: false, glow: true, liveTilt: true });
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
