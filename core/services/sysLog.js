// ── gliterOS System Logger ────────────────────────────────────────────────────
const SysLog = (() => {
    const logs = [];
    const listeners = [];
    return {
        logs,
        log: (severity, message) => {
            const entry = { timestamp: new Date().toLocaleTimeString(), severity, message };
            logs.push(entry);
            listeners.forEach(cb => cb(entry));
        },
        info: (msg) => SysLog.log('info', msg),
        warn: (msg) => SysLog.log('warn', msg),
        error: (msg) => SysLog.log('error', msg),
        debug: (msg) => SysLog.log('debug', msg),
        subscribe: (cb) => listeners.push(cb),
        unsubscribe: (cb) => {
            const idx = listeners.indexOf(cb);
            if (idx > -1) listeners.splice(idx, 1);
        }
    };
})();
window.SysLog = SysLog;
SysLog.info("glitterOS System Logger initialized.");
