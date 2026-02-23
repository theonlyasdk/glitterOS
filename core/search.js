// ── App Search Panel ──────────────────────────────────────────────────────────
const _searchPanel = document.getElementById('search-panel');
const _searchOverlay = document.getElementById('search-overlay');
const _searchBtn = document.getElementById('search-btn');
const _searchInput = document.getElementById('search-input');
const _appList = document.getElementById('app-list');

// ── Fuzzy match ───────────────────────────────────────────────────────────────
// Returns a score > 0 (higher = better match). 0 = no match.
function fuzzyScore(query, target) {
    if (!query) return 1;
    query = query.toLowerCase();
    target = target.toLowerCase();
    // Exact substring is best
    if (target.includes(query)) return 200 - target.indexOf(query);
    // Character-sequence fuzzy
    let qi = 0, score = 0, lastMatch = -1;
    for (let ti = 0; ti < target.length && qi < query.length; ti++) {
        if (target[ti] === query[qi]) {
            score += 10;
            if (lastMatch >= 0 && ti === lastMatch + 1) score += 5; // consecutive bonus
            lastMatch = ti;
            qi++;
        }
    }
    return qi === query.length ? score : 0; // 0 if not all query chars matched
}

// ── App definitions ───────────────────────────────────────────────────────────
const APPS = [
    { name: 'Command Prompt', icon: 'bi-terminal-fill', action: () => launchCommandPrompt() },
    { name: 'File Explorer', icon: 'bi-folder2-open', action: () => launchFileManager() },
    { name: 'Control Panel', icon: 'bi-sliders', action: () => launchControlPanel() },
    { name: 'Notepad', icon: 'bi-file-earmark-text', action: () => launchNotepad() },
    { name: 'Welcome Gallery', icon: 'bi-balloon-fill', action: () => launchWidgetGallery() }
];

// ── Build app list DOM ────────────────────────────────────────────────────────
APPS.forEach(app => {
    const item = document.createElement('div');
    item.className = 'lde-app-item';
    item.dataset.name = app.name.toLowerCase();
    item.innerHTML = `
		<div class="lde-app-item-icon">
			<i class="bi ${app.icon}"></i>
		</div>
		<span class="lde-app-item-name">${app.name}</span>
	`;

    // Spotlight glow
    item.addEventListener('mousemove', (e) => {
        const r = item.getBoundingClientRect();
        item.style.setProperty('--glow-x', (e.clientX - r.left) + 'px');
        item.style.setProperty('--glow-y', (e.clientY - r.top) + 'px');
    });
    // Tilt press
    item.addEventListener('mousedown', (e) => applyTiltPress(item, e));
    item.addEventListener('mouseup', () => resetTilt(item));
    item.addEventListener('mouseleave', () => resetTilt(item));

    item.addEventListener('click', () => {
        closeSearch();
        if (app.action) {
            app.action();
        } else {
            wm.createWindow(app.name, `<p style="padding:8px">${app.name}</p>`, { icon: app.icon });
        }
    });

    _appList.appendChild(item);
});

const _noResults = document.createElement('div');
_noResults.className = 'lde-search-no-results';
_noResults.textContent = 'No results found';
_appList.appendChild(_noResults);

// ── Fuzzy filter + keyboard navigation ───────────────────────────────────────
let _focusedItem = null;

function setFocusedItem(item) {
    if (_focusedItem) _focusedItem.classList.remove('lde-app-item-focused');
    _focusedItem = item;
    if (_focusedItem) {
        _focusedItem.classList.add('lde-app-item-focused');
        _focusedItem.scrollIntoView({ block: 'nearest' });
    }
}

_searchInput.addEventListener('input', () => {
    const q = _searchInput.value.trim();
    const items = Array.from(_appList.querySelectorAll('.lde-app-item'));

    if (!q) {
        items.forEach(i => i.classList.remove('hidden'));
        _noResults.classList.remove('visible');
        setFocusedItem(null);
        return;
    }

    const scored = items.map(item => ({ el: item, score: fuzzyScore(q, item.dataset.name) }));
    scored.sort((a, b) => b.score - a.score);

    let firstVisible = null;
    scored.forEach(({ el, score }) => {
        const visible = score > 0;
        el.classList.toggle('hidden', !visible);
        if (visible && !firstVisible) firstVisible = el;
        _appList.insertBefore(el, _noResults);
    });

    _noResults.classList.toggle('visible', !firstVisible);
    setFocusedItem(firstVisible);
});

_searchInput.addEventListener('keydown', (e) => {
    const visibleItems = Array.from(_appList.querySelectorAll('.lde-app-item:not(.hidden)'));
    if (!visibleItems.length) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        const target = _focusedItem || visibleItems[0];
        if (target) target.click();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = visibleItems.indexOf(_focusedItem);
        setFocusedItem(visibleItems[Math.min(idx + 1, visibleItems.length - 1)]);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = visibleItems.indexOf(_focusedItem);
        setFocusedItem(visibleItems[Math.max(idx - 1, 0)]);
    }
});

// ── Open / close ──────────────────────────────────────────────────────────────
function toggleSearch() {
    _searchPanel.classList.contains('open') ? closeSearch() : openSearch();
}

function openSearch() {
    _searchPanel.classList.add('open');
    _searchOverlay.classList.add('visible');
    _searchBtn.classList.add('active');
    _searchInput.value = '';
    // Reset list order and visibility
    const items = Array.from(_appList.querySelectorAll('.lde-app-item'));
    items.forEach(i => { i.classList.remove('hidden'); _appList.insertBefore(i, _noResults); });
    _noResults.classList.remove('visible');
    setTimeout(() => _searchInput.focus(), 60);
}

function closeSearch() {
    _searchPanel.classList.remove('open');
    _searchOverlay.classList.remove('visible');
    _searchBtn.classList.remove('active');
    setFocusedItem(null);
}

_searchOverlay.addEventListener('click', closeSearch);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _searchPanel.classList.contains('open')) closeSearch();
});
