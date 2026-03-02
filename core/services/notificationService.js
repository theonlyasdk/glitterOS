// ── Notification Service ─────────────────────────────────────────────────────
const NotificationService = (() => {
    const SERVICE_ID = 'NotificationService';
    const _notifications = [];
    let _idCounter = 1;

    function _emit() {
        if (typeof glidBus !== 'undefined') {
            glidBus.publish('notifications:updated', {
                notifications: NotificationService.list(),
                enabled: NotificationService.isEnabled()
            });
        }
    }

    function _remove(id) {
        const idx = _notifications.findIndex(n => n.id === id);
        if (idx >= 0) {
            _notifications.splice(idx, 1);
            _emit();
        }
    }

    const NotificationService = {
        SERVICE_ID,
        isEnabled() {
            const svc = typeof ServiceManager !== 'undefined' ? ServiceManager.get(SERVICE_ID) : null;
            return !!(svc && svc.running && !svc.disabled);
        },
        notify({ title, message, actions = [] }) {
            if (!this.isEnabled()) return { error: 'NotificationService disabled' };
            const item = {
                id: `notif-${Date.now()}-${_idCounter++}`,
                title: title || 'Notification',
                message: message || '',
                ts: Date.now(),
                actions: Array.isArray(actions) ? actions.slice(0, 3).map(a => ({
                    label: a.label || 'Action',
                    className: a.className || '',
                    onClick: typeof a.onClick === 'function' ? a.onClick : null
                })) : []
            };
            _notifications.unshift(item);
            _emit();
            return { ok: true, id: item.id };
        },
        dismiss(id) {
            _remove(id);
        },
        clearAll() {
            _notifications.length = 0;
            _emit();
        },
        list() {
            return [..._notifications];
        },
        triggerAction(id, actionIndex) {
            const notif = _notifications.find(n => n.id === id);
            if (!notif) return;
            const action = notif.actions[actionIndex];
            if (!action) return;
            try {
                if (action.onClick) action.onClick(notif);
            } catch (e) {
                if (typeof SysLog !== 'undefined') SysLog.error(`Notification action failed: ${String(e)}`);
            }
        }
    };

    if (typeof ServiceManager !== 'undefined') {
        ServiceManager.register({
            id: SERVICE_ID,
            name: 'NotificationService',
            description: 'System notifications and action center stack',
            type: 'System Service',
            autoStart: true,
            onStop: () => {
                _emit();
            },
            onStart: () => {
                _emit();
            }
        });
    }

    return NotificationService;
})();

window.NotificationService = NotificationService;
