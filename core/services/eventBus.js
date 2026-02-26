// ── gliterOS D-Bus (EventBus) ───────────────────────────────────────────────
const glidBus = (() => {
    const listeners = {};
    return {
        publish(event, data) {
            if (typeof SysLog !== 'undefined') SysLog.debug(`DBus: Published event "${event}"`);
            if (!listeners[event]) return;
            listeners[event].forEach(cb => cb(data));
        },
        subscribe(event, callback) {
            if (typeof SysLog !== 'undefined') SysLog.debug(`DBus: Subscription added to "${event}"`);
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(callback);
            return () => this.unsubscribe(event, callback);
        },
        unsubscribe(event, callback) {
            if (!listeners[event]) return;
            listeners[event] = listeners[event].filter(cb => cb !== callback);
        }
    };
})();
window.glidBus = glidBus;
