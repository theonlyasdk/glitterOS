/**
 * System Registry - Persistent configuration storage
 */
const registry = (() => {
    const KEY = 'gos_registry';
    let _data = {
        Software: {
            GlitterOS: {
                Personalization: {
                    Wallpaper: 'res/wall.png'
                }
            }
        }
    };

    function _ensurePath(path) {
        const parts = path.split('.');
        let curr = _data;
        for (const p of parts) {
            if (curr[p] === undefined || typeof curr[p] !== 'object' || curr[p] === null) curr[p] = {};
            curr = curr[p];
        }
        return curr;
    }

    function _has(path) {
        const parts = path.split('.');
        let curr = _data;
        for (const p of parts) {
            if (curr[p] === undefined) return false;
            curr = curr[p];
        }
        return true;
    }

    function _get(path) {
        const parts = path.split('.');
        let curr = _data;
        for (const p of parts) {
            if (curr[p] === undefined) return undefined;
            curr = curr[p];
        }
        return curr;
    }

    function _del(path) {
        const parts = path.split('.');
        let curr = _data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (curr[parts[i]] === undefined) return;
            curr = curr[parts[i]];
        }
        delete curr[parts[parts.length - 1]];
    }

    function _set(path, val) {
        const parts = path.split('.');
        let curr = _data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (curr[parts[i]] === undefined || typeof curr[parts[i]] !== 'object' || curr[parts[i]] === null) curr[parts[i]] = {};
            curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = val;
    }

    function _migrateLegacyRoots() {
        _ensurePath('Software.GlitterOS');
        const mappings = [
            ['personalization', 'Software.GlitterOS.Personalization'],
            ['cmd', 'Software.GlitterOS.Cmd'],
            ['system', 'Software.GlitterOS.System']
        ];

        let changed = false;
        mappings.forEach(([oldPath, newPath]) => {
            if (_has(oldPath)) {
                if (!_has(newPath)) {
                    _set(newPath, _get(oldPath));
                } else {
                    const oldVal = _get(oldPath);
                    const newVal = _get(newPath);
                    if (typeof oldVal === 'object' && oldVal !== null && typeof newVal === 'object' && newVal !== null) {
                        _set(newPath, { ...oldVal, ...newVal });
                    }
                }
                _del(oldPath);
                changed = true;
            }
        });

        return changed;
    }

    function _migratePascalCaseKeys() {
        const mappings = [
            ['Software.GlitterOS.Personalization.wallpaper', 'Software.GlitterOS.Personalization.Wallpaper'],
            ['Software.GlitterOS.Personalization.lockscreenWallpaper', 'Software.GlitterOS.Personalization.LockScreenWallpaper'],
            ['Software.GlitterOS.Personalization.wallpaperProvider', 'Software.GlitterOS.Personalization.WallpaperProvider'],
            ['Software.GlitterOS.Personalization.customWallpaper', 'Software.GlitterOS.Personalization.CustomWallpaper'],
            ['Software.GlitterOS.Personalization.showSplash', 'Software.GlitterOS.Personalization.ShowSplash'],
            ['Software.GlitterOS.Cmd.history', 'Software.GlitterOS.Cmd.History'],
            ['Software.GlitterOS.System.windowSnapping', 'Software.GlitterOS.System.WindowSnapping']
        ];

        let changed = false;
        mappings.forEach(([oldPath, newPath]) => {
            if (_has(oldPath)) {
                if (!_has(newPath)) _set(newPath, _get(oldPath));
                _del(oldPath);
                changed = true;
            }
        });
        return changed;
    }

    function _load() {
        const saved = localStorage.getItem(KEY);
        if (saved) {
            try {
                _data = { ..._data, ...JSON.parse(saved) };
            } catch (e) { console.error("Registry load failed", e); }
        }
        const changedLegacy = _migrateLegacyRoots();
        const changedPascal = _migratePascalCaseKeys();
        const changed = changedLegacy || changedPascal;
        if (changed) _save();
    }

    function _save() {
        localStorage.setItem(KEY, JSON.stringify(_data));
    }

    _load();

    return {
        get(path, defaultVal) {
            const parts = path.split('.');
            let curr = _data;
            for (const p of parts) {
                if (curr[p] === undefined) return defaultVal;
                curr = curr[p];
            }
            return curr;
        },
        set(path, val) {
            const parts = path.split('.');
            let curr = _data;
            for (let i = 0; i < parts.length - 1; i++) {
                if (curr[parts[i]] === undefined) curr[parts[i]] = {};
                curr = curr[parts[i]];
            }
            curr[parts[parts.length - 1]] = val;
            _save();
            if (typeof SysLog !== 'undefined') SysLog.debug(`Registry: Set "${path}" to ${JSON.stringify(val)}`);
            if (typeof glidBus !== 'undefined') glidBus.publish(`registry:set`, { path, val });
        },
        /** Get entire registry data (deep copy) */
        getAll() { return JSON.parse(JSON.stringify(_data)); },
        /** Delete a key by dot-path */
        delete(path) {
            const parts = path.split('.');
            let curr = _data;
            for (let i = 0; i < parts.length - 1; i++) {
                if (curr[parts[i]] === undefined) return;
                curr = curr[parts[i]];
            }
            delete curr[parts[parts.length - 1]];
            _save();
            if (typeof SysLog !== 'undefined') SysLog.debug(`Registry: Deleted "${path}"`);
            if (typeof glidBus !== 'undefined') glidBus.publish(`registry:delete`, { path });
        }
    };
})();
