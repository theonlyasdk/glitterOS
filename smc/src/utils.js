/**
 * SMC Utilities
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SmcUtils = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const normalize = (content) => {
        return String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    };

    const stripInlineComments = (line) => {
        let inQuotes = false;
        let qChar = null;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"' || line[i] === "'") {
                if (!inQuotes) { inQuotes = true; qChar = line[i]; }
                else if (qChar === line[i]) inQuotes = false;
            }
            if (line[i] === '#' && !inQuotes) {
                return line.substring(0, i).trim();
            }
        }
        return line.trim();
    };

    const resolveImportPath = (rawPath, ctx, fs) => {
        if (!rawPath) return null;
        const sep = (typeof process !== 'undefined' && process.platform === 'win32') ? '\\' : '/';
        const cleaned = rawPath.replace(/[\\\/]/g, sep);
        if (/^[A-Za-z]:[\\\/]/.test(cleaned) || cleaned.startsWith('/') || cleaned.startsWith('\\')) return cleaned;
        const base = ctx.cwd || (sep === '\\' ? 'C:\\' : '/');
        return base.endsWith(sep) ? base + cleaned : base + sep + cleaned;
    };

    const expandVariables = (str, scope, ctx, getAllVariables) => {
        let out = String(str);
        const vars = getAllVariables(scope, ctx);
        const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
        sortedKeys.forEach((key) => {
            let rawVal = vars[key];
            let val = "";
            if (rawVal === null) val = "none";
            else if (typeof rawVal === 'object' && rawVal.__tag === 'range') val = `${rawVal.start}..${rawVal.end}`;
            else if (typeof rawVal === 'object' && rawVal.__tag === 'float') val = String(rawVal.value);
            else val = String(rawVal ?? "");

            const baseKey = key.startsWith('$') ? key.substring(1) : key;
            const safeKey = baseKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const safeFullKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            out = out.replace(new RegExp(`%${safeKey}%`, 'g'), val);
            out = out.replace(new RegExp(`%\\{${safeKey}\\}`, 'g'), val);
            out = out.replace(new RegExp(`\\$\\{${safeKey}\\}`, 'g'), val);
            out = out.replace(new RegExp(`${safeFullKey}(?![A-Za-z0-9_])`, 'g'), val);
        });
        return out;
    };

    const isFloat = (v) => v && typeof v === 'object' && v.__tag === 'float';
    const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });
    const getVal = (v) => isFloat(v) ? v.value : v;

    return { normalize, stripInlineComments, resolveImportPath, expandVariables, isFloat, makeFloat, getVal };
}));
