// ── Action Centre ────────────────────────────────────────────────────────────
const _ac = document.getElementById('action-centre');
const _acOverlay = document.getElementById('action-centre-overlay');
const _acNotifStack = document.getElementById('ac-notification-stack');
const _acServiceWarning = document.getElementById('ac-service-warning');
const _acServiceRestartBtn = document.getElementById('ac-service-restart-btn');
const _acClearNotificationsBtn = document.getElementById('ac-clear-notifications-btn');
let _acToastContainer = null;
const _renderedToasts = new Set();

function ensureToastContainer() {
    if (_acToastContainer) return _acToastContainer;
    _acToastContainer = document.createElement('div');
    _acToastContainer.className = 'gos-notification-toaster';
    document.body.appendChild(_acToastContainer);
    return _acToastContainer;
}

function layoutToastStack() {
    const wrap = ensureToastContainer();
    const toasts = Array.from(wrap.children); // [newest, ..., oldest]
    
    // Reset all styles
    toasts.forEach((t) => {
        t.classList.remove('stacked');
        t.classList.remove('hidden-stack');
        t.style.removeProperty('position');
        t.style.removeProperty('bottom');
        t.style.removeProperty('margin-top');
        t.style.removeProperty('transform');
        t.style.removeProperty('z-index');
        t.style.removeProperty('opacity');
        t.style.removeProperty('width');
    });

    const wrapRect = wrap.getBoundingClientRect();
    const availableHeight = wrapRect.height;
    
    let currentY = 0;
    let stackStartIdx = -1;

    // Identify where the stack should start
    for (let i = 0; i < toasts.length; i++) {
        const toast = toasts[i];
        const h = toast.getBoundingClientRect().height;
        
        if (currentY + h > availableHeight) {
            stackStartIdx = i;
            break;
        }
        currentY += h + 8; // 8 is gap
    }

    if (stackStartIdx === -1) return;

    // Stack items that reached the bottom
    const stackedItems = toasts.slice(stackStartIdx); // [newer, ..., oldest]
    const numStacked = stackedItems.length;
    const oldestIdx = numStacked - 1;

    // Adaptive factors: reduce shift as more items stack
    const maxStackHeight = availableHeight * 0.5; 
    const adaptiveShift = Math.min(32, maxStackHeight / Math.max(1, numStacked));

    stackedItems.forEach((toast, idx) => {
        toast.style.setProperty('position', 'absolute', 'important');
        toast.style.setProperty('bottom', '0', 'important');
        toast.style.setProperty('width', '100%', 'important');
        toast.style.setProperty('box-sizing', 'border-box', 'important');
        
        // depth 0 = oldest (front), depth N = newest (back)
        const depth = oldestIdx - idx;
        
        // Oldest is visually on top (Z-index priority)
        toast.style.setProperty('z-index', (2000 - depth).toString(), 'important');
        
        // Newer cards shift UP to peek out (fanning effect), NO SCALE
        const translateY = -(depth * adaptiveShift);
        
        toast.style.setProperty('transform-origin', 'bottom center', 'important');
        toast.style.setProperty('transform', `translateY(${translateY}px)`, 'important');
        toast.classList.add('stacked');
        
        if (depth > 20) {
            toast.classList.add('hidden-stack');
        }
    });
}

function createNotificationNode(n, isToast = false) {
    const card = document.createElement('div');
    card.className = isToast ? 'gos-notification-toast' : 'gos-ac-notification';

    const title = document.createElement('div');
    title.className = 'gos-ac-notification-title';
    title.textContent = n.title;

    const body = document.createElement('div');
    body.className = 'gos-ac-notification-body';
    body.textContent = n.message;

    const time = document.createElement('div');
    time.className = 'gos-ac-notification-time';
    time.textContent = formatNotificationTime(n.ts);

    card.append(title, body);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'gos-ac-notification-close';
    closeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof NotificationService !== 'undefined') NotificationService.dismiss(n.id);
        if (isToast) {
            card.classList.add('closing');
            setTimeout(() => {
                card.remove();
                layoutToastStack();
            }, 520);
        }
    };
    card.appendChild(closeBtn);

    const actionsList = Array.isArray(n.actions) ? n.actions.slice(0, 3) : [];
    if (actionsList.length > 0) {
        const actions = document.createElement('div');
        actions.className = 'gos-ac-notification-actions';
        actionsList.forEach((a, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = a.className || '';
            btn.textContent = a.label || 'Action';
            btn.onclick = (e) => {
                e.stopPropagation();
                NotificationService.triggerAction(n.id, idx);
                if (isToast) {
                    card.classList.add('closing');
                    setTimeout(() => {
                        card.remove();
                        layoutToastStack();
                    }, 520);
                }
            };
            if (typeof Widgets !== 'undefined') {
                Widgets.registerTileEffect(btn, { tilt: true, ripple: true, glow: true, liveTilt: true });
            }
            actions.appendChild(btn);
        });
        card.appendChild(actions);
    }

    card.appendChild(time);

    if (typeof Widgets !== 'undefined') {
        Widgets.registerTileEffect(card, { tilt: true, ripple: true, glow: true, liveTilt: true });
    }

    return card;
}

function showToast(n) {
    const wrap = ensureToastContainer();
    const existing = Array.from(wrap.children);
    const before = new Map(existing.map(el => [el, el.getBoundingClientRect()]));
    
    const toast = createNotificationNode(n, true);
    toast.classList.add('entering');
    wrap.prepend(toast);
    
    // Update stacking logic immediately so that the FLIP animation below
    // picks up the NEW target positions (even if they are now absolute/stacked)
    layoutToastStack();

    requestAnimationFrame(() => {
        existing.forEach((el) => {
            const first = before.get(el);
            if (!first) return;
            const last = el.getBoundingClientRect();
            const deltaY = first.top - last.top;
            if (!deltaY) return;
            
            // Capture the target transform set by layoutToastStack
            const targetTransform = el.style.transform || '';
            
            el.style.transition = 'none';
            // Animate from (old position) to (new position + any stack offset)
            el.style.transform = `translateY(${deltaY}px) ${targetTransform}`.trim();
            el.offsetHeight; // force reflow
            el.style.transition = 'transform 0.5s cubic-bezier(0.1, 0.9, 0.2, 1), margin-top 0.5s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.5s cubic-bezier(0.1, 0.9, 0.2, 1)';
            el.style.transform = targetTransform;
        });
    });

    setTimeout(() => {
        toast.classList.remove('entering');
        // Final refresh to ensure everything is settled
        layoutToastStack();
    }, 520);

    const dismiss = () => {
        toast.classList.add('closing');
        setTimeout(() => {
            toast.remove();
            layoutToastStack();
        }, 520);
    };
    toast.addEventListener('click', () => {
        NotificationService.dismiss(n.id);
        dismiss();
    });
    setTimeout(() => {
        if (document.body.contains(toast)) dismiss();
    }, 5500);
}

function formatNotificationTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function renderServiceWarning() {
    if (!_acServiceWarning || typeof ServiceManager === 'undefined') return;
    const svc = ServiceManager.get('NotificationService');
    const disabled = !svc || !svc.running || svc.disabled;
    _acServiceWarning.style.display = disabled ? 'block' : 'none';
}

function renderNotifications() {
    if (!_acNotifStack || typeof NotificationService === 'undefined') return;
    const items = NotificationService.list();
    _acNotifStack.innerHTML = '';

    if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'gos-ac-notification-empty';
        empty.textContent = 'No new notifications';
        _acNotifStack.appendChild(empty);
        return;
    }

    items.forEach((n) => {
        const card = createNotificationNode(n, false);
        _acNotifStack.appendChild(card);
    });
}

function toggleActionCentre() {
    _ac.classList.contains('open') ? closeActionCentre() : openActionCentre();
}

function openActionCentre() {
    _acOverlay.style.display = 'block';
    _ac.classList.add('open');
    document.getElementById('action-centre-btn').classList.add('gos-mbar-item-highlight');
    renderServiceWarning();
    renderNotifications();
}

function closeActionCentre() {
    _ac.classList.remove('open');
    _acOverlay.style.display = 'none';
    document.getElementById('action-centre-btn').classList.remove('gos-mbar-item-highlight');
}

// ── Tiles: live-tracking tilt + spotlight glow ────────────────────────────────
_ac.querySelectorAll('.gos-ac-tile').forEach(tile => {
    Widgets.registerTileEffect(tile);
    tile.addEventListener('click', () => tile.classList.toggle('active'));
});

// ── Icon tile buttons: live tilt + glow ──────────────────────────────────
_ac.querySelectorAll('.gos-ac-icon-tile').forEach(btn => {
    // Only tilt and glow for sliders, no ripple usually (but registerTileEffect handles it)
    Widgets.registerTileEffect(btn, { tilt: true, ripple: false, glow: true, liveTilt: true });
});

// ── Slider fill sync ──────────────────────────────────────────────────────────
function updateSliderFill(slider) {
    const min = slider.min || 0;
    const max = slider.max || 100;
    const pct = ((slider.value - min) / (max - min)) * 100;
    slider.style.setProperty('--slider-fill', pct + '%');
}

document.querySelectorAll('.gos-ac-slider').forEach(slider => {
    updateSliderFill(slider);
    slider.addEventListener('input', () => updateSliderFill(slider));
});

// ── Volume mute toggle ────────────────────────────────────────────────────────
const _volBtn = document.getElementById('ac-vol-btn');
const _volSlider = document.getElementById('ac-vol-slider');
let _volLastValue = _volSlider.value;

function syncVolUI() {
    const val = parseInt(_volSlider.value);
    if (val === 0) {
        _volBtn.querySelector('i').className = 'ri-volume-mute-line';
        _volBtn.classList.add('active');
    } else {
        _volBtn.querySelector('i').className = 'ri-volume-up-line';
        _volBtn.classList.remove('active');
    }
}

_volBtn.addEventListener('click', () => {
    if (_volSlider.value > 0) {
        _volLastValue = _volSlider.value;
        _volSlider.value = 0;
    } else {
        _volSlider.value = _volLastValue || 75;
    }
    syncVolUI();
    updateSliderFill(_volSlider);
});

_volSlider.addEventListener('input', () => {
    syncVolUI();
});

// ── Brightness toggle ─────────────────────────────────────────────────────────
const _brightBtn = document.getElementById('ac-bright-btn');
const _brightSlider = document.getElementById('ac-bright-slider');
let _brightLastValue = _brightSlider.value;

function syncBrightUI() {
    const val = parseInt(_brightSlider.value);
    if (val === 0) {
        _brightBtn.classList.add('active');
    } else {
        _brightBtn.classList.remove('active');
    }
}

_brightBtn.addEventListener('click', () => {
    if (_brightSlider.value > 0) {
        _brightLastValue = _brightSlider.value;
        _brightSlider.value = 0;
    } else {
        _brightSlider.value = _brightLastValue || 100;
    }
    syncBrightUI();
    updateSliderFill(_brightSlider);
});

_brightSlider.addEventListener('input', () => {
    syncBrightUI();
});

if (_acServiceRestartBtn) {
    _acServiceRestartBtn.addEventListener('click', () => {
        if (typeof ServiceManager !== 'undefined') {
            ServiceManager.restart('NotificationService');
            renderServiceWarning();
            renderNotifications();
        }
    });
}

if (_acClearNotificationsBtn) {
    _acClearNotificationsBtn.addEventListener('click', () => {
        if (typeof NotificationService === 'undefined') return;
        
        const stack = document.getElementById('ac-notification-stack');
        if (!stack) return;
        
        const items = Array.from(stack.querySelectorAll('.gos-ac-notification'));
        if (items.length === 0) return;

        // Animate from bottom to top (reverse order) with 10ms delay
        items.reverse().forEach((item, idx) => {
            setTimeout(() => {
                item.classList.add('clearing');
            }, idx * 10);
        });

        // Wait for last animation to finish then clear state
        setTimeout(() => {
            NotificationService.clearAll();
        }, (items.length * 10) + 400);
    });
}

if (typeof glidBus !== 'undefined') {
    glidBus.subscribe('notifications:updated', (payload) => {
        const list = (payload && payload.notifications) || [];
        list.forEach((n) => {
            if (_renderedToasts.has(n.id)) return;
            _renderedToasts.add(n.id);
            showToast(n);
        });
        const knownIds = new Set(list.map(n => n.id));
        Array.from(_renderedToasts).forEach((id) => {
            if (!knownIds.has(id)) _renderedToasts.delete(id);
        });
        renderServiceWarning();
        renderNotifications();
    });
    glidBus.subscribe('service:changed', () => {
        renderServiceWarning();
    });
}

renderServiceWarning();
renderNotifications();
window.addEventListener('resize', () => {
    if (_acToastContainer) layoutToastStack();
});
