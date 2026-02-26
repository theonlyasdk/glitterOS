/**
 * Application Registry — single source of truth for installed applications.
 * Each app self-registers via AppRegistry.register() at the end of its file.
 */
const AppRegistry = (() => {
    const _apps = [];

    return {
        /**
         * Register an application.
         * @param {object} app { id, name, icon, launch, desktopShortcut? }
         */
        register(app) {
            if (!app.id || !app.name || !app.launch) {
                console.warn('AppRegistry: invalid registration', app);
                if (typeof SysLog !== 'undefined') SysLog.warn(`AppRegistry: invalid registration attempted.`);
                return;
            }
            _apps.push(app);
            if (typeof SysLog !== 'undefined') SysLog.info(`AppRegistry: Registered app "${app.name}" (${app.id})`);

            // If it has an exe name, ensure it exists in System
            if (app.exe && typeof fs !== 'undefined') {
                const path = `C:\\glitterOS\\System\\${app.exe}`;
                if (!fs.exists(path)) {
                    fs.write(path, '[glitterOS System Executable]');
                }
                fs.setattr(path, 'appId', app.id);
            }
        },
        /** Unregister an application by id */
        unregister(id) {
            const idx = _apps.findIndex(a => a.id === id);
            if (idx !== -1) _apps.splice(idx, 1);
        },
        /** Get all registered apps */
        getAll() { return [..._apps]; },
        /** Get app by id */
        get(id) { return _apps.find(a => a.id === id); },
        /** Get all apps that want a desktop shortcut */
        getDesktopApps() { return _apps.filter(a => a.desktopShortcut); },
        /** Get apps supporting an extension */
        getAppsForExt(ext) {
            const lowerExt = ext ? ext.toLowerCase() : '';
            return _apps.filter(a => {
                if (!a.acceptsFiles) return false;
                if (!a.supportedExtensions || a.supportedExtensions.length === 0) return true; // accepts all
                return a.supportedExtensions.map(e => e.toLowerCase()).includes(lowerExt);
            });
        }
    };
})();
window.AppRegistry = AppRegistry;
