/**
 * SMC String Builtins
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SmcStringBuiltins = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;

    const STRING_BUILTINS = {
        len: (args) => {
            return String(getVal(args[0]) || "").length;
        },
        upper: (args) => {
            return String(getVal(args[0]) || "").toUpperCase();
        },
        lower: (args) => {
            return String(getVal(args[0]) || "").toLowerCase();
        },
        trim: (args) => {
            return String(getVal(args[0]) || "").trim();
        },
        replace: (args) => {
            const str = String(getVal(args[0]) || "");
            const search = String(getVal(args[1]) || "");
            const replacement = String(getVal(args[2]) || "");
            return str.split(search).join(replacement);
        },
        substr: (args) => {
            const str = String(getVal(args[0]) || "");
            const start = parseInt(getVal(args[1]) || 0);
            const len = args[2] !== undefined ? parseInt(getVal(args[2])) : undefined;
            return str.substring(start, len !== undefined ? start + len : undefined);
        },
        index_of: (args) => {
            const str = String(getVal(args[0]) || "");
            const search = String(getVal(args[1]) || "");
            return str.indexOf(search);
        },
        char_at: (args) => {
            const str = String(getVal(args[0]) || "");
            const index = parseInt(getVal(args[1]) || 0);
            return str.charAt(index);
        },
        concat: (args) => {
            return args.map(a => String(getVal(a) ?? "")).join("");
        },
        append: (args) => {
            return args.map(a => String(getVal(a) ?? "")).join("");
        }
    };

    if (typeof SmcBuiltins !== 'undefined') {
        SmcBuiltins.setMeta('len', { args: [{ name: 'str', required: true, type: 'string' }] });
        SmcBuiltins.setMeta('upper', { args: [{ name: 'str', required: true, type: 'string' }] });
        SmcBuiltins.setMeta('lower', { args: [{ name: 'str', required: true, type: 'string' }] });
        SmcBuiltins.setMeta('trim', { args: [{ name: 'str', required: true, type: 'string' }] });
        SmcBuiltins.setMeta('replace', { args: [{ name: 'str', required: true, type: 'string' }, { name: 'search', required: true, type: 'string' }, { name: 'replace', required: true, type: 'string' }] });
        SmcBuiltins.setMeta('substr', { args: [{ name: 'str', required: true, type: 'string' }, { name: 'start', required: true, type: 'int' }, { name: 'len', type: 'int' }] });
        SmcBuiltins.setMeta('index_of', { args: [{ name: 'str', required: true, type: 'string' }, { name: 'search', required: true, type: 'string' }] });
        SmcBuiltins.setMeta('char_at', { args: [{ name: 'str', required: true, type: 'string' }, { name: 'index', required: true, type: 'int' }] });
    }

    return { STRING_BUILTINS };
}));
