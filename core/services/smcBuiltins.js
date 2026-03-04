/**
 * smcBuiltins.js - Central registry for SMC builtin procedures and commands.
 * This allows apps to register functions that can be used from SMC scripts.
 */

const SmcBuiltins = (() => {
    const _procedures = new Map();
    const _metadata = new Map();

    /**
     * Registers a new builtin procedure.
     * @param {string} name 
     * @param {Function} func (args, context) => Promise<any> | any
     * @param {Object} meta Metadata about the procedure (e.g. { args: [{ name: 'title', required: true, type: 'string' }] })
     */
    function register(name, func, meta = {}) {
        const lower = name.toLowerCase();
        _procedures.set(lower, func);
        _metadata.set(lower, meta);
        if (typeof SysLog !== 'undefined') SysLog.debug(`SmcBuiltins: Registered procedure "${name}"`);
    }

    /**
     * Returns all registered procedures as an object.
     */
    function getAll() {
        const obj = {};
        _procedures.forEach((func, name) => {
            obj[name] = func;
        });
        return obj;
    }

    /**
     * Returns metadata for a procedure.
     */
    function getMeta(name) {
        return _metadata.get(name.toLowerCase()) || {};
    }

    /**
     * Sets metadata for a builtin (even if not registered through this service).
     */
    function setMeta(name, meta) {
        _metadata.set(name.toLowerCase(), meta);
    }

    return {
        register,
        setMeta,
        getAll,
        getMeta
    };
})();

// Export globally
window.SmcBuiltins = SmcBuiltins;
