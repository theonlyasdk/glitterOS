// ── glitterOS Service Manager ───────────────────────────────────────────────
const ServiceManager = (() => {
    const _services = {};

    function _emitChange() {
        if (typeof glidBus !== 'undefined') glidBus.publish('service:changed', ServiceManager.list());
        window.dispatchEvent(new CustomEvent('gos-service-changed'));
    }

    function _servicePid(id) {
        return `svc-${String(id).toLowerCase()}`;
    }

    const ServiceManager = {
        register(def) {
            if (!def || !def.id) return null;
            const svc = {
                id: def.id,
                name: def.name || def.id,
                description: def.description || '',
                pid: _servicePid(def.id),
                running: false,
                disabled: false,
                type: def.type || 'System Service',
                onStart: typeof def.onStart === 'function' ? def.onStart : null,
                onStop: typeof def.onStop === 'function' ? def.onStop : null
            };
            _services[def.id] = svc;
            if (def.autoStart !== false) this.start(def.id, { manual: false });
            _emitChange();
            return svc;
        },

        start(id, opts = {}) {
            const svc = _services[id];
            if (!svc) return { error: 'Service not found' };
            if (svc.running) return { ok: true };
            if (svc.disabled && !opts.manual) return { error: 'Service disabled' };
            svc.disabled = false;
            svc.running = true;
            try {
                if (svc.onStart) svc.onStart();
            } catch (e) {
                svc.running = false;
                return { error: String(e) };
            }
            _emitChange();
            return { ok: true };
        },

        stop(id, opts = {}) {
            const svc = _services[id];
            if (!svc) return { error: 'Service not found' };
            if (!svc.running && !opts.disable) return { ok: true };
            if (svc.running) {
                try {
                    if (svc.onStop) svc.onStop();
                } catch (e) {
                    return { error: String(e) };
                }
            }
            svc.running = false;
            if (opts.disable) svc.disabled = true;
            _emitChange();
            return { ok: true };
        },

        restart(id) {
            const svc = _services[id];
            if (!svc) return { error: 'Service not found' };
            this.stop(id, { disable: false });
            return this.start(id, { manual: true });
        },

        kill(id) {
            return this.stop(id, { disable: true });
        },

        get(id) {
            return _services[id] || null;
        },

        list() {
            return Object.values(_services).map(s => ({ ...s }));
        }
    };

    return ServiceManager;
})();

window.ServiceManager = ServiceManager;
