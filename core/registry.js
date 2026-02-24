/**
 * System Registry - Persistent configuration storage
 */
const registry = (() => {
    const KEY = 'gos_registry';
    let _data = {
        personalization: {
            wallpaper: 'res/wall.png'
        }
    };

    function _load() {
        const saved = localStorage.getItem(KEY);
        if (saved) {
            try {
                _data = { ..._data, ...JSON.parse(saved) };
            } catch (e) { console.error("Registry load failed", e); }
        }
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
        }
    };
})();
